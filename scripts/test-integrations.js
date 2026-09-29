const http = require('http');

async function runTest() {
  console.log("=== Testing PACT Webhook (Inbound) ===");
  
  const pactPayload = {
    event_type: "NEW_STOCK",
    document_reference: "TEST-INV-001",
    items: [
      {
        STOCK_CODE: "TEST-WA-001",
        DESIGN_NUMBER: "DES-TEST-123",
        WHATSAPP_CATALOGUE_TITLE: "Test Saree for WhatsApp",
        RETAIL_PRICE: "1999.00",
        current_stock: "5",
        PRODUCT_DESCRIPTION: "A beautiful test saree to verify whatsapp integration.",
        FABRIC: "Silk"
      }
    ]
  };

  try {
    const pactRes = await fetch('http://localhost:3001/api/v1/webhooks/pact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pact-secret-token'
      },
      body: JSON.stringify(pactPayload)
    });
    const pactData = await pactRes.json();
    console.log("PACT Webhook Response:", pactRes.status, pactData);
    
    console.log("\n=== Testing WhatsApp Catalog Feed (Outbound) ===");
    
    const waRes = await fetch('http://localhost:3001/api/v1/whatsapp-catalog', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token' // The default token in the route
      }
    });
    
    const waData = await waRes.json();
    console.log("WhatsApp Catalog Response:", waRes.status);
    console.log(JSON.stringify(waData, null, 2));

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

runTest();
