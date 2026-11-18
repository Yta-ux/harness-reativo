# Harness para agentes de IA — Programação Reativa

Backend orientado a eventos (TypeScript + RxJS) com um **harness** em volta:
instruções para o agente, regras de arquitetura, lint, testes e um script de
validação. A mesma funcionalidade foi implementada **com** e **sem** o harness,
e as duas versões são comparadas.

## O projeto

Um carrinho de compras com cupons de desconto, sem servidor nem frontend (roda
no terminal). Dinheiro em centavos inteiros.

| Módulo | Faz |
|---|---|
| `cart` | adiciona e remove produtos |
| `coupons` | aplica cupom (`DESC10` = 10%, `DESC20` = 20%); código inválido emite `CouponRejected` |
| `invoice` | calcula subtotal, desconto e total |
| `alerts` | avisa quando o total passa de R$ 500 |
| `shared` | eventos e `EventBus` |
| `app` | `createApp()`, liga os módulos |

Os módulos **não chamam uns aos outros**: quem muda algo emite um evento e quem
precisa reage ao stream.

```
Cart ──emit──►  EventBus ──events$──► Invoice ──total$──► Alerts
Coupons ─emit─►
```

Para ver rodando:

```bash
cd harness
pnpm dlx tsx src/index.ts
```

## O harness

O código de negócio é o mesmo em `harness/` e `baseline/`. O que `harness/` tem a mais:

| O quê | Arquivo |
|---|---|
| Instruções para o agente | `AGENTS.md`, `CLAUDE.md` |
| Regras e receitas | `docs/architecture.md`, `docs/recipes.md` |
| Lint (R3, R4, R5, R7, R8) | `eslint.config.js` |
| Fronteiras entre módulos (R1, R2, R6) | `.dependency-cruiser.cjs` |
| Gate único | `scripts/validate.sh` (`pnpm validate`) |
| Teste do próprio harness | `scripts/verify-harness.sh` + `fixtures/` |

### Regras

| Id | Regra | Aplicada por |
|----|-------|--------------|
| R1 | Módulos de feature não importam outros módulos (só `shared`) | dependency-cruiser |
| R2 | `shared` não importa módulos nem `app` | dependency-cruiser |
| R3 | `Subject` só em `src/shared`; fora, expor `Observable` | ESLint |
| R4 | Sem `subscribe` dentro de `subscribe` | ESLint |
| R5 | Módulos nunca chamam `.subscribe`; só a borda assina | ESLint |
| R6 | Só `src/index.ts` importa `src/app` | dependency-cruiser |
| R7 | Eventos imutáveis (`readonly`) em `shared/events.ts` | ESLint |
| R8 | Sem métodos `setX` nos módulos | ESLint |

Cada erro de lint diz a regra e como corrigir, por exemplo:
`R8: no setters. State changes arrive as events on the stream`.

> A R7 foi a última a ganhar checagem automática. Antes ficou fora do `validate`
> porque o `tsc` só impede alterar um campo já `readonly`, não obriga a declarar
> `readonly`, então dependia de revisão humana. Hoje é um seletor do ESLint.

### `pnpm validate`

Roda, sem parar na primeira falha: `tsc --noEmit`, `eslint`, `depcruise` e
`vitest`. Termina em `VALIDATE: OK` ou `VALIDATE: FAILED`. O `AGENTS.md` define
que o agente só pode dizer que terminou com `VALIDATE: OK`.

### `pnpm verify-harness`

Para cada arquivo de `fixtures/` (uma violação por regra), copia a violação para
`src/`, roda ESLint + dependency-cruiser, confere que a regra apareceu e apaga o
arquivo.

```
✔ R1 ... ✔ R2 ... ✔ R3 ... ✔ R4 ... ✔ R5 ... ✔ R6 ... ✔ R7 ... ✔ R8
harness pegou 8/8 violações
```

## Com × sem harness

- **`baseline/`**: o mesmo código, só com `tsc` e `vitest`.
- **`harness/`**: o código + tudo da seção anterior.

**Código ruim nas duas versões.** Colocando o mesmo arquivo imperativo (um
`Subject` solto, um `setTotal` e um `subscribe` aninhado) em `src/invoice/bad.ts`:

| | Sem harness | Com harness |
|---|---|---|
| `tsc` e testes | passam | passam |
| Resultado | aceita o código ruim | `VALIDATE: FAILED` (R3, R3, R8, R5, R5) |

**A mesma feature pedida a um agente** (cupom de desconto + alerta de total
alto; prompt e métricas em [`EXPERIMENTO.md`](EXPERIMENTO.md)). Um árbitro
(`tools/measure.mjs`) mede as duas pastas igual: erros de tipo, testes, 16 testes
de aceitação ocultos e violações das regras (scanner próprio, independente do
ESLint do harness).

| Métrica | Sem harness | Com harness |
|---|---|---|
| Erros de tipo | 0 | 0 |
| Aceitação (16 testes) | 16/16 | 16/16 |
| Violações arquiteturais | 0 | 0 |
| `any` / supressões | 0 / 0 | 0 / 0 |
| Auto-correções pelo gate | n/a | 2 (lint de estilo) |

Resultado: **empate** nessa feature. O código inicial já mostra o padrão, então o
agente sem harness só o copiou. A diferença aparece quando alguém toma o atalho
imperativo: o baseline aceita, o harness barra. JSONs em [`results/`](results/).

Limitações: uma amostra, uma feature fácil, um modelo. O scanner do árbitro ainda
não conta violações da R7.

## Estrutura

```
harness-reativo/
├── harness/     app COM harness (src, tests, AGENTS.md, docs, eslint, depcruise, scripts, fixtures)
├── baseline/    MESMO código, SEM harness
├── tools/       árbitro (measure.mjs + testes de aceitação)
├── results/     medições em JSON
└── EXPERIMENTO.md
```

`harness/`, `baseline/` e `tools/` são projetos independentes, cada um com seu
`package.json` e `pnpm-lock.yaml`. Nada é compartilhado entre as duas variantes.

## Como rodar

Requisitos: Node.js >= 20 e pnpm 10.

```bash
pnpm install:all          # instala as três apps

pnpm validate             # gate do harness
pnpm verify-harness       # 8/8 violações pegas
pnpm measure:baseline     # árbitro na versão sem harness
pnpm measure:harness      # árbitro na versão com harness
```

Dentro de cada pasta: `pnpm typecheck`, `pnpm test` e, no `harness/`, `pnpm lint`
e `pnpm arch`.

> O pnpm 10 pode avisar `Ignored build scripts: esbuild`. É inofensivo aqui.
