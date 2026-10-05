export async function syncOrderToPactERP(orderData: {
  source_channel: 'Shopify' | 'WhatsApp';
  order_reference: string;
  order_date: string;
  customer_name: string;
  customer_phone: string;
  items: Array<{
    sku: string; // The stable ID
    quantity: number;
    price: number;
  }>;
  total_price: number;
}) {
  const pactApiUrl = process.env.PACT_API_URL || 'https://api.pact-erp.com/v1/sales/invoice';
  const pactApiToken = process.env.PACT_API_TOKEN;

  if (!pactApiToken) {
    console.warn('[PACT Sync] PACT_API_TOKEN is missing. Skipping outbound sync to PACT.');
    return;
  }

  const pactPayload = {
    source_channel: orderData.source_channel,
    order_reference: orderData.order_reference,
    order_date: orderData.order_date,
    payment_status: 'Paid',
    payment_method: orderData.source_channel === 'WhatsApp' ? 'RAZORPAY' : 'Online',
    customer_details: {
      name: orderData.customer_name || 'Online Customer',
      phone: orderData.customer_phone || '',
      email: '',
      billing_state: '',
      shipping_state: '',
      gst_treatment: 'Consumer',
      reverse_charge: false
    },
    line_items: orderData.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      unit_rate: item.price,
      discount_amount: 0,
      tax_percentage: 5
    })),
    shipping_charges: 0,
    total_invoice_value: orderData.total_price
  };

  try {
    const response = await fetch(pactApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pactApiToken}`
      },
      body: JSON.stringify(pactPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PACT Sync Error] PACT API responded with ${response.status}: ${errorText}`);
    } else {
      console.log(`[PACT Sync Success] Sent ${orderData.source_channel} Order ${orderData.order_reference} to PACT.`);
    }
  } catch (error) {
    console.error(`[PACT Sync Error] Failed to reach PACT API:`, error);
  }
}
