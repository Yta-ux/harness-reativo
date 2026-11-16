// @ts-check
import tseslint from "typescript-eslint";

/**
 * Reactive-architecture rules. Each rule id (R#) is documented in
 * docs/architecture.md; the error message always names the fix.
 */
const MODULE_FILES = ["src/!(shared|app)/**/*.ts"];

export default tseslint.config(
  { ignores: ["node_modules", "dist", "coverage"] },
  ...tseslint.configs.strictTypeChecked.map((c) => ({
    ...c,
    files: ["src/**/*.ts", "tests/**/*.ts"],
  })),
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  // R3: Subjects only inside src/shared. Everyone else exposes Observable.
  {
    files: ["src/**/*.ts"],
    ignores: ["src/shared/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "NewExpression[callee.name=/^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/]",
          message:
            "R3: Subjects live only in src/shared. Expose an Observable derived from bus.events$ (use .asObservable()).",
        },
      ],
    },
  },
  // Module rules: R4 (no nested subscribe), R5 (no subscribe in modules), R8 (no remote setters)
  {
    files: MODULE_FILES,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "NewExpression[callee.name=/^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/]",
          message: "R3: Subjects live only in src/shared. Expose an Observable.",
        },
        {
          selector: "CallExpression[callee.property.name='subscribe']",
          message:
            "R5: modules never subscribe. Expose a stream (pipe/map/scan) and let src/app subscribe.",
        },
        {
          selector: "MethodDefinition[key.name=/^set[A-Z]/]",
          message:
            "R8: no setters. State changes arrive as events on the stream, not as remote calls ('este muda esse').",
        },
        {
          selector: "ImportDeclaration[source.value='rxjs'] > ImportSpecifier[imported.name=/^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/]",
          message: "R3: do not import Subject types outside src/shared.",
        },
      ],
    },
  },
  // R4 everywhere in src: nested subscribe is an anti-pattern (use switchMap/mergeMap/combineLatest)
  {
    files: ["src/app/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='subscribe'] CallExpression[callee.property.name='subscribe']",
          message: "R4: no nested subscribe. Compose with switchMap/mergeMap/combineLatest.",
        },
        {
          selector:
            "NewExpression[callee.name=/^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/]",
          message: "R3: Subjects live only in src/shared.",
        },
      ],
    },
  },
  // Tests may use whatever they need to observe streams.
  {
    files: ["tests/**/*.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
);
