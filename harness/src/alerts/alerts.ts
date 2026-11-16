import {
  distinctUntilChanged,
  filter,
  map,
  type Observable,
} from "rxjs";

export interface HighTotalAlert {
  readonly type: "HighTotal";
  readonly totalCents: number;
}

export const HIGH_TOTAL_THRESHOLD_CENTS = 50000;

/** Reactive module: fires once each time the total crosses above the threshold. */
export class Alerts {
  readonly alerts$: Observable<HighTotalAlert>;

  constructor(total$: Observable<number>) {
    this.alerts$ = total$.pipe(
      distinctUntilChanged(
        (a, b) =>
          a > HIGH_TOTAL_THRESHOLD_CENTS === b > HIGH_TOTAL_THRESHOLD_CENTS,
      ),
      filter((total) => total > HIGH_TOTAL_THRESHOLD_CENTS),
      map((totalCents): HighTotalAlert => ({ type: "HighTotal", totalCents })),
    );
  }
}
