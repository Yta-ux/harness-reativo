import { createApp } from "./app/create-app";

const app = createApp();
const sub = app.invoice.total$.subscribe((total) => {
  console.log(`total: R$ ${(total / 100).toFixed(2)}`);
});

app.cart.addProduct({ id: "livro", priceCents: 4990 });
app.cart.addProduct({ id: "caneta", priceCents: 590 });
app.cart.removeProduct("caneta");

sub.unsubscribe();
