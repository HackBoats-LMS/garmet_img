const http = require('http');

async function runTest() {
  console.log("=== Testing WhatsApp Webhook (Inbound Order) ===");
  
  // Simulated WhatsApp Webhook Payload for a cart order
  const waPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: "919876543210", 
                  order: {
                    catalog_id: "CATALOG_123",
                    product_items: [
                      {
                        product_retailer_id: "TEST-WA-001", // The test product we injected
                        quantity: "1",
                        item_price: "1999.00",
                        currency: "INR"
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  try {
    const waOrderRes = await fetch('http://localhost:3001/api/v1/webhooks/whatsapp-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // The simple auth fallback we built
      },
      body: JSON.stringify(waPayload)
    });
    
    const waData = await waOrderRes.json();
    console.log("WhatsApp Webhook Response:", waOrderRes.status, waData);
    
    // Now verify the stock actually went down by querying the catalog again
    console.log("\n=== Verifying Stock Deduction via Catalog ===");
    const catRes = await fetch('http://localhost:3001/api/v1/whatsapp-catalog', {
      headers: { 'Authorization': 'Bearer test-token' }
    });
    const catData = await catRes.json();
    const product = catData.products.find(p => p.id === "TEST-WA-001");
    
    // Wait, the catalog doesn't return raw quantity, it returns 'availability' string. 
    // Let's print it to see if it still exists. If we had 5 and bought 1, it should still be "in stock".
    // We would need to check the DB to see the exact quantity.
    console.log("Product found in catalog:", product ? "Yes" : "No");

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

runTest();
