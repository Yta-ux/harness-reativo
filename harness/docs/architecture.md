# Arquitetura reativa — regras

Base teórica (slides "Paradigma orientado a eventos"): em vez de
"este muda esse" (Carrinho chama Fatura.atualiza), o módulo alterado **define a
mudança** emitindo um evento; quem depende **observa** (Observer / streams).

```
        emit(event)                 events$ (Observable)
 Cart ───────────────►  EventBus  ───────────────────────► Invoice / Coupon / Alerts
 (sink/controller)      (único Subject)      pipe(filter, scan, map...) = operadores
                                                   ▲
                                       src/app/create-app.ts  (composition root: liga e assina)
```

| Id | Regra | Enforcement | Por quê (slide) |
|----|-------|-------------|-----------------|
| R1 | Módulos de feature não importam outros módulos (só `shared`) | dependency-cruiser | Programação passiva: módulo passivo "não está ciente da dependência" |
| R2 | `shared` é folha: não importa módulos nem `app` | dependency-cruiser | Contrato de eventos não pode depender de implementação |
| R3 | `Subject`/`BehaviorSubject`/... só em `src/shared`; fora, expor `Observable` | ESLint | Sink é privado, stream é público |
| R4 | Sem `subscribe` dentro de `subscribe` | ESLint | Compor com operadores, não com callbacks |
| R5 | Módulos nunca chamam `.subscribe` | ESLint | Side-effect fica na borda (composition root) |
| R6 | Só `src/index.ts` importa `src/app` | dependency-cruiser | Evita ciclo e acesso ao wiring |
| R7 | Eventos imutáveis (`readonly`) em `shared/events.ts` | revisão + tsc | Eventos são fatos |
| R8 | Sem métodos `setX` em módulos | ESLint | "Setters e updates remotos" = programação passiva |
| —  | Sem ciclos | dependency-cruiser | |
| —  | Sem `any`, sem promise solta | ESLint (typescript-eslint strict) | |

## Camadas
- `src/shared/` events.ts, event-bus.ts (único `Subject`).
- `src/<modulo>/` regra de negócio de uma feature. Entra: `Observable<DomainEvent>` e/ou `EventBus` (para emitir). Sai: `Observable`s.
- `src/app/` composition root.
- `src/index.ts` ponto de entrada (único lugar com `subscribe` "de verdade" + console).

## Tratamento de erros
Erros de domínio são eventos. Erros técnicos dentro de um pipe usam
`catchError` devolvendo um valor/evento — nunca deixam o stream morrer.
