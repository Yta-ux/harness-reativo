import type { EventBus } from "../shared/event-bus";

export interface Product {
  readonly id: string;
  readonly priceCents: number;
}

/** Proactive module: announces what happened, never touches other modules. */
export class Cart {
  private readonly items = new Map<string, Product>();

  constructor(private readonly bus: EventBus) {}

  addProduct(product: Product): void {
    this.items.set(product.id, product);
    this.bus.emit({
      type: "ProductAdded",
      productId: product.id,
      priceCents: product.priceCents,
    });
  }

  removeProduct(productId: string): void {
    const product = this.items.get(productId);
    if (!product) return;
    this.items.delete(productId);
    this.bus.emit({
      type: "ProductRemoved",
      productId,
      priceCents: product.priceCents,
    });
  }
}
