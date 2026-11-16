import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/create-app";
import type { DomainEvent } from "../src/shared/events";
import type { InvoiceSummary } from "../src/invoice/invoice";

function setup() {
  const app = createApp();
  const events: DomainEvent[] = [];
  const summaries: InvoiceSummary[] = [];
  const totals: number[] = [];
  app.bus.events$.subscribe((e) => events.push(e));
  app.invoice.summary$.subscribe((s) => summaries.push(s));
  app.invoice.total$.subscribe((t) => totals.push(t));
  return { app, events, summaries, totals };
}

const last = <T>(xs: T[]) => xs[xs.length - 1];

describe("coupons", () => {
  it("DESC10 emits CouponApplied and discounts 10%", () => {
    const { app, events, summaries, totals } = setup();
    app.cart.addProduct({ id: "a", priceCents: 1005 });
    app.coupons.apply("DESC10");
    expect(last(events)).toEqual({ type: "CouponApplied", code: "DESC10", percent: 10 });
    expect(last(summaries)).toEqual({ subtotalCents: 1005, discountCents: 100, totalCents: 905 });
    expect(last(totals)).toBe(905);
  });

  it("DESC20 applies 20%", () => {
    const { app, summaries } = setup();
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    app.coupons.apply("DESC20");
    expect(last(summaries)).toEqual({ subtotalCents: 1000, discountCents: 200, totalCents: 800 });
  });

  it("a new valid coupon replaces the previous one", () => {
    const { app, summaries } = setup();
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    app.coupons.apply("DESC20");
    app.coupons.apply("DESC10");
    expect(last(summaries)?.totalCents).toBe(900);
  });

  it("invalid code does not throw, emits CouponRejected, keeps active coupon", () => {
    const { app, events, summaries } = setup();
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    app.coupons.apply("DESC20");
    expect(() => app.coupons.apply("NOPE")).not.toThrow();
    expect(last(events)).toEqual({ type: "CouponRejected", code: "NOPE", reason: "UNKNOWN_CODE" });
    expect(last(summaries)?.totalCents).toBe(800);
  });

  it("rejects prototype keys and wrong case", () => {
    const { app, events } = setup();
    app.coupons.apply("toString");
    app.coupons.apply("desc10");
    expect(events.map((e) => e.type)).toEqual(["CouponRejected", "CouponRejected"]);
  });

  it("coupon applied before products still counts", () => {
    const { app, summaries } = setup();
    app.coupons.apply("DESC10");
    app.cart.addProduct({ id: "a", priceCents: 2000 });
    expect(last(summaries)).toEqual({ subtotalCents: 2000, discountCents: 200, totalCents: 1800 });
  });

  it("removing a product recalculates", () => {
    const { app, summaries } = setup();
    app.coupons.apply("DESC10");
    app.cart.addProduct({ id: "a", priceCents: 1999 });
    app.cart.addProduct({ id: "b", priceCents: 1000 });
    app.cart.removeProduct("a");
    expect(last(summaries)).toEqual({ subtotalCents: 1000, discountCents: 100, totalCents: 900 });
  });

  it("discount uses floor with integer cents", () => {
    const { app, summaries } = setup();
    app.coupons.apply("DESC10");
    app.cart.addProduct({ id: "a", priceCents: 99 });
    expect(last(summaries)).toEqual({ subtotalCents: 99, discountCents: 9, totalCents: 90 });
  });

  it("total$ does not repeat when value is unchanged", () => {
    const { app, totals } = setup();
    app.coupons.apply("DESC10");
    app.coupons.apply("DESC10");
    app.coupons.apply("BAD");
    expect(totals).toEqual([0]);
  });
});
