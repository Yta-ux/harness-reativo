# Receitas

## Novo evento
```ts
// shared/events.ts
export interface CouponApplied { readonly type: "CouponApplied"; readonly code: string; readonly percent: number }
export type DomainEvent = ProductAdded | ProductRemoved | CouponApplied;
```

## Módulo produtor (emite, não conhece ninguém)
```ts
export class Coupons {
  constructor(private readonly bus: EventBus) {}
  apply(code: string): void { this.bus.emit(/* CouponApplied | CouponRejected */); }
}
```

## Módulo reativo (deriva de stream)
```ts
export class Alerts {
  readonly alerts$: Observable<Alert>;
  constructor(total$: Observable<number>) {
    this.alerts$ = total$.pipe(map(isAbove), distinctUntilChanged(), filter(Boolean), map(toAlert));
  }
}
```
Receber `total$` por construtor (injeção) mantém R1: o módulo recebe um `Observable`, não importa `Invoice`.
O wiring `new Alerts(invoice.total$)` acontece só em `src/app/create-app.ts`.

## Testar stream
```ts
const out: number[] = [];
const sub = app.invoice.total$.subscribe((v) => out.push(v));
app.cart.addProduct(...);
sub.unsubscribe();
expect(out).toEqual([...]);
```
