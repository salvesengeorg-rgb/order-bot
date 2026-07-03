import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// keeps track of processed orders so no duplicates
let processedOrders = new Set();

async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "paid");

  if (error) {
    console.log("Supabase error:", error.message);
    return;
  }

  if (!data) return;

  for (const order of data) {
    if (processedOrders.has(order.id)) continue;

    processedOrders.add(order.id);

    console.log("🔥 NEW ORDER DETECTED");
    console.log("ID:", order.id);
    console.log("Customer:", order.customer_name);
    console.log("Email:", order.email);
    console.log("Address:", order.address);
    console.log("Product:", order.product);
    console.log("Price:", order.price);

    // NEXT STEP (later): send to DSers / AliExpress
  }
}

// run every 5 seconds
setInterval(fetchOrders, 5000);

console.log("🚀 Order bot is running...");
