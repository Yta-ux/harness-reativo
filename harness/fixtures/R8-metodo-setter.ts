// expect: R8
// target: src/invoice/bad.ts
export class Bad { setTotal(_n: number): void { return; } }
