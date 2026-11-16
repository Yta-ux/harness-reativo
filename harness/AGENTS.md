# AGENTS.md

Backend de eventos em TypeScript + RxJS. Paradigma: **programação reativa** —
módulos não se chamam, eles **emitem fatos** e **reagem a streams**.

## Antes de qualquer mudança
1. Leia `docs/architecture.md` (regras R1–R8) e `docs/recipes.md` (como fazer o comum).
2. Siga o mapa: `src/shared` (bus + eventos) · `src/<modulo>` (feature) · `src/app` (composition root).

## Definição de pronto (obrigatória)
```
pnpm validate     # typecheck + lint + arquitetura + testes
```
Só diga que terminou com `VALIDATE: OK` na saída. Cole a saída real. Se falhar,
corrija a causa (não desligue regra, não use `eslint-disable`, não use `any`).

## Regras duras (resumo — detalhes em docs/architecture.md)
- R1 módulos de feature **não importam** outros módulos; só `shared`.
- R2 `shared` não importa ninguém.
- R3 `Subject` só em `src/shared`. Fora dele, exponha `Observable`.
- R4 sem `subscribe` aninhado (use `switchMap`/`mergeMap`/`combineLatest`).
- R5 módulos **nunca** chamam `.subscribe`; só `src/app` assina.
- R6 só `src/index.ts` importa `src/app`.
- R7 eventos são `readonly`, ficam em `src/shared/events.ts` e entram na união `DomainEvent`.
- R8 sem métodos `setX` em módulos. Mudança chega como evento, não como chamada remota.

## Fluxo para nova feature
1. Escreva o teste primeiro (`tests/`), observando o stream.
2. Adicione o evento em `shared/events.ts`.
3. Crie `src/<modulo>/` expondo `Observable`s (e `emit` via `EventBus` se for produtor).
4. Ligue tudo em `src/app/create-app.ts`.
5. `pnpm validate`.

## Convenções
- Dinheiro em **centavos inteiros**.
- Código, identificadores e comentários em inglês.
- Erros de negócio viram **eventos** (ex.: `CouponRejected`), não `throw` dentro de stream.
- Streams derivados usam `shareReplay({ bufferSize: 1, refCount: true })` quando têm estado.
