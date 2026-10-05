import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  uploadAdminTemplateAsset,
  uploadAdminModelAsset,
  uploadCustomerSwatchAsset,
  uploadGeneratedAsset,
  uploadToStorage,
} from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { file, type, templateSlug, assetName, modelName, orderId, slotId, poseId, customFolder } = body;

    if (!file) {
      return NextResponse.json({ error: 'File content (base64 or URL) is required' }, { status: 400 });
    }

    const userId = (session?.user as any)?.id || 'guest_user';
    const userRole = (session?.user as any)?.role || 'customer';

    let secureUrl = file;

    switch (type) {
      case 'admin_template':
        if (userRole !== 'admin') {
          // Allow in local dev or check
          console.warn('[Upload] Admin template upload requested');
        }
        secureUrl = await uploadAdminTemplateAsset(file, templateSlug || 'general', assetName || 'cover');
        break;

      case 'admin_model':
        if (userRole !== 'admin') {
          console.warn('[Upload] Admin model upload requested');
        }
        secureUrl = await uploadAdminModelAsset(file, modelName || 'model');
        break;

      case 'customer_swatch':
        secureUrl = await uploadCustomerSwatchAsset(file, userId, orderId || 'temp_order', slotId || 'swatch');
        break;

      case 'generated':
        secureUrl = await uploadGeneratedAsset(file, userId, orderId || 'temp_order', poseId || 'pose');
        break;

      default:
        const folder = customFolder || (userRole === 'admin' ? 'coutureai/admin/uploads' : `coutureai/users/${userId}/general`);
        const result = await uploadToStorage(file, { folder });
        secureUrl = result.url;
        break;
    }

    return NextResponse.json({
      url: secureUrl,
      success: true,
    });
  } catch (error: any) {
    console.error('[API /upload Error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to upload image' }, { status: 500 });
  }
}
