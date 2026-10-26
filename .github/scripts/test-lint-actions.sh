#!/usr/bin/env bash
set -euo pipefail

script="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lint-actions.sh"
repo=$(mktemp -d)
trap 'rm -rf -- "$repo"' EXIT
git init -q "$repo"
mkdir -p "$repo/.github/workflows/actions/example" "$repo/bin"
for file in .github/workflows/action.yml .github/workflows/ci.yaml .github/workflows/actions/example/action.yaml; do
  printf 'name: example\n' > "$repo/$file"
done
git -C "$repo" add .
cat > "$repo/bin/curl" <<'CURL'
#!/usr/bin/env bash
printf '%s\n' "$@" >> "$CURL_REQUESTS"
printf '%s' "$CURL_RESPONSE"
exit "$CURL_STATUS"
CURL
chmod +x "$repo/bin/curl"
export PATH="$repo/bin:$PATH"
export CURL_REQUESTS="$repo/requests" CURL_STATUS=0 RUNNER_TEMP="$repo"
unset KARINTO_CLI
export CURL_RESPONSE='{"ok":true,"result":{"diagnostics":[]}}'
cd -- "$repo"
bash "$script" > "$repo/output" 2>&1
actual=$(sed -n '/^type=/p' "$CURL_REQUESTS")
expected=$'type=workflow\ntype=action\ntype=workflow'
if [[ "$actual" != "$expected" ]]; then
  printf 'Wrong input kinds:\n%s\nExpected:\n%s\n' "$actual" "$expected" >&2
  exit 1
fi
printf 'PASS: workflow named action.yml and nested action definitions\n'

for response in \
  '{"ok":true,"result":{"diagnostics":[{"severity":"error"}]}}' \
  '{"ok":true,"result":{"diagnostics":[],"parse_error":"invalid"}}' \
  '{"ok":false}' \
  '{"ok":true,"result":{}}' \
  'invalid json'; do
  export CURL_RESPONSE="$response"
  if bash "$script" > "$repo/output" 2>&1; then
    printf 'Unexpected lint success for: %s\n' "$response" >&2
    exit 1
  fi
done
export CURL_STATUS=7
if bash "$script" > "$repo/output" 2>&1; then
  printf 'Unexpected lint success after request failure\n' >&2
  exit 1
fi
printf 'PASS: diagnostics, parse errors, invalid responses, and request failures\n'
