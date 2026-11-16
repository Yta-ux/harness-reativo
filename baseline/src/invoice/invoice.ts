import {
  distinctUntilChanged,
  map,
  type Observable,
  scan,
  shareReplay,
  startWith,
} from "rxjs";
import type { DomainEvent } from "../shared/events";

export interface InvoiceSummary {
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly totalCents: number;
}

interface State {
  readonly subtotalCents: number;
  readonly percent: number;
}

const INITIAL: State = { subtotalCents: 0, percent: 0 };

function toSummary({ subtotalCents, percent }: State): InvoiceSummary {
  const discountCents = Math.floor((subtotalCents * percent) / 100);
  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}

/** Reactive module: derives its state from the event stream, nobody sets it. */
export class Invoice {
  readonly summary$: Observable<InvoiceSummary>;
  readonly total$: Observable<number>;

  constructor(events$: Observable<DomainEvent>) {
    this.summary$ = events$.pipe(
      scan((state, event): State => {
        switch (event.type) {
          case "ProductAdded":
            return {
              ...state,
              subtotalCents: state.subtotalCents + event.priceCents,
            };
          case "ProductRemoved":
            return {
              ...state,
              subtotalCents: state.subtotalCents - event.priceCents,
            };
          case "CouponApplied":
            return { ...state, percent: event.percent };
          default:
            return state;
        }
      }, INITIAL),
      startWith(INITIAL),
      map(toSummary),
      distinctUntilChanged(
        (a, b) =>
          a.subtotalCents === b.subtotalCents &&
          a.discountCents === b.discountCents &&
          a.totalCents === b.totalCents,
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.total$ = this.summary$.pipe(
      map((s) => s.totalCents),
      distinctUntilChanged(),
    );
  }
}
