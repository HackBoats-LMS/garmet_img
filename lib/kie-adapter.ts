/**
 * Universal Kie.ai Payload Adapter
 * 
 * Automatically formats the request body for any Kie.ai model family:
 * - ByteDance / Seedream / Seedance: requires callBackUrl, image_urls, quality ("basic" | "high"), size ("1K" | "2K"), output_format, nsfw_checker.
 * - Nano Banana: requires image_input, output_format, resolution ("2K"), nsfw_checker.
 * - Flux (Black Forest Labs / Qubico): requires input_urls / image_urls, aspect_ratio, nsfw_checker, no negative_prompt parameter.
 * - GPT Image / Generic Image-to-Image: requires input_urls, negative_prompt, aspect_ratio.
 */

export interface KieTaskInputOptions {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  imageUrls: string[];
  aspectRatio?: string;
  resolution?: string; // '1K' | '2K' | '4K' | '1080p'
  callBackUrl?: string;
}

export interface KieTaskPayload {
  model: string;
  callBackUrl: string;
  input: Record<string, any>;
}

export function buildKieTaskPayload(options: KieTaskInputOptions): KieTaskPayload {
  const {
    modelId,
    prompt,
    negativePrompt = '',
    imageUrls = [],
    aspectRatio = '3:4',
    resolution = '1K',
    callBackUrl = (process.env.NEXTAUTH_URL || 'https://coutureai.app').replace(/\/+$/, '') + '/api/callback',
  } = options;

  const m = modelId.toLowerCase();

  // Family classification
  const isSeedream = m.includes('seedream') || m.includes('seedance') || m.includes('bytedance');
  const isNanoBanana = m.includes('nano-banana');
  const isFlux = m.includes('flux');
  const isGptImage = m.includes('gpt-image') || m.includes('sunburst');

  // Map model string if needed (e.g. nano-banana-2-1 2k -> nano-banana-2-1)
  let actualModel = modelId;
  if (isNanoBanana) {
    actualModel = 'nano-banana-2-1';
  }

  // Handle negative exclusions:
  // Models like Flux, Nano Banana, and Seedream reject the 'negative_prompt' API parameter,
  // so negative exclusions must be appended directly to the prompt text.
  let finalPrompt = prompt;
  const negativeExclusions = negativePrompt || 'bad anatomy, distorted fabric patterns, unreferenced embroidery, uninvited chest artwork not in swatch, fabricated motifs absent from reference images, hemline border copied to chest drape, floral vines on chest border, widened chest border, patterned upper border, mismatched motifs on back reflection, pattern fabrication, giant enlarged butis, blur, watermark.';

  const inputPayload: Record<string, any> = {
    prompt: finalPrompt,
    aspect_ratio: aspectRatio,
  };

  if (isSeedream) {
    // ByteDance / Seedream 5 Pro & Lite & Flash
    if (!finalPrompt.includes('NEGATIVE EXCLUSIONS')) {
      inputPayload.prompt = `${finalPrompt}\n\nNEGATIVE EXCLUSIONS (STRICTLY FORBIDDEN): ${negativeExclusions}`;
    }
    // Seedream requires 'quality': 'basic' (1K) or 'high' (2K)
    const is2K = resolution.toUpperCase() === '2K' || resolution.toUpperCase() === '4K';
    inputPayload.quality = is2K ? 'high' : 'basic';
    inputPayload.size = is2K ? '2K' : '1K';
    inputPayload.output_format = 'png';
    inputPayload.nsfw_checker = false;

    if (imageUrls.length > 0) {
      inputPayload.image_urls = imageUrls;
    }
  } else if (isNanoBanana) {
    // Google Nano Banana 2.1
    if (!finalPrompt.includes('NEGATIVE EXCLUSIONS')) {
      inputPayload.prompt = `${finalPrompt}\n\nNEGATIVE EXCLUSIONS (STRICTLY FORBIDDEN): ${negativeExclusions}`;
    }
    inputPayload.resolution = '2K';
    inputPayload.output_format = 'png';
    inputPayload.nsfw_checker = false;

    if (imageUrls.length > 0) {
      inputPayload.image_input = imageUrls;
    }
  } else if (isFlux) {
    // Flux Pro / Dev / Schnell
    if (!finalPrompt.includes('NEGATIVE EXCLUSIONS')) {
      inputPayload.prompt = `${finalPrompt}\n\nNEGATIVE EXCLUSIONS (STRICTLY FORBIDDEN): ${negativeExclusions}`;
    }
    inputPayload.resolution = resolution || '1K';
    inputPayload.nsfw_checker = false;

    if (imageUrls.length > 0) {
      inputPayload.input_urls = imageUrls;
      inputPayload.image_urls = imageUrls;
    }
  } else {
    // GPT Image 2.5 Sunburst / Generic
    inputPayload.resolution = resolution || '1K';
    if (negativePrompt) {
      inputPayload.negative_prompt = negativePrompt;
    }
    if (imageUrls.length > 0) {
      inputPayload.input_urls = imageUrls;
      inputPayload.image_urls = imageUrls;
    }
  }

  return {
    model: actualModel,
    callBackUrl,
    input: inputPayload,
  };
}

