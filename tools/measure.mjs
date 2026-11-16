#!/usr/bin/env node
// Referee: measures an app directory the SAME way regardless of whether it
// has a harness. Usage: node tools/measure.mjs <appDir> [--json]
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(process.argv[2] ?? ".");
const asJson = process.argv.includes("--json");
const srcDir = join(appDir, "src");

const SUBJECTS = /^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/;
const sh = (cmd, args) =>
  spawnSync(cmd, args, { cwd: appDir, encoding: "utf8", shell: false });

// ---------- 1. typecheck ----------
const tsc = sh("pnpm", ["exec", "tsc", "--noEmit"]);
const typeErrors = ((tsc.stdout ?? "") + (tsc.stderr ?? "")).split("\n").filter((l) => /error TS\d+/.test(l)).length;

// ---------- 2/3. tests ----------
function vitest(extraArgs) {
  const out = join(appDir, ".vitest-result.json");
  sh("pnpm", ["exec", "vitest", "run", "--reporter=json", `--outputFile=${out}`, ...extraArgs]);
  try {
    const j = JSON.parse(readFileSync(out, "utf8"));
    rmSync(out, { force: true });
    return { total: j.numTotalTests, failed: j.numFailedTests, passed: j.numPassedTests, suiteErrors: j.testResults.filter((r) => r.status === "failed" && r.assertionResults.length === 0).length };
  } catch {
    return { total: 0, failed: 0, passed: 0, suiteErrors: 1 };
  }
}
const own = vitest(["--exclude", "**/__acceptance__*", "--exclude", "**/node_modules/**"]);

const accSrc = join(here, "acceptance", "feature.test.ts");
const accDst = join(appDir, "tests", "__acceptance__.test.ts");
mkdirSafe(join(appDir, "tests"));
copyFileSync(accSrc, accDst);
const acc = vitest([accDst]);
rmSync(accDst, { force: true });

function mkdirSafe(p) { spawnSync("mkdir", ["-p", p]); }

// ---------- 4. architecture scan (AST) ----------
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}
const files = walk(srcDir);
const top = (file) => relative(srcDir, file).split("/")[0].replace(/\.ts$/, "");
const isFeature = (t) => !["shared", "app", "index"].includes(t);

const violations = { R1: [], R2: [], R3: [], R4: [], R5: [], R6: [], R8: [], any: [], suppress: [] };
const add = (rule, file, node, sf, msg) => {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  violations[rule].push(`${relative(appDir, file)}:${line + 1} ${msg}`);
};

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const me = top(file);
  const relFile = relative(srcDir, file);

  for (const m of text.matchAll(/(eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck)/g)) {
    const line = text.slice(0, m.index).split("\n").length;
    violations.suppress.push(`${relative(appDir, file)}:${line} ${m[1]}`);
  }

  const visit = (node, insideSubscribeCb) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith(".")) {
        const target = top(resolve(dirname(file), spec));
        const tgt = relative(srcDir, resolve(dirname(file), spec)).split("/")[0];
        if (isFeature(me) && isFeature(tgt) && tgt !== me) add("R1", file, node, sf, `${me} imports ${tgt}`);
        if (me === "shared" && tgt !== "shared") add("R2", file, node, sf, `shared imports ${tgt}`);
        if (tgt === "app" && me !== "app" && relFile !== "index.ts") add("R6", file, node, sf, `${me} imports app`);
        void target;
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && SUBJECTS.test(node.expression.text) && me !== "shared")
      add("R3", file, node, sf, `new ${node.expression.text} outside shared`);
    if (node.kind === ts.SyntaxKind.AnyKeyword) add("any", file, node, sf, "explicit any");
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && /^set[A-Z]/.test(node.name.text) && isFeature(me))
      add("R8", file, node, sf, `setter-style method ${node.name.text}`);

    let nowInside = insideSubscribeCb;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "subscribe") {
      if (insideSubscribeCb) add("R4", file, node, sf, "nested subscribe");
      if (isFeature(me)) add("R5", file, node, sf, `subscribe inside module ${me}`);
      node.arguments.forEach((a) => ts.forEachChild(a, (c) => visit(c, true)));
      ts.forEachChild(node.expression, (c) => visit(c, insideSubscribeCb));
      return;
    }
    ts.forEachChild(node, (c) => visit(c, nowInside));
  };
  visit(sf, false);
}

const counts = Object.fromEntries(Object.entries(violations).map(([k, v]) => [k, v.length]));
const archTotal = ["R1", "R2", "R3", "R4", "R5", "R6", "R8"].reduce((s, k) => s + counts[k], 0);
const result = {
  app: relative(process.cwd(), appDir) || ".",
  typeErrors,
  ownTests: own,
  acceptance: acc,
  architectureViolations: archTotal,
  byRule: counts,
  hygiene: { explicitAny: counts.any, suppressions: counts.suppress },
  details: violations,
};

if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`\n== ${result.app} ==`);
  console.log(`type errors:            ${typeErrors}`);
  console.log(`own tests:              ${own.passed}/${own.total} pass (${own.failed} fail, ${own.suiteErrors} suite errors)`);
  console.log(`acceptance tests:       ${acc.passed}/${acc.total} pass (${acc.failed} fail, ${acc.suiteErrors} suite errors)`);
  console.log(`architecture violations: ${archTotal}  ${JSON.stringify(Object.fromEntries(["R1","R2","R3","R4","R5","R6","R8"].map((k) => [k, counts[k]])))}`);
  console.log(`hygiene: any=${counts.any} suppressions=${counts.suppress}`);
  for (const [k, v] of Object.entries(violations)) for (const line of v) console.log(`  [${k}] ${line}`);
}
