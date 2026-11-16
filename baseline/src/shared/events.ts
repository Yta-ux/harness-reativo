/** Domain events are immutable facts. They are the ONLY contract between modules. */
export interface ProductAdded {
  readonly type: "ProductAdded";
  readonly productId: string;
  readonly priceCents: number;
}

export interface ProductRemoved {
  readonly type: "ProductRemoved";
  readonly productId: string;
  readonly priceCents: number;
}

export interface CouponApplied {
  readonly type: "CouponApplied";
  readonly code: string;
  readonly percent: number;
}

export interface CouponRejected {
  readonly type: "CouponRejected";
  readonly code: string;
  readonly reason: "UNKNOWN_CODE";
}

export type DomainEvent =
  | ProductAdded
  | ProductRemoved
  | CouponApplied
  | CouponRejected;
