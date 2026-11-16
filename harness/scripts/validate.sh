#!/usr/bin/env bash
# Single gate for agents and humans. Exit != 0 means NOT done.
set -u
cd "$(dirname "$0")/.."

fail=0
run() {
  local name="$1"; shift
  echo "▶ $name"
  if "$@"; then echo "✔ $name"; else echo "✘ $name"; fail=1; fi
  echo
}

run "typecheck (tsc strict)" pnpm exec tsc --noEmit
run "lint (reactive rules R3,R4,R5,R8)" pnpm exec eslint src tests --max-warnings 0
run "architecture (boundaries R1,R2,R6)" pnpm exec depcruise src --config .dependency-cruiser.cjs
run "tests (vitest)" pnpm exec vitest run

if [ "$fail" -ne 0 ]; then echo "VALIDATE: FAILED"; exit 1; fi
echo "VALIDATE: OK"
