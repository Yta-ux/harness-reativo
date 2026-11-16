import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/create-app";
import type { DomainEvent } from "../src/shared/events";

function collect<T>(obs: { subscribe: (fn: (v: T) => void) => { unsubscribe(): void } }) {
  const out: T[] = [];
  const sub = obs.subscribe((v) => {
    out.push(v);
  });
  return { out, stop: () => {
      sub.unsubscribe();
    },
  };
}

describe("coupons", () => {
  it("emits CouponApplied for valid codes and CouponRejected for unknown", () => {
    const app = createApp();
    const { out, stop } = collect<DomainEvent>(app.bus.events$);
    app.coupons.apply("DESC10");
    app.coupons.apply("NOPE");
    app.coupons.apply("desc10");
    stop();
    expect(out).toEqual([
      { type: "CouponApplied", code: "DESC10", percent: 10 },
      { type: "CouponRejected", code: "NOPE", reason: "UNKNOWN_CODE" },
      { type: "CouponRejected", code: "desc10", reason: "UNKNOWN_CODE" },
    ]);
  });

  it("rejects prototype keys without throwing", () => {
    const app = createApp();
    const { out, stop } = collect<DomainEvent>(app.bus.events$);
    expect(() => {
      app.coupons.apply("constructor");
    }).not.toThrow();
    stop();
    expect(out).toEqual([
      { type: "CouponRejected", code: "constructor", reason: "UNKNOWN_CODE" },
    ]);
  });

  it("applies discount to total and summary", () => {
    const app = createApp();
    const totals = collect<number>(app.invoice.total$);
    const sums = collect(app.invoice.summary$);
    app.cart.addProduct({ id: "a", priceCents: 1999 });
    app.coupons.apply("DESC10");
    totals.stop();
    sums.stop();
    expect(totals.out).toEqual([0, 1999, 1800]);
    expect(sums.out.at(-1)).toEqual({
      subtotalCents: 1999,
      discountCents: 199,
      totalCents: 1800,
    });
  });

  it("coupon applied before products also counts", () => {
    const app = createApp();
    const sums = collect(app.invoice.summary$);
    app.coupons.apply("DESC20");
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    sums.stop();
    expect(sums.out.at(-1)).toEqual({
      subtotalCents: 1000,
      discountCents: 200,
      totalCents: 800,
    });
  });

  it("new valid coupon replaces previous; invalid keeps active", () => {
    const app = createApp();
    const totals = collect<number>(app.invoice.total$);
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    app.coupons.apply("DESC10");
    app.coupons.apply("BAD");
    app.coupons.apply("DESC20");
    totals.stop();
    expect(totals.out).toEqual([0, 1000, 900, 800]);
  });

  it("removing a product recalculates with discount", () => {
    const app = createApp();
    const sums = collect(app.invoice.summary$);
    app.coupons.apply("DESC10");
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    app.cart.addProduct({ id: "b", priceCents: 500 });
    app.cart.removeProduct("a");
    sums.stop();
    expect(sums.out.at(-1)).toEqual({
      subtotalCents: 500,
      discountCents: 50,
      totalCents: 450,
    });
  });
});

describe("high total alert", () => {
  it("fires on crossing > 50000, not at exactly 50000, no repeats, rearms", () => {
    const app = createApp();
    const alerts = collect(app.alerts$);
    app.cart.addProduct({ id: "a", priceCents: 50000 });
    expect(alerts.out).toEqual([]);
    app.cart.addProduct({ id: "b", priceCents: 1 });
    app.cart.addProduct({ id: "c", priceCents: 10 });
    expect(alerts.out).toEqual([{ type: "HighTotal", totalCents: 50001 }]);
    app.cart.removeProduct("b");
    app.cart.removeProduct("c");
    app.cart.addProduct({ id: "d", priceCents: 100 });
    alerts.stop();
    expect(alerts.out).toEqual([
      { type: "HighTotal", totalCents: 50001 },
      { type: "HighTotal", totalCents: 50100 },
    ]);
  });

  it("uses total after discount, and coupon can drop/raise across threshold", () => {
    const app = createApp();
    const alerts = collect(app.alerts$);
    app.cart.addProduct({ id: "a", priceCents: 60000 });
    expect(alerts.out).toHaveLength(1);
    app.coupons.apply("DESC20"); // 48000 -> below
    app.cart.addProduct({ id: "b", priceCents: 3000 }); // 63000*0.8=50400 -> cross
    alerts.stop();
    expect(alerts.out).toEqual([
      { type: "HighTotal", totalCents: 60000 },
      { type: "HighTotal", totalCents: 50400 },
    ]);
  });

  it("does not alert when discount keeps total at or below threshold", () => {
    const app = createApp();
    const alerts = collect(app.alerts$);
    app.coupons.apply("DESC20");
    app.cart.addProduct({ id: "a", priceCents: 62500 }); // 50000
    alerts.stop();
    expect(alerts.out).toEqual([]);
  });
});
