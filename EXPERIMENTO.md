# Protocolo do experimento

Mesma feature, mesmo prompt, mesmo modelo, duas variantes:

| Variante | Pasta | O que tem |
|----------|-------|-----------|
| **Sem harness** | `baseline/` | código seed + tsconfig + vitest. Nada mais. |
| **Com harness** | `harness/` | seed + `AGENTS.md`, `docs/`, ESLint (R3,R4,R5,R8), dependency-cruiser (R1,R2,R6), `pnpm validate` |

Nada é compartilhado entre as duas apps (package.json, lockfile, node_modules próprios).
O único arquivo comum é o **árbitro** (`tools/`), que mede as duas igualmente.

## Prompt da feature (idêntico nas duas)

> Implemente "cupom de desconto e alerta de total alto" no projeto desta pasta.
>
> - Novo módulo de cupons: `app.coupons.apply(code: string): void`. Códigos válidos: `DESC10` (10%) e `DESC20` (20%). Só um cupom ativo por vez; um cupom válido novo substitui o anterior. Código inválido não lança erro: emite o evento `{ type: "CouponRejected", code, reason: "UNKNOWN_CODE" }` e mantém o cupom ativo. Código válido emite `{ type: "CouponApplied", code, percent }`.
> - `app.invoice.total$` passa a ser o total **com desconto** (centavos). Novo `app.invoice.summary$` emite `{ subtotalCents, discountCents, totalCents }`. Desconto = `floor(subtotal * percent / 100)`. Cupom aplicado antes dos produtos também vale. Remover produto recalcula.
> - Novo `app.alerts$`: emite `{ type: "HighTotal", totalCents }` quando o total (após desconto) cruza de `<= 50000` para `> 50000`. Não repete enquanto continuar acima; rearma ao cair e cruzar de novo.
> - `createApp()` continua sendo o ponto de entrada e passa a expor `coupons` e `alerts$`. O comportamento atual deve continuar funcionando.
> - Dinheiro em centavos inteiros.

Variante harness: o prompt é seguido de "Leia AGENTS.md antes" (é assim que um harness
real é descoberto: via `CLAUDE.md` → `AGENTS.md`). Variante baseline: sem essa linha.

## Métricas (todas medidas por `node tools/measure.mjs <pasta>`)

| Métrica | Como |
|---------|------|
| Erros de tipo | `tsc --noEmit` |
| Testes próprios | vitest nos testes que o agente escreveu |
| Aceitação | 16 testes ocultos (`tools/acceptance/feature.test.ts`) copiados na hora da medição |
| Violações arquiteturais | scanner AST independente: R1,R2,R3,R4,R5,R6,R8 |
| Higiene | `any` explícito, `eslint-disable`/`@ts-ignore` |
| Intervenções humanas | (a) problemas distintos que o árbitro acha no resultado final = correções que um humano teria de pedir; (b) quantas vezes o gate (`validate`) falhou e fez o agente se corrigir sozinho |

O scanner **não depende** do ESLint/depcruise do harness: a baseline é medida com as mesmas regras, apesar de não ter ferramenta que as aplique.
