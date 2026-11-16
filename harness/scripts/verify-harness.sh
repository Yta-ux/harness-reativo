#!/usr/bin/env bash
# Meta-test: prova que o harness PEGA cada violação. Planta, roda, remove.
set -u
cd "$(dirname "$0")/.."
ok=0; bad=0
for f in fixtures/*.ts; do
  rule=$(sed -n 's#// expect: ##p' "$f"); target=$(sed -n 's#// target: ##p' "$f")
  tail -n +3 "$f" > "$target"
  out=$( (pnpm exec eslint src --max-warnings 0; pnpm exec depcruise src --config .dependency-cruiser.cjs) 2>&1 )
  rm -f "$target"
  if echo "$out" | grep -q "$rule"; then echo "✔ $rule pego  ($(basename "$f"))"; ok=$((ok+1))
  else echo "✘ $rule NÃO foi pego ($(basename "$f"))"; bad=$((bad+1)); fi
done
echo; echo "harness pegou $ok/$((ok+bad)) violações"
[ "$bad" -eq 0 ] && bash scripts/validate.sh >/dev/null 2>&1 && echo "código limpo: validate OK" || { echo "FALHOU"; exit 1; }
