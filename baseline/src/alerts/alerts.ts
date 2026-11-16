import {
  filter,
  map,
  type Observable,
  pairwise,
} from "rxjs";

export const HIGH_TOTAL_THRESHOLD_CENTS = 50000;

export interface HighTotalAlert {
  readonly type: "HighTotal";
  readonly totalCents: number;
}

/**
 * Reactive module: emits only when the total crosses the threshold upwards.
 * total$ replays the current value on subscribe; it serves as the baseline.
 */
export class Alerts {
  readonly alerts$: Observable<HighTotalAlert>;

  constructor(total$: Observable<number>) {
    this.alerts$ = total$.pipe(
      pairwise(),
      filter(
        ([prev, curr]) =>
          prev <= HIGH_TOTAL_THRESHOLD_CENTS &&
          curr > HIGH_TOTAL_THRESHOLD_CENTS,
      ),
      map(([, totalCents]): HighTotalAlert => ({ type: "HighTotal", totalCents })),
    );
  }
}
