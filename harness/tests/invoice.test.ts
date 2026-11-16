import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app/create-app";

describe("cart -> invoice (reactive)", () => {
  it("starts at zero", async () => {
    const app = createApp();
    expect(await firstValueFrom(app.invoice.total$)).toBe(0);
  });

  it("total follows cart events without cart knowing invoice", () => {
    const app = createApp();
    const totals: number[] = [];
    const sub = app.invoice.total$.subscribe((t) => totals.push(t));
    app.cart.addProduct({ id: "a", priceCents: 1000 });
    app.cart.addProduct({ id: "b", priceCents: 500 });
    app.cart.removeProduct("a");
    sub.unsubscribe();
    expect(totals).toEqual([0, 1000, 1500, 500]);
  });
});
