import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/create-app";

function setup() {
  const app = createApp();
  const alerts: unknown[] = [];
  app.alerts$.subscribe((a) => alerts.push(a));
  return { app, alerts };
}

describe("alerts$ HighTotal", () => {
  it("does not alert at exactly 50000", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 50000 });
    expect(alerts).toEqual([]);
  });

  it("alerts when crossing above 50000", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 50001 });
    expect(alerts).toEqual([{ type: "HighTotal", totalCents: 50001 }]);
  });

  it("does not repeat while staying above", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 60000 });
    app.cart.addProduct({ id: "b", priceCents: 1000 });
    expect(alerts).toHaveLength(1);
  });

  it("rearms after dropping to <= 50000 and crossing again", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 60000 });
    app.cart.removeProduct("a");
    app.cart.addProduct({ id: "b", priceCents: 70000 });
    expect(alerts).toEqual([
      { type: "HighTotal", totalCents: 60000 },
      { type: "HighTotal", totalCents: 70000 },
    ]);
  });

  it("uses the discounted total", () => {
    const { app, alerts } = setup();
    app.coupons.apply("DESC20");
    app.cart.addProduct({ id: "a", priceCents: 60000 }); // 48000
    expect(alerts).toEqual([]);
    app.cart.addProduct({ id: "b", priceCents: 10000 }); // 56000
    expect(alerts).toEqual([{ type: "HighTotal", totalCents: 56000 }]);
  });

  it("applying a coupon can drop below and re-cross", () => {
    const { app, alerts } = setup();
    app.cart.addProduct({ id: "a", priceCents: 60000 });
    app.coupons.apply("DESC20"); // 48000, rearm
    expect(alerts).toHaveLength(1);
    app.cart.addProduct({ id: "b", priceCents: 10000 }); // 56000
    expect(alerts).toHaveLength(2);
  });
});
