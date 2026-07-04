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
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

console.log("🚀 Bot started");

// ----------------------
// SHOPIFY ORDER
// ----------------------
async function createShopifyOrder(variantId, customer) {
  console.log("🛒 Creating Shopify order with variant:", variantId);

  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2023-10/orders.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        order: {
          line_items: [
            {
              variant_id: Number(variantId),
              quantity: 1,
            },
          ],
          financial_status: "paid",
          customer: {
            email: customer.email,
            first_name: customer.name,
          },
        },
      }),
    }
  );

  const text = await res.text();

  if (!res.ok) {
    console.log("❌ Shopify error:", text);
    throw new Error(text);
  }

  return JSON.parse(text);
}

// ----------------------
// QUEUE PROCESSOR
// ----------------------
async function processQueue() {
  const { data: orders, error } = await supabase
    .from("dsers_queue")
    .select("*")
    .eq("status", "pending");

  if (error) {
    console.log("DB error:", error);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log("⏳ No pending orders");
    return;
  }

  console.log(`📦 ${orders.length} pending orders`);

  for (const order of orders) {
    try {
      console.log("➡ Processing order:", order.id);

      console.log("📦 Variant ID:", order.shopify_variant_id);

      if (!order.shopify_variant_id || order.shopify_variant_id === "null") {
        console.log("❌ Missing variant ID → skipping");
        continue;
      }

      const shopifyOrder = await createShopifyOrder(
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
          shopify_order_id: shopifyOrder.order.id,
        })
        .eq("id", order.id);

      console.log("✅ DONE:", order.id);
    } catch (err) {
      console.log("❌ FAILED:", order.id, err.message);
    }
  }
}

// ----------------------
setInterval(processQueue, 15000);
processQueue();

// ----------------------
app.get("/", (req, res) => {
  res.send("Bot running 🚀");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
