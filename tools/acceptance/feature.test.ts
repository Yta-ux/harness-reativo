// Hidden acceptance tests: the agent never sees this file. Same file runs on both variants.
import { Subscription } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app/create-app";

type Summary = { subtotalCents: number; discountCents: number; totalCents: number };
// biome-ignore lint: loose on purpose, contract is checked structurally
type AnyApp = any;

const subs: Subscription[] = [];
afterEach(() => { subs.splice(0).forEach((s) => s.unsubscribe()); });

function setup() {
  const app: AnyApp = createApp();
  const summaries: Summary[] = [];
  const totals: number[] = [];
  const alerts: { type: string; totalCents: number }[] = [];
  const events: { type: string; [k: string]: unknown }[] = [];
  subs.push(app.invoice.summary$.subscribe((s: Summary) => summaries.push(s)));
  subs.push(app.invoice.total$.subscribe((t: number) => totals.push(t)));
  subs.push(app.alerts$.subscribe((a: { type: string; totalCents: number }) => alerts.push(a)));
  subs.push(app.bus.events$.subscribe((e: { type: string }) => events.push(e)));
  const last = () => summaries[summaries.length - 1];
  return { app, summaries, totals, alerts, events, last };
}

describe("coupon + high total alert", () => {
  it("summary without coupon has zero discount", () => {
    const { app, last } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    expect(last()).toEqual({ subtotalCents: 10000, discountCents: 0, totalCents: 10000 });
  });

  it("DESC10 gives 10% off", () => {
    const { app, last, totals } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    app.coupons.apply("DESC10");
    expect(last()).toEqual({ subtotalCents: 10000, discountCents: 1000, totalCents: 9000 });
    expect(totals[totals.length - 1]).toBe(9000);
  });

  it("DESC20 gives 20% off", () => {
    const { app, last } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    app.coupons.apply("DESC20");
    expect(last().totalCents).toBe(8000);
  });

  it("a new valid coupon replaces the previous one (no stacking)", () => {
    const { app, last } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    app.coupons.apply("DESC10");
    app.coupons.apply("DESC20");
    expect(last()).toEqual({ subtotalCents: 10000, discountCents: 2000, totalCents: 8000 });
  });

  it("emits CouponApplied with code and percent", () => {
    const { app, events } = setup();
    app.coupons.apply("DESC10");
    expect(events).toContainEqual({ type: "CouponApplied", code: "DESC10", percent: 10 });
  });

  it("invalid coupon emits CouponRejected, does not throw, keeps total", () => {
    const { app, last, events } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    expect(() => app.coupons.apply("NOPE")).not.toThrow();
    expect(events).toContainEqual({ type: "CouponRejected", code: "NOPE", reason: "UNKNOWN_CODE" });
    expect(last().totalCents).toBe(10000);
  });

  it("an invalid coupon does not cancel an active one", () => {
    const { app, last } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    app.coupons.apply("DESC10");
    app.coupons.apply("NOPE");
    expect(last().totalCents).toBe(9000);
  });

  it("coupon applied before any product still applies", () => {
    const { app, last } = setup();
    app.coupons.apply("DESC20");
    app.cart.addProduct({ id: "a", priceCents: 5000 });
    expect(last()).toEqual({ subtotalCents: 5000, discountCents: 1000, totalCents: 4000 });
  });

  it("discount is floored to integer cents", () => {
    const { app, last } = setup();
    app.coupons.apply("DESC10");
    app.cart.addProduct({ id: "a", priceCents: 999 });
    expect(last()).toEqual({ subtotalCents: 999, discountCents: 99, totalCents: 900 });
  });

  it("removing a product recalculates with the active coupon", () => {
    const { app, last } = setup();
    app.cart.addProduct({ id: "a", priceCents: 10000 });
    app.cart.addProduct({ id: "b", priceCents: 10000 });
    app.coupons.apply("DESC10");
    app.cart.removeProduct("a");
    expect(last()).toEqual({ subtotalCents: 10000, discountCents: 1000, totalCents: 9000 });
  });

  it("alert fires once when total crosses 50000", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 30000 });
    expect(alerts).toHaveLength(0);
    app.cart.addProduct({ id: "b", priceCents: 30000 });
    expect(alerts).toEqual([{ type: "HighTotal", totalCents: 60000 }]);
    app.cart.addProduct({ id: "c", priceCents: 1000 });
    expect(alerts).toHaveLength(1);
  });

  it("alert does not fire at exactly 50000", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 50000 });
    expect(alerts).toHaveLength(0);
  });

  it("alert re-arms after dropping below and fires again on a new crossing", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 60000 });
    app.cart.removeProduct("a");
    app.cart.addProduct({ id: "b", priceCents: 70000 });
    expect(alerts).toEqual([
      { type: "HighTotal", totalCents: 60000 },
      { type: "HighTotal", totalCents: 70000 },
    ]);
  });

  it("alert considers total AFTER discount", () => {
    const { app, alerts } = setup();
    app.coupons.apply("DESC20");
    app.cart.addProduct({ id: "a", priceCents: 60000 }); // 48000 after discount
    expect(alerts).toHaveLength(0);
  });

  it("applying a coupon that drops total below threshold re-arms the alert", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 55000 }); // alert #1
    app.coupons.apply("DESC10"); // 49500, below
    app.coupons.apply("DESC20"); // 44000
    app.cart.addProduct({ id: "b", priceCents: 20000 }); // 75000*0.8=60000 -> alert #2
    expect(alerts.map((a) => a.totalCents)).toEqual([55000, 60000]);
  });

  it("two independent apps do not share state", () => {
    const a = setup();
    const b = setup();
    a.app.cart.addProduct({ id: "x", priceCents: 1000 });
    expect(b.totals[b.totals.length - 1]).toBe(0);
  });
});
