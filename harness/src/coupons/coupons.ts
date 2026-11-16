import type { EventBus } from "../shared/event-bus";

const COUPON_PERCENTS: Readonly<Record<string, number>> = {
  DESC10: 10,
  DESC20: 20,
};

/** Proactive module: announces whether a coupon was accepted; Invoice reacts. */
export class Coupons {
  constructor(private readonly bus: EventBus) {}

  apply(code: string): void {
    const percent = Object.hasOwn(COUPON_PERCENTS, code)
      ? COUPON_PERCENTS[code]
      : undefined;
    if (percent === undefined) {
      this.bus.emit({ type: "CouponRejected", code, reason: "UNKNOWN_CODE" });
      return;
    }
    this.bus.emit({ type: "CouponApplied", code, percent });
  }
}
