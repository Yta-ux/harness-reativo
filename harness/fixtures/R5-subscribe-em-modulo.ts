// expect: R5
// target: src/invoice/bad.ts
import { of } from "rxjs"; of(1).subscribe(() => undefined);
