import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadGeneratedAsset, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const customKey = searchParams.get('apiKey');
    const explicitProvider = searchParams.get('provider');
    const userId = searchParams.get('userId') || 'customer';
    const orderId = searchParams.get('orderId') || 'order';
    const productId = searchParams.get('productId') || null;
    const poseId = searchParams.get('poseId') || taskId || 'pose';

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // Determine configured engine from DB
    let configuredEngine = 'Qubico/flux1-schnell';
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT "selectedEngine" FROM "StudioConfig" WHERE "id" = 'global_studio_config' LIMIT 1;
      `);
      if (rows?.[0]?.selectedEngine) {
        configuredEngine = rows[0].selectedEngine;
      }
    } catch (e) {
      console.warn('[task-status] DB config note:', e);
    }

    const isSegmindPrimary =
      explicitProvider === 'segmind' ||
      configuredEngine.toLowerCase().includes('segmind') ||
      configuredEngine.toLowerCase().includes('idm-vton');

    // ─────────────────────────────────────────────────────────────
    // Check Kie.ai if explicitly requested
    // ─────────────────────────────────────────────────────────────
    if (explicitProvider === 'kie-ai') {
      const kieApiKey = (customKey || process.env.KIE_API_KEY || '').trim();
      
      if (!kieApiKey) {
        return NextResponse.json({ error: 'Kie.ai API key not configured' }, { status: 401 });
      }

      try {
        const checkRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
          headers: { 'Authorization': `Bearer ${kieApiKey}` },
        });

        if (!checkRes.ok) {
          const errText = await checkRes.text();
          return NextResponse.json({ status: 'failed', error: `Kie.ai Error (${checkRes.status}): ${errText}`, taskId, provider: 'kie-ai' });
        }

        const checkText = await checkRes.text();
        let checkData: any = {};
        try {
          checkData = JSON.parse(checkText);
        } catch {
          return NextResponse.json({ status: 'pending', taskId, provider: 'kie-ai' });
        }

        const status = (checkData?.data?.state || checkData?.state || checkData?.data?.status || checkData?.status || '').toLowerCase();
        if (status === 'completed' || status === 'success') {
          const output = checkData?.data?.result || checkData?.data?.output || checkData?.result || checkData?.output || checkData?.data?.url || checkData?.data?.images || checkData?.data;
          const firstData = Array.isArray(output) ? output[0] : output?.data?.[0] || output?.[0] || output;
          let finalImageUrl = '';

        // Direct Kie.ai response resultUrls extraction
        if (checkData?.data?.response?.resultUrls?.[0]) {
          finalImageUrl = checkData.data.response.resultUrls[0];
        } else if (checkData?.response?.resultUrls?.[0]) {
          finalImageUrl = checkData.response.resultUrls[0];
        } else if (checkData?.data?.resultUrls?.[0]) {
          finalImageUrl = checkData.data.resultUrls[0];
        } else if (typeof checkData?.data?.resultJson === 'string') {
          try {
            const parsedRj = JSON.parse(checkData.data.resultJson);
            if (parsedRj?.resultUrls?.[0]) {
              finalImageUrl = parsedRj.resultUrls[0];
            }
          } catch {}
        }

        if (!finalImageUrl) {
          if (output?.image_url) {
            finalImageUrl = output.image_url;
          } else if (output?.image_base64) {
            finalImageUrl = output.image_base64.startsWith('data:') ? output.image_base64 : `data:image/png;base64,${output.image_base64}`;
          } else if (firstData?.b64_json) {
            finalImageUrl = `data:image/png;base64,${firstData.b64_json}`;
          } else if (firstData?.url) {
            finalImageUrl = firstData.url;
          } else if (typeof firstData === 'string' && (firstData.startsWith('http') || firstData.startsWith('data:image'))) {
            finalImageUrl = firstData;
          } else if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:image'))) {
            finalImageUrl = output;
          } else if (output?.image_urls?.[0]) {
            finalImageUrl = typeof output.image_urls[0] === 'string' ? output.image_urls[0] : output.image_urls[0].url;
          } else if (output?.images?.[0]) {
            finalImageUrl = typeof output.images[0] === 'string' ? output.images[0] : output.images[0].url;
          }
        }

        if (!finalImageUrl) {
           const dataStr = JSON.stringify(checkData.data || checkData);
           const matches = dataStr.matchAll(/"(https?:\/\/[^"]+)"/g);
           for (const match of matches) {
             const url = match[1];
             if (url && !url.includes('ibb.co') && !url.includes('imgbb.com')) {
               finalImageUrl = url;
               break;
             }
           }
        }

        if (finalImageUrl) {
          // Strictly strip any trailing backslashes, escape chars, or whitespace
          finalImageUrl = finalImageUrl.trim().replace(/[\\'";,\s]+$/, '');
        }

          if (finalImageUrl) {
            let permanentUrl = finalImageUrl;
            if (isStorageConfigured()) {
              try {
                permanentUrl = await uploadGeneratedAsset(finalImageUrl, userId, orderId, poseId);
              } catch (cErr) {
                console.warn('[task-status] Cloudinary upload fallback for Kie.ai:', cErr);
              }
            }

            if (orderId && orderId !== 'order') {
              try {
                const existing = await prisma.customerOrder.findUnique({ where: { id: orderId } });
                if (existing) {
                  const currentGen = (existing.generatedImages as any) || {};
                  await prisma.customerOrder.update({
                    where: { id: orderId },
                    data: {
                      generatedImages: {
                        ...currentGen,
                        [poseId]: { imageUrl: permanentUrl, generatedAt: new Date().toISOString() },
                      },
                      status: 'completed',
                    },
                  });
                }
              } catch (dbErr) {
                console.error('[task-status DB save error]:', dbErr);
              }
            }

            if (productId) {
              try {
                const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
                if (existingProduct) {
                  const currentGen = (existingProduct.generatedImages as any) || {};
                  await prisma.product.update({
                    where: { id: productId },
                    data: {
                      generatedImages: {
                        ...currentGen,
                        [poseId]: { imageUrl: permanentUrl, generatedAt: new Date().toISOString() },
                      },
                      linkedOrderId: orderId !== 'order' ? orderId : existingProduct.linkedOrderId,
                    }
                  });
                }
              } catch (productDbErr) {
                console.error('[task-status Product DB save error]:', productDbErr);
              }
            }

            return NextResponse.json({ status: 'completed', imageUrl: permanentUrl, taskId, provider: 'kie-ai' });
          } else {
            return NextResponse.json({ status: 'failed', error: 'No image data found in Kie.ai success response', taskId, provider: 'kie-ai' });
          }
        }

        if (status === 'failed' || status === 'error') {
          const failReason = checkData?.data?.error?.message || checkData?.data?.message || 'Processing failed on Kie.ai';
          return NextResponse.json({ status: 'failed', error: failReason, taskId, provider: 'kie-ai' });
        }

        return NextResponse.json({ status: status || 'pending', taskId, provider: 'kie-ai' });
      } catch (kErr) {
        console.warn('[task-status] Kie.ai poll check note:', kErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Check Segmind v2 API if Segmind is primary or explicitly requested
    // ─────────────────────────────────────────────────────────────
    if (isSegmindPrimary || explicitProvider === 'segmind') {
      const rawSegmindKey = (customKey || process.env.SEGMIND_API_KEY || '').trim();
      const segmindApiKey = rawSegmindKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

      if (segmindApiKey) {
        try {
          const statusRes = await fetch(`https://api.segmind.com/v2/requests/${taskId}/status`, {
            headers: { 'x-api-key': segmindApiKey },
          });

          if (statusRes.ok || statusRes.status === 422) {
            if (statusRes.status === 422) {
              const errText = await statusRes.text();
              return NextResponse.json({ status: 'failed', error: `Segmind error (422): ${errText}`, taskId });
            }

            const statusJson = await statusRes.json();
            const status = (statusJson?.status || '').toUpperCase();

            if (status === 'COMPLETED' || status === 'SUCCESS') {
              const resultRes = await fetch(`https://api.segmind.com/v2/requests/${taskId}`, {
                headers: { 'x-api-key': segmindApiKey },
              });

              if (resultRes.ok) {
                const contentType = resultRes.headers.get('content-type') || '';
                let imageUrl = '';

                if (contentType.includes('application/json')) {
                  const resultJson = await resultRes.json();
                  if (resultJson?.image) {
                    imageUrl =
                      resultJson.image.startsWith('http') || resultJson.image.startsWith('data:')
                        ? resultJson.image
                        : `data:image/png;base64,${resultJson.image}`;
                  } else if (resultJson?.output) {
                    if (typeof resultJson.output === 'string') {
                      imageUrl =
                        resultJson.output.startsWith('http') || resultJson.output.startsWith('data:')
                          ? resultJson.output
                          : `data:image/png;base64,${resultJson.output}`;
                    } else if (Array.isArray(resultJson.output) && resultJson.output[0]) {
                      imageUrl = resultJson.output[0];
                    } else if (resultJson.output?.image_url || resultJson.output?.url) {
                      imageUrl = resultJson.output.image_url || resultJson.output.url;
                    }
                  } else if (Array.isArray(resultJson?.images) && resultJson.images[0]) {
                    imageUrl = resultJson.images[0]?.url || resultJson.images[0];
                  } else if (resultJson?.url) {
                    imageUrl = resultJson.url;
                  }
                } else if (contentType.includes('image/')) {
                  const imgBuffer = await resultRes.arrayBuffer();
                  const base64 = Buffer.from(imgBuffer).toString('base64');
                  imageUrl = `data:${contentType};base64,${base64}`;
                }

                if (imageUrl) {
                  let permanentUrl = imageUrl;
                  if (isStorageConfigured()) {
                    try {
                      permanentUrl = await uploadGeneratedAsset(imageUrl, userId, orderId, poseId);
                    } catch (cErr) {
                      console.warn('[task-status] Cloudinary upload fallback:', cErr);
                    }
                  }

                  if (orderId && orderId !== 'order') {
                    try {
                      const existing = await prisma.customerOrder.findUnique({ where: { id: orderId } });
                      if (existing) {
                        const currentGen = (existing.generatedImages as any) || {};
                        await prisma.customerOrder.update({
                          where: { id: orderId },
                          data: {
                            generatedImages: {
                              ...currentGen,
                              [poseId]: { imageUrl: permanentUrl, generatedAt: new Date().toISOString() },
                            },
                            status: 'completed',
                          },
                        });
                      }
                    } catch (dbErr) {
                      console.error('[task-status DB save error]:', dbErr);
                    }
                  }

                  return NextResponse.json({ status: 'completed', imageUrl: permanentUrl, taskId, provider: 'segmind' });
                }
              }
            }

            if (status === 'FAILED' || status === 'ERROR') {
              const failReason = statusJson?.error || statusJson?.message || 'Processing failed on Segmind';
              return NextResponse.json({ status: 'failed', error: failReason, taskId, provider: 'segmind' });
            }

            return NextResponse.json({ status: status.toLowerCase() || 'pending', taskId, provider: 'segmind' });
          }
        } catch (sErr) {
          console.warn('[task-status] Segmind poll check note:', sErr);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Check PiAPI if PiAPI is primary or fallback
    // ─────────────────────────────────────────────────────────────
    const rawPiapi = (customKey || process.env.PIAPI_API_KEY || process.env.PIAPI_KEY || '').trim();
    const piapiKey = rawPiapi.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!piapiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 401 });
    }

    const checkRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: { 'X-API-KEY': piapiKey },
    });

    if (!checkRes.ok) {
      return NextResponse.json({ error: `PiAPI Error (${checkRes.status})` }, { status: checkRes.status });
    }

    const checkData = await checkRes.json();
    const status = checkData?.data?.status || checkData?.status;

    if (status === 'completed' || status === 'success') {
      const output = checkData?.data?.output || checkData?.output;
      const firstData = output?.data?.[0];
      let imageUrl = '';
      if (firstData?.b64_json) {
        imageUrl = `data:image/png;base64,${firstData.b64_json}`;
      } else if (firstData?.url) {
        imageUrl = firstData.url;
      } else if (output?.image_url) {
        imageUrl = output.image_url;
      } else if (output?.image_urls?.[0]) {
        imageUrl = output.image_urls[0];
      } else if (output?.image_base64) {
        imageUrl = output.image_base64.startsWith('data:') ? output.image_base64 : `data:image/png;base64,${output.image_base64}`;
      }

      let permanentUrl = imageUrl;
      if (imageUrl && isStorageConfigured()) {
        try {
          permanentUrl = await uploadGeneratedAsset(imageUrl, userId, orderId, poseId);
        } catch (cErr) {
          console.warn('[task-status] Cloudinary upload failed:', cErr);
        }
      }

      if (orderId && orderId !== 'order') {
        try {
          const existing = await prisma.customerOrder.findUnique({ where: { id: orderId } });
          if (existing) {
            const currentGen = (existing.generatedImages as any) || {};
            await prisma.customerOrder.update({
              where: { id: orderId },
              data: {
                generatedImages: {
                  ...currentGen,
                  [poseId]: { imageUrl: permanentUrl, generatedAt: new Date().toISOString() },
                },
                status: 'completed',
              },
            });
          }
        } catch (dbErr) {
          console.error('[task-status DB save error]:', dbErr);
        }
      }

      return NextResponse.json({ status: 'completed', imageUrl: permanentUrl, taskId, provider: 'piapi' });
    }

    if (status === 'failed' || status === 'error') {
      const failReason = checkData?.data?.error?.message || checkData?.data?.message || 'Processing failed';
      return NextResponse.json({ status: 'failed', error: failReason, taskId, provider: 'piapi' });
    }

    return NextResponse.json({ status: status || 'pending', taskId, provider: 'piapi' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
