import { Resonate } from "@resonatehq/sdk";
import { deliverFood, type Order } from "./workflow";

// ---------------------------------------------------------------------------
// Resonate setup
// ---------------------------------------------------------------------------

const resonate = new Resonate();
resonate.register(deliverFood);

// ---------------------------------------------------------------------------
// Run the delivery workflow
// ---------------------------------------------------------------------------
// In crash mode, the delivery step throws on the first attempt and Resonate
// automatically retries it. Watch the output: steps 1-4 execute exactly once,
// step 5 fails then retries, step 6 completes.
//
// This is the key insight: durable execution doesn't mean "restart from scratch."
// It means "resume from the last checkpoint."

const crashMidDelivery = process.argv.includes("--crash");

const order: Order = {
  id: `order-${Date.now()}`,
  restaurant: "Mario's Pizza",
  items: ["Margherita (large)", "Garlic bread"],
  customer: "Alice",
  address: "123 Main St",
};

console.log("=== Food Delivery Workflow ===");
console.log(
  `Mode: ${crashMidDelivery ? "CRASH (driver app fails on first delivery attempt, then recovers)" : "HAPPY PATH (end-to-end delivery)"}`,
);
console.log();

const result = await resonate.run(
  `delivery/${order.id}`,
  deliverFood,
  order,
  crashMidDelivery,
);

console.log("\n=== Result ===");
console.log(JSON.stringify(result, null, 2));
