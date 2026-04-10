import type { Context } from "@resonatehq/sdk";
import {
  placeOrder,
  prepareOrder,
  assignDriver,
  pickupOrder,
  deliverOrder,
  completeOrder,
  refundOrder,
  type Order,
} from "./steps";

export type { Order } from "./steps";

// ---------------------------------------------------------------------------
// Food Delivery Workflow
// ---------------------------------------------------------------------------
// Models a complete food delivery pipeline:
//   placed → prepared → driver assigned → picked up → delivered → complete
//
// Every yield* is a durable checkpoint. If anything crashes between steps —
// the delivery driver's phone dies, the orchestration server restarts,
// a network partition happens — the workflow resumes from the last checkpoint.
//
// In Temporal, each step would be a separate registered Activity with timeout
// configuration. Signals would be used for driver updates. In Resonate, this
// is just sequential code.

export type DeliveryStatus =
  | "success"
  | "failed_no_driver"
  | "failed_undeliverable";

export interface DeliveryResult {
  status: DeliveryStatus;
  orderId: string;
  driverId?: string;
  completedAt?: string;
  error?: string;
}

export function* deliverFood(
  ctx: Context,
  order: Order,
  crashMidDelivery: boolean,
): Generator<any, DeliveryResult, any> {
  // Step 1: Place order
  const orderId = yield* ctx.run(placeOrder, order);

  // Step 2: Prepare food
  yield* ctx.run(prepareOrder, orderId);

  // Step 3: Assign driver
  let driverId: string;
  try {
    driverId = yield* ctx.run(assignDriver, orderId);
  } catch {
    // No driver available — refund and abort
    yield* ctx.run(refundOrder, orderId);
    return { status: "failed_no_driver", orderId, error: "No drivers available" };
  }

  // Step 4: Pickup
  yield* ctx.run(pickupOrder, orderId, driverId);

  // Step 5: Deliver
  // This step retries automatically on failure (e.g. driver app crash).
  // When the process restarts, Resonate replays steps 1-4 from checkpoints
  // and resumes here. The food is not re-cooked. The driver is not re-assigned.
  yield* ctx.run(deliverOrder, orderId, driverId, crashMidDelivery);

  // Step 6: Complete
  const result = yield* ctx.run(completeOrder, orderId, driverId);

  return {
    status: "success",
    orderId: result.orderId,
    driverId: result.driverId,
    completedAt: result.completedAt,
  };
}
