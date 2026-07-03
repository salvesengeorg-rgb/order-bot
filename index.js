import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

// SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SHOPIFY
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

// store processed orders (prevents duplicates)
const processed = new Set();

console.log("🚀 Bot started");

// -------------------------------
// 1. SHOPIFY WEBHOOK ENDPOINT
// -------------------------------
app.post("/webhook/orders", async (req, res) => {
  try {
    const order = req.body;

    if (!order || processed.has(order.id)) {
      return res.sendStatus(200);
    }

    processed.add(order.id);

    console.log("🔥 NEW SHOPIFY ORDER");
    console.log("ID:", order.id);
    console.log("Email:", order.email);

    const item = order.line_items?.[0];

    // SAVE TO SUPABASE
    await supabase.from("orders").insert([
      {
        id: order.id,
        customer_name: order.customer?.first_name || "",
        email: order.email,
        product: item?.title,
        price: order.total_price,
        status: "paid"
      }
    ]);

    console.log("✅ Saved to Supabase");

    res.sendStatus(200);
  } catch (err) {
    console.log("Webhook error:", err.message);
    res.sendStatus(500);
  }
});

// -------------------------------
// 2. TEST ROUTE
// -------------------------------
app.get("/", (req, res) => {
  res.send("Order bot is running 🚀");
});

// -------------------------------
// 3. START SERVER
// -------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
