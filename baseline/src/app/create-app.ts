import { Alerts } from "../alerts/alerts";
import { Cart } from "../cart/cart";
import { Coupons } from "../coupons/coupons";
import { Invoice } from "../invoice/invoice";
import { EventBus } from "../shared/event-bus";

/** Composition root: the only place that knows every module. */
export function createApp() {
  const bus = new EventBus();
  const cart = new Cart(bus);
  const coupons = new Coupons(bus);
  const invoice = new Invoice(bus.events$);
  const alerts$ = new Alerts(invoice.total$).alerts$;
  return { bus, cart, coupons, invoice, alerts$ };
}

export type App = ReturnType<typeof createApp>;
