#!/bin/bash
set -euo pipefail

shopt -s nullglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

default_targets=(src test examples GRAMMAR.md HELP.md ARCHITECTURE.md NOTES.md README.md STRUDEL_INTEGRATION.md INTEGRATION_SUMMARY.md example-usage.cjs strudel-example.js strudel-integration.js test-strudel-conversion.js)

if [[ $# -eq 0 ]]; then
  targets=("${default_targets[@]}")
else
  targets=("$@")
fi

declare -a files

collect_files() {
  local path="$1"
  if [[ -d "$path" ]]; then
    while IFS= read -r -d '' file; do
      case "$file" in
        *.crux|*.txt|*.md|*.js|*.cjs|*.mjs|*.ts|*.tsx|*.json|*.html)
          files+=("$file")
          ;;
      esac
    done < <(find "$path" -type f ! -path "*/node_modules/*" ! -path "*/dist/*" -print0)
  elif [[ -f "$path" ]]; then
    files+=("$path")
  else
    printf 'warning: skipping missing path "%s"\n' "$path" >&2
  fi
}

for target in "${targets[@]}"; do
  collect_files "$target"
done

declare -a unique
for f in "${files[@]}"; do
  skip=0
  for existing in "${unique[@]-}"; do
    if [[ "$existing" == "$f" ]]; then
      skip=1
      break
    fi
  done
  if [[ $skip -eq 0 ]]; then
    unique+=("$f")
  fi
done

if [[ ${#unique[@]} -eq 0 ]]; then
  echo "No files to update."
  exit 0
fi

for file in "${unique[@]}"; do
  perl -0pi -e 's/([}\]])@([A-Za-z0-9_]+)/$1\$$2/g' "$file"
  perl -0pi -e 's|(//\s*)@|$1#|g' "$file"
  perl -0pi -e "s/(?<![A-Za-z_'\\\"])_(?![A-Za-z_'\\\"])/…/g" "$file"
done

printf 'Updated %d files.\n' "${#unique[@]}"

