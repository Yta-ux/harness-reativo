import type { EventBus } from "../shared/event-bus";

const COUPONS: Readonly<Record<string, number>> = {
  DESC10: 10,
  DESC20: 20,
};

/** Proactive module: validates a code and announces the outcome. */
export class Coupons {
  constructor(private readonly bus: EventBus) {}

  apply(code: string): void {
    const percent = Object.hasOwn(COUPONS, code) ? COUPONS[code] : undefined;
    if (percent === undefined) {
      this.bus.emit({ type: "CouponRejected", code, reason: "UNKNOWN_CODE" });
      return;
    }
    this.bus.emit({ type: "CouponApplied", code, percent });
  }
}
