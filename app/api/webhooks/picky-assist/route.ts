import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    // Picky Assist will send code1 and the updated quantity.
    // Ensure we have both fields before proceeding.
    const code1 = payload.code1;
    const newQuantity = payload.quantity;

    if (!code1 || typeof newQuantity !== 'number') {
      return NextResponse.json(
        { error: 'Invalid payload. Expected code1 and quantity (number).' },
        { status: 400 }
      );
    }

    // Find the product by code1
    const product = await prisma.product.findFirst({
      where: { code1: code1 },
    });

    if (!product) {
      console.warn(`[Picky Assist Webhook] Product not found for code1: ${code1}`);
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Calculate the difference for the inventory log
    const qtyChange = newQuantity - product.quantity;
    
    // Only update if there's actually a change in quantity
    if (qtyChange !== 0) {
      // Auto-update status if quantity hits 0
      let autoStatus = product.status;
      if (newQuantity === 0 && autoStatus === 'ACTIVE') {
        autoStatus = 'OUT_OF_STOCK';
      } else if (newQuantity > 0 && autoStatus === 'OUT_OF_STOCK') {
        autoStatus = 'ACTIVE';
      }

      // Update the product and create an inventory log in a transaction
      await prisma.$transaction([
        prisma.product.update({
          where: { id: product.id },
          data: {
            quantity: newQuantity,
            status: autoStatus,
          },
        }),
        prisma.inventoryLog.create({
          data: {
            productId: product.id,
            action: qtyChange > 0 ? 'restock' : 'sale',
            qtyChange: qtyChange,
            qtyAfter: newQuantity,
            note: 'WhatsApp Catalog Sale / Picky Assist Webhook',
            source: 'whatsapp',
          },
        }),
      ]);
      
      console.log(`[Picky Assist Webhook] ✅ Updated quantity for ${code1} to ${newQuantity}`);
    } else {
      console.log(`[Picky Assist Webhook] ℹ️ Quantity for ${code1} is already ${newQuantity}. No change made.`);
    }

    return NextResponse.json({ success: true, message: 'Inventory updated successfully' });
  } catch (error: any) {
    console.error('[Picky Assist Webhook] ❌ Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
