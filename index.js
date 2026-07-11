import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// ----------------------
// SUPABASE
// ----------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ----------------------
// SHOPIFY
// ----------------------
const SHOPIFY_STORE = "order-bot-nrgkfb8z.myshopify.com";

// REPLACE THIS WITH YOUR ADMIN API ACCESS TOKEN
const SHOPIFY_ADMIN_API = "PASTE_YOUR_ADMIN_API_ACCESS_TOKEN_HERE";

console.log("🚀 Order Bot Started");

// ----------------------
// CREATE SHOPIFY ORDER
// ----------------------
async function createShopifyOrder(variantId, customer) {
  const response = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2025-07/orders.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API,
      },
      body: JSON.stringify({
        order: {
          financial_status: "paid",
          line_items: [
            {
              variant_id: Number(variantId),
              quantity: 1,
            },
          ],
          customer: {
            first_name: customer.name || "Customer",
            email: customer.email || "customer@example.com",
          },
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("❌ Shopify Error:", data);
    throw new Error(JSON.stringify(data));
  }

  return data;
}

// ----------------------
// PROCESS QUEUE
// ----------------------
async function processQueue() {
  const { data: orders, error } = await supabase
    .from("dsers_queue")
    .select("*")
    .eq("status", "pending");

  if (error) {
    console.log("Supabase Error:", error);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log("⏳ No pending orders");
    return;
  }

  console.log(`📦 Found ${orders.length} pending orders`);

  for (const order of orders) {
    try {
      await supabase
        .from("dsers_queue")
        .update({ status: "processing" })
        .eq("id", order.id);

      console.log("➡ Processing Order:", order.id);

      if (!order.shopify_variant_id) {
        throw new Error("Missing Shopify Variant ID");
      }

      const result = await createShopifyOrder(
        order.shopify_variant_id,
        {
          email: order.email,
          name: order.customer_name,
        }
      );

      await supabase
        .from("dsers_queue")
        .update({
          status: "sent_to_shopify",
          shopify_order_id: result.order.id,
        })
        .eq("id", order.id);

      console.log("✅ Order Sent:", result.order.id);

    } catch (err) {
      console.log("❌ Failed:", err.message);

      await supabase
        .from("dsers_queue")
        .update({ status: "failed" })
        .eq("id", order.id);
    }
  }
}

// ----------------------
// START LOOP
// ----------------------
setInterval(processQueue, 15000);
processQueue();

// ----------------------
// SERVER
// ----------------------
app.get("/", (req, res) => {
  res.send("Order Bot Running 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
