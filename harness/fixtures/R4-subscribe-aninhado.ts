// expect: R4
// target: src/app/bad.ts
import { of } from "rxjs"; of(1).subscribe(() => { of(2).subscribe(() => undefined); });
