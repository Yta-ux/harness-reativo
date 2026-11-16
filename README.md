# Harness para agentes de IA em Programação Reativa

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

Projeto da disciplina de Paradigmas de Linguagem de Programação (PLP). Mostra como
um **harness** (instruções, regras arquiteturais executáveis e um comando de
validação) guia um agente de IA em um backend **orientado a eventos** escrito em
TypeScript + RxJS, e **mede** o que muda com e sem harness.

- [O que é um harness](#o-que-é-um-harness)
- [Conceito: programação reativa](#conceito-programação-reativa)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Requisitos e instalação](#requisitos-e-instalação)
- [Como rodar](#como-rodar)
- [A aplicação de exemplo](#a-aplicação-de-exemplo)
- [As regras R1–R8](#as-regras-r1r8)
- [Como o harness funciona](#como-o-harness-funciona)
- [O experimento (com × sem harness)](#o-experimento-com--sem-harness)
- [Resultados](#resultados)
- [Limitações](#limitações)
- [CI](#ci)
- [Solução de problemas](#solução-de-problemas)

---

## O que é um harness

Um agente de IA escreve código plausível, mas sem restrições ele tende a tomar o
caminho mais curto, que em programação reativa é voltar ao estilo imperativo
(setters, `subscribe` aninhado, `Subject` espalhado pelo código). O **harness** é
tudo que fica em volta do agente para impedir isso:

| Peça | Onde | Papel |
|---|---|---|
| Instruções | `harness/AGENTS.md`, `harness/CLAUDE.md` | Dizem o que ler, o fluxo de trabalho e a definição de "pronto" |
| Regras escritas | `harness/docs/` | Arquitetura (R1–R8) e receitas de como fazer o comum |
| Regras executáveis | `eslint.config.js`, `.dependency-cruiser.cjs` | Transformam a regra em erro de build, com mensagem que diz a correção |
| Gate único | `pnpm validate` | Typecheck + lint + arquitetura + testes. Só vale "pronto" com `VALIDATE: OK` |
| Teste do harness | `pnpm verify-harness` | Planta 1 violação por regra e confere que o harness acusa cada uma |

## Conceito: programação reativa

Base: slides "Paradigma orientado a eventos" (UFAL).

**Imperativo ("este muda esse")**: o Carrinho chama `fatura.atualiza()`. O Carrinho
precisa saber quem depende dele.

**Reativo**: o módulo que muda só **emite um evento** (um fato imutável). Quem
depende **observa o stream** (padrão Observer) e deriva seu estado com operadores.
Ninguém conhece ninguém.

```
        emit(event)                 events$ (Observable)
 Cart ───────────────►  EventBus  ───────────────────────► Invoice / Coupons / Alerts
 (sink)                 (único Subject)     pipe(filter, scan, map, ...) = operadores
                                                   ▲
                                       src/app/create-app.ts
                                       (composition root: liga tudo)
```

Os três conceitos dos slides mapeados no código:

| Conceito | No código |
|---|---|
| **Sink** (quem emite) | `EventBus.emit()`, usado por `Cart` e `Coupons` |
| **Stream** (quem é observado) | `EventBus.events$`, `Invoice.total$`, `Alerts.alerts$` (todos `Observable`) |
| **Operadores** (transformam o fluxo) | `scan`, `map`, `filter`, `distinctUntilChanged`, `shareReplay` |

## Estrutura do repositório

```
harness-reativo/
├── harness/                  app COM harness
│   ├── AGENTS.md             instruções para o agente (fluxo + definição de pronto)
│   ├── CLAUDE.md             aponta para o AGENTS.md (é assim que o agente descobre o harness)
│   ├── docs/
│   │   ├── architecture.md   regras R1–R8, camadas, tratamento de erro
│   │   └── recipes.md        receitas: novo evento, módulo produtor/reativo, testar stream
│   ├── eslint.config.js      R3, R4, R5, R8 (+ typescript-eslint strict)
│   ├── .dependency-cruiser.cjs  R1, R2, R6 (+ sem ciclos)
│   ├── scripts/
│   │   ├── validate.sh       gate único
│   │   └── verify-harness.sh teste do próprio harness
│   ├── fixtures/             1 arquivo-violação por regra (usados pelo verify-harness)
│   ├── src/                  código da aplicação
│   └── tests/                testes do agente/dev
├── baseline/                 MESMO código, SEM harness (só tsc + vitest)
├── tools/                    árbitro: mede as duas apps do mesmo jeito
│   ├── measure.mjs
│   └── acceptance/feature.test.ts   16 testes de aceitação "ocultos"
├── results/                  saída JSON das medições (baseline.json, harness.json)
├── .github/workflows/ci.yml  CI
├── EXPERIMENTO.md            protocolo, prompt e métricas
└── package.json              atalhos na raiz
```

**Isolamento:** `harness/`, `baseline/` e `tools/` são projetos independentes.
Cada um tem seu `package.json`, seu `pnpm-lock.yaml` e seu `node_modules`. Não há
`pnpm-workspace.yaml` de propósito: nada é compartilhado entre as duas variantes
do experimento. A raiz só tem atalhos de script, sem dependências.

## Requisitos e instalação

- **Node.js** >= 20 (testado em 22)
- **pnpm** 10 (`corepack enable` ou `npm i -g pnpm`). A versão está fixada em
  `packageManager`.

```bash
git clone <url-do-repo>
cd harness-reativo

# instala as três apps (cada uma com seu lockfile)
pnpm install:all
# ou, individualmente:
pnpm -C harness install
pnpm -C baseline install
pnpm -C tools install
```

> O pnpm 10 não roda scripts de build de dependências por padrão. Pode aparecer o
> aviso `Ignored build scripts: esbuild`. É inofensivo aqui: o `vitest` funciona
> sem rodar o script de pós-instalação do esbuild.

## Como rodar

### Pela raiz

| Comando | O que faz |
|---|---|
| `pnpm install:all` | instala `harness`, `baseline` e `tools` |
| `pnpm validate` | gate do harness: typecheck + lint + arquitetura + testes |
| `pnpm verify-harness` | prova que cada regra pega sua violação (7/7) |
| `pnpm measure:baseline` | árbitro mede a app sem harness |
| `pnpm measure:harness` | árbitro mede a app com harness |

### Dentro de cada app

```bash
cd harness
pnpm validate           # tudo de uma vez; termina em "VALIDATE: OK" ou "VALIDATE: FAILED"
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint src tests --max-warnings 0
pnpm arch               # dependency-cruiser (R1, R2, R6)
pnpm test               # vitest run
pnpm verify-harness     # meta-teste do harness

cd ../baseline
pnpm typecheck
pnpm test

cd ../tools
pnpm measure ../harness        # mede qualquer pasta de app
node measure.mjs ../baseline --json   # saída em JSON
```

Saída esperada de `pnpm verify-harness`:

```
✔ R1 pego  (R1-import-entre-modulos.ts)
✔ R2 pego  (R2-shared-importa-modulo.ts)
✔ R3 pego  (R3-subject-fora-do-shared.ts)
✔ R4 pego  (R4-subscribe-aninhado.ts)
✔ R5 pego  (R5-subscribe-em-modulo.ts)
✔ R6 pego  (R6-importa-app.ts)
✔ R8 pego  (R8-metodo-setter.ts)

harness pegou 7/7 violações
código limpo: validate OK
```

(R7 não aparece: eventos `readonly` são garantidos por revisão + `tsc`, não por
ferramenta dedicada.)

### Ver uma regra falhar na prática

```bash
cd harness
cp fixtures/R8-metodo-setter.ts src/invoice/bad.ts
sed -i '1,2d' src/invoice/bad.ts     # remove as 2 linhas de comentário de controle
pnpm validate                        # falha com a mensagem "R8: no setters. ..."
rm src/invoice/bad.ts
```

## A aplicação de exemplo

Um carrinho de compras com fatura, cupons e alerta de total alto. Dinheiro é
sempre em **centavos inteiros**.

| Módulo | Tipo | Faz |
|---|---|---|
| `shared/events.ts` | contrato | Eventos imutáveis: `ProductAdded`, `ProductRemoved`, `CouponApplied`, `CouponRejected` (união `DomainEvent`) |
| `shared/event-bus.ts` | infra | Único `Subject` do sistema. Expõe `emit()` (sink) e `events$` (stream) |
| `cart` | produtor | `addProduct`, `removeProduct`. Só emite eventos |
| `coupons` | produtor | `apply(code)`. `DESC10` = 10%, `DESC20` = 20%. Código inválido **não lança**: emite `CouponRejected` |
| `invoice` | reativo | Deriva `summary$` (`subtotalCents`, `discountCents`, `totalCents`) e `total$` via `scan` sobre `events$` |
| `alerts` | reativo | `alerts$` emite `{ type: "HighTotal", totalCents }` quando o total cruza de `<= 50000` para `> 50000`; rearma ao cair |
| `app/create-app.ts` | composition root | Único lugar que conhece todos os módulos e os liga |
| `index.ts` | entrada | Único lugar com `subscribe` "de verdade" + `console.log` |

Uso:

```ts
import { createApp } from "./app/create-app";

const app = createApp();
app.invoice.summary$.subscribe((s) => console.log(s));
app.alerts$.subscribe((a) => console.log("ALERTA", a));

app.coupons.apply("DESC10");
app.cart.addProduct({ id: "monitor", priceCents: 60000 });
// summary: { subtotalCents: 60000, discountCents: 6000, totalCents: 54000 }
// ALERTA { type: "HighTotal", totalCents: 54000 }
```

Regras de negócio relevantes:

- Só um cupom ativo por vez; um cupom válido novo substitui o anterior.
- Desconto = `floor(subtotal * percent / 100)`.
- Cupom aplicado antes dos produtos também vale.
- Remover produto recalcula o total.
- O alerta não repete enquanto o total continuar acima do limite.

## As regras R1–R8

| Id | Regra | Enforcement | Por quê |
|----|-------|-------------|---------|
| R1 | Módulos de feature não importam outros módulos (só `shared`) | dependency-cruiser | Módulo passivo "não está ciente da dependência" |
| R2 | `shared` é folha: não importa módulos nem `app` | dependency-cruiser | O contrato de eventos não depende de implementação |
| R3 | `Subject` e variantes só em `src/shared`; fora, expor `Observable` | ESLint | Sink é privado, stream é público |
| R4 | Sem `subscribe` dentro de `subscribe` | ESLint | Compor com operadores (`switchMap`, `combineLatest`), não com callbacks |
| R5 | Módulos nunca chamam `.subscribe` | ESLint | Efeito colateral fica na borda (composition root) |
| R6 | Só `src/index.ts` importa `src/app` | dependency-cruiser | Evita ciclo e acesso ao wiring |
| R7 | Eventos imutáveis (`readonly`) em `shared/events.ts` | revisão + tsc | Eventos são fatos |
| R8 | Sem métodos `setX` em módulos | ESLint | "Setters e updates remotos" = programação passiva |
| — | Sem ciclos | dependency-cruiser | |
| — | Sem `any`, sem promise solta | typescript-eslint strict | |

Detalhes e justificativa teórica em [`harness/docs/architecture.md`](harness/docs/architecture.md).

## Como o harness funciona

1. O agente abre o projeto e lê `CLAUDE.md`, que manda ler `AGENTS.md`.
2. `AGENTS.md` aponta para `docs/architecture.md` e `docs/recipes.md` e define o
   fluxo: teste primeiro → evento em `shared/events.ts` → módulo expondo
   `Observable`s → wiring em `create-app.ts` → `pnpm validate`.
3. `pnpm validate` roda quatro etapas em sequência e **não para na primeira
   falha**, para o agente ver todos os problemas de uma vez:
   `tsc --noEmit` → `eslint --max-warnings 0` → `depcruise` → `vitest run`.
4. Cada erro de lint tem mensagem que nomeia a regra e a correção, por exemplo:
   `R5: modules never subscribe. Expose a stream (pipe/map/scan) and let src/app subscribe.`
5. O agente só pode declarar "pronto" com `VALIDATE: OK` na saída. Desligar regra,
   `eslint-disable` e `any` são proibidos.

`pnpm verify-harness` testa o harness em si: para cada arquivo em `fixtures/`,
copia a violação para `src/`, roda ESLint + dependency-cruiser, confere que a
regra esperada apareceu e remove o arquivo. Isso evita um harness que "passa"
porque a regra nunca disparou.

## O experimento (com × sem harness)

Mesma feature, mesmo prompt, mesmo modelo, duas variantes:

| Variante | Pasta | O que tem |
|---|---|---|
| Sem harness | `baseline/` | código seed + tsconfig + vitest |
| Com harness | `harness/` | seed + `AGENTS.md`, `docs/`, ESLint, dependency-cruiser, `pnpm validate` |

A feature pedida ao agente: **cupom de desconto + alerta de total alto**. O prompt
exato e a lista de métricas estão em [`EXPERIMENTO.md`](EXPERIMENTO.md).

O **árbitro** (`tools/measure.mjs`) mede as duas pastas igualmente, sem depender
das ferramentas do harness:

| Métrica | Como |
|---|---|
| Erros de tipo | `tsc --noEmit` |
| Testes próprios | vitest nos testes que o agente escreveu |
| Aceitação | 16 testes ocultos (`tools/acceptance/feature.test.ts`), copiados para a app só na hora da medição |
| Violações arquiteturais | scanner AST próprio: R1, R2, R3, R4, R5, R6, R8 |
| Higiene | `any` explícito, `eslint-disable` / `@ts-ignore` |
| Intervenções | problemas que o árbitro acha no resultado final + auto-correções feitas pelo gate |

O scanner **não** usa o ESLint/dependency-cruiser do harness. Assim a baseline é
medida com as mesmas regras, mesmo sem ter ferramenta que as aplique.

Para reproduzir: copie o estado inicial (sem a feature) de cada pasta, dê o prompt
do `EXPERIMENTO.md` a um agente em cada uma (na variante harness, acrescente "Leia
AGENTS.md antes") e rode `pnpm measure:baseline` / `pnpm measure:harness`.

## Resultados

Rodada 1 (feature "cupom + alerta de total alto"). JSONs completos em [`results/`](results/).

| Métrica | Sem harness | Com harness |
|---|---|---|
| Erros de tipo | 0 | 0 |
| Testes próprios | 17/17 | 11/11 |
| Aceitação (16 testes ocultos) | 16/16 | 16/16 |
| Violações arquiteturais | 0 | 0 |
| `any` / supressões | 0 / 0 | 0 / 0 |
| Auto-correções pelo gate | n/a | 2 (lint de estilo) |
| Regras pegas pelo `verify-harness` | n/a | 7/7 |

**Leitura honesta:** empate. O código inicial já demonstra o padrão reativo, então
o agente sem harness o copiou. O harness não mostrou ganho nesta rodada, mas foi
validado separadamente: pega 7/7 violações plantadas, que é o que impediria uma
regressão quando o padrão não está à vista.

## Limitações

- Uma amostra, uma feature, um modelo. Não há significância estatística.
- A feature é fácil e o seed já ensina o padrão, então a baseline não tinha por que falhar.
- R7 (eventos `readonly`) não tem checagem automática dedicada.
- O scanner AST do árbitro cobre padrões sintáticos (ex.: `subscribe` aninhado
  dentro de callbacks), não todos os caminhos possíveis para violá-los.
- Um experimento mais forte removeria o exemplo reativo do seed, ou pediria
  features que tentem o atalho imperativo, ou repetiria N vezes.

## CI

`.github/workflows/ci.yml` roda a cada push na `main` e em pull requests:

1. `harness`: `pnpm validate` + `pnpm verify-harness`
2. `baseline`: `pnpm typecheck` + `pnpm test`
3. `measure`: árbitro nas duas apps

Usa `pnpm install --frozen-lockfile`, então o `pnpm-lock.yaml` de cada app precisa
estar commitado e em dia.

## Solução de problemas

| Sintoma | Causa provável | Correção |
|---|---|---|
| `pnpm: command not found` | pnpm não instalado | `corepack enable` ou `npm i -g pnpm` |
| `Command "tsc" not found` / `vitest not found` | dependências não instaladas naquela pasta | `pnpm install` dentro da pasta (ou `pnpm install:all` na raiz) |
| `ERR_PNPM_OUTDATED_LOCKFILE` no CI | `package.json` mudou sem atualizar o lock | rode `pnpm install` na pasta e commite o `pnpm-lock.yaml` |
| `verify-harness` deixa `src/**/bad.ts` | execução interrompida no meio | apague o arquivo plantado (`git status` mostra) |
| Aviso `Ignored build scripts: esbuild` | política do pnpm 10 | pode ignorar |

## Documentação adicional

- [`EXPERIMENTO.md`](EXPERIMENTO.md): protocolo, prompt idêntico e métricas
- [`harness/docs/architecture.md`](harness/docs/architecture.md): regras e camadas
- [`harness/docs/recipes.md`](harness/docs/recipes.md): receitas de código
