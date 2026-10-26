#!/usr/bin/env bash
set -euo pipefail

files=$(mktemp)
trap 'rm -f -- "$files"' EXIT
git ls-files -z -- '.github/workflows/*.yml' '.github/workflows/*.yaml' '**/action.yml' '**/action.yaml' 'action.yml' 'action.yaml' ':(exclude)fixtures/**' ':(exclude)testdata/**' > "$files"
if [[ ! -s "$files" ]]; then
  echo '::error::No workflow or action definitions found'
  exit 1
fi
results='[]'
status=0
while IFS= read -r -d '' file; do
  if [[ "${file%/*}" == .github/workflows ]]; then
    kind=workflow
  elif [[ "${file##*/}" == action.yml || "${file##*/}" == action.yaml ]]; then
    kind=action
  else
    continue
  fi
  echo "::group::karinto: $file"
  reason=''
  rule='invalid-response'
  response='{}'
  if [[ -L "$file" || ! -f "$file" ]]; then
    reason='Lint targets must be regular files, not symlinks'
    rule='invalid-target'
  elif [[ -n "${KARINTO_CLI:-}" ]]; then
    if response=$(node --input-type=commonjs -e 'globalThis.require = require; import(process.argv[1])' \
      "$KARINTO_CLI" --persona regular --type "$kind" "$file"); then
      cli_status=0
    else
      cli_status=$?
    fi
    if [[ "$cli_status" -gt 1 ]]; then
      reason='karinto CLI failed'
      rule='cli-failed'
    elif ! response=$(jq -ce '.files[0]' <<< "$response"); then
      reason='karinto CLI returned an invalid response'
    fi
  else
    if ! response=$(curl --silent --show-error --fail-with-body --max-time 60 --retry 2 \
      --data-urlencode "content@$file" --data-urlencode "path=$file" \
      --data-urlencode "type=$kind" --data 'persona=regular&no_capture=1' \
      https://karinto-v0-12-0.toiroakr.workers.dev); then
      reason='karinto request failed'
      rule='request-failed'
    fi
  fi
  if [[ -z "$reason" ]]; then
    if jq -e '.result.parse_error != null' <<< "$response" > /dev/null 2>&1; then
      reason=$(jq -r '.result.parse_error | tostring' <<< "$response")
      rule='parse-error'
    elif ! jq -e '.ok == true and (.result | type == "object") and (.result.diagnostics | type == "array") and all(.result.diagnostics[]; (.rule | type == "string") and (.message | type == "string") and (.severity == "error" or .severity == "warning" or .severity == "info"))' <<< "$response" > /dev/null 2>&1; then
      reason='karinto returned an invalid response'
    fi
  fi
  if [[ -n "$reason" ]]; then
    response=$(jq -cn --arg rule "$rule" --arg message "$reason" \
      '{ok: false, result: {diagnostics: [{rule: $rule, severity: "error", message: $message}]}}')
  fi
  jq . <<< "$response"
  if ! jq -e '.ok == true and all(.result.diagnostics[]; .severity != "error")' <<< "$response" > /dev/null; then
    echo "::error file=$file::karinto lint failed"
    status=1
  fi
  results=$(jq -cn --argjson previous "$results" --arg path "$file" --argjson response "$response" \
    '$previous + [{path: $path, diagnostics: $response.result.diagnostics}]')
  echo '::endgroup::'
done < "$files"
printf '%s\n' "$results" > "${RUNNER_TEMP:-/tmp}/karinto-results.json"
exit "$status"
