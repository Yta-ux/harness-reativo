import { createApp } from "./app/create-app";

const app = createApp();
const brl = (cents: number): string => `R$ ${(cents / 100).toFixed(2)}`;

// The only place that subscribes: print every reaction as it happens.
const subs = [
  app.invoice.total$.subscribe((total) => {
    console.log(`→ total: ${brl(total)}`);
  }),
  app.alerts$.subscribe((alert) => {
    console.log(`⚠ ALERTA: total acima de R$ 500 (${brl(alert.totalCents)})`);
  }),
  app.bus.events$.subscribe((event) => {
    if (event.type === "CouponRejected") {
      console.log(`✖ cupom ${event.code} rejeitado (${event.reason})`);
    }
  }),
];

const step = (label: string, action: () => void): void => {
  console.log(`\n${label}`);
  action();
};

step("+ livro (R$ 49,90)", () => {
  app.cart.addProduct({ id: "livro", priceCents: 4990 });
});
step("+ caneta (R$ 5,90)", () => {
  app.cart.addProduct({ id: "caneta", priceCents: 590 });
});
step("- remove a caneta", () => {
  app.cart.removeProduct("caneta");
});
step("cupom INVALIDO", () => {
  app.coupons.apply("INVALIDO");
});
step("cupom DESC10 (10%)", () => {
  app.coupons.apply("DESC10");
});
step("+ monitor (R$ 600,00)", () => {
  app.cart.addProduct({ id: "monitor", priceCents: 60000 });
});
step("- remove o monitor", () => {
  app.cart.removeProduct("monitor");
});

subs.forEach((s) => {
  s.unsubscribe();
});
