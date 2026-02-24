import type { Context } from "@resonatehq/sdk";

// ---------------------------------------------------------------------------
// Food Delivery Steps
// ---------------------------------------------------------------------------
// Each function simulates one step of the delivery pipeline.
// They're called via ctx.run() so their results are checkpointed.
// On crash recovery, completed steps are skipped — results returned from storage.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Order {
  id: string;
  restaurant: string;
  items: string[];
  customer: string;
  address: string;
}

// Step 1: Place the order with the restaurant
export async function placeOrder(_ctx: Context, order: Order): Promise<string> {
  console.log(`[order]      Placing order ${order.id} at ${order.restaurant}...`);
  await sleep(300);
  console.log(`[order]      Order ${order.id} confirmed by restaurant`);
  return order.id;
}

// Step 2: Restaurant prepares the food
export async function prepareOrder(_ctx: Context, orderId: string): Promise<void> {
  console.log(`[kitchen]    Preparing order ${orderId}...`);
  await sleep(800);
  console.log(`[kitchen]    Order ${orderId} is ready for pickup`);
}

// Step 3: Find an available driver
export async function assignDriver(_ctx: Context, orderId: string): Promise<string> {
  console.log(`[dispatch]   Finding driver for order ${orderId}...`);
  await sleep(400);
  const driverId = `driver-${Math.floor(Math.random() * 900 + 100)}`;
  console.log(`[dispatch]   Driver ${driverId} assigned to order ${orderId}`);
  return driverId;
}

// Step 4: Driver picks up the order from the restaurant
export async function pickupOrder(
  _ctx: Context,
  orderId: string,
  driverId: string,
): Promise<void> {
  console.log(`[pickup]     Driver ${driverId} picking up order ${orderId}...`);
  await sleep(400);
  console.log(`[pickup]     Order ${orderId} picked up — en route to customer`);
}

// Track delivery attempts per order so we crash exactly once.
// This state lives in the process — Resonate retries the function in the
// same process, so on the second call the count is 2 and we succeed.
const deliveryAttempts = new Map<string, number>();

// Step 5: Driver delivers to the customer
export async function deliverOrder(
  _ctx: Context,
  orderId: string,
  driverId: string,
  crashMidDelivery: boolean,
): Promise<void> {
  const attempt = (deliveryAttempts.get(orderId) ?? 0) + 1;
  deliveryAttempts.set(orderId, attempt);

  console.log(
    `[delivery]   Driver ${driverId} delivering order ${orderId} (attempt ${attempt})...`,
  );
  await sleep(300);

  if (crashMidDelivery && attempt === 1) {
    // Simulate the driver app crashing mid-delivery.
    // Resonate checkpoints each step, so when it retries this function
    // we resume HERE — not from step 1. The order is not re-placed,
    // not re-cooked, not re-assigned. Only this step retries.
    throw new Error("Driver app connection lost");
  }

  console.log(`[delivery]   Order ${orderId} delivered to customer`);
}

// Step 6: Mark the order complete, release driver
export async function completeOrder(
  _ctx: Context,
  orderId: string,
  driverId: string,
): Promise<{ orderId: string; driverId: string; completedAt: string }> {
  console.log(`[complete]   Completing order ${orderId}, releasing driver ${driverId}...`);
  await sleep(200);
  const completedAt = new Date().toISOString();
  console.log(`[complete]   Order ${orderId} done at ${completedAt}`);
  return { orderId, driverId, completedAt };
}

// Compensation: Customer refund if order can't be fulfilled
export async function refundOrder(_ctx: Context, orderId: string): Promise<void> {
  console.log(`[refund]     Issuing refund for order ${orderId}...`);
  await sleep(300);
  console.log(`[refund]     Refund issued for order ${orderId}`);
}
