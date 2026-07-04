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

// ----------------------
// LOGGING
// ----------------------
console.log("🚀 Render bot started");

// ----------------------
// CREATE SHOPIFY ORDER
// ----------------------
async function createShopifyOrder(variantId, customer) {
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}

// ----------------------
// PROCESS QUEUE
// ----------------------
async function processQueue() {
  try {
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

    console.log(`📦 Found ${orders.length} pending orders`);

    for (const order of orders) {
      try {
        console.log("➡ Processing:", order.id);

        if (!order.shopify_variant_id) {
          console.log("❌ Missing variant ID");
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

        console.log("✅ Sent to Shopify:", order.id);
      } catch (err) {
        console.log("❌ Order failed:", order.id, err.message);
      }
    }
  } catch (err) {
    console.log("Process error:", err.message);
  }
}

// ----------------------
// RUN EVERY 20 SECONDS
// ----------------------
setInterval(processQueue, 20000);

// also run immediately on startup
processQueue();

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.send("Render bot running 🚀");
});

// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
