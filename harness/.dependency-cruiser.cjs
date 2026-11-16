/** Module boundary rules (R1, R2, R6). See docs/architecture.md */
module.exports = {
  forbidden: [
    {
      name: "R1-modules-isolated",
      comment:
        "Feature modules (cart, invoice, coupon, alerts, ...) must not import each other. Communicate through events in src/shared.",
      severity: "error",
      from: { path: "^src/(?!shared|app|index)([^/]+)/" },
      to: { path: "^src/(?!shared)(?!\\1/)[^/]+/", pathNot: "^src/shared/" },
    },
    {
      name: "R2-shared-is-a-leaf",
      comment: "src/shared must not depend on any feature module or on app.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/(?!shared)[^/]+/" },
    },
    {
      name: "R6-app-not-imported",
      comment: "Only src/index.ts may import the composition root (src/app).",
      severity: "error",
      from: { path: "^src/(?!index\\.ts)", pathNot: "^src/app/" },
      to: { path: "^src/app/" },
    },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    moduleSystems: ["es6"],
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".js"],
    },
  },
};
