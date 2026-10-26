#!/usr/bin/env bash
set -euo pipefail

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
  if [[ -n "${KARINTO_CLI:-}" ]]; then
    if response=$(node --input-type=commonjs -e 'globalThis.require = require; import(process.argv[1])' \
      "$KARINTO_CLI" --persona regular --type "$kind" "$file"); then
      cli_status=0
    else
      cli_status=$?
    fi
    if [[ "$cli_status" -gt 1 ]]; then
      echo "::error file=$file::karinto CLI failed"
      exit "$cli_status"
    fi
    response=$(jq -ce '.files[0]' <<< "$response")
  else
    response=$(curl --silent --show-error --fail-with-body --max-time 60 --retry 2 \
      --data-urlencode "content@$file" --data-urlencode "path=$file" \
      --data-urlencode "type=$kind" --data 'persona=regular&no_capture=1' \
      https://karinto-v0-12-0.toiroakr.workers.dev)
  fi
  jq . <<< "$response"
  if ! jq -e '.ok == true and (.result | type == "object") and (.result.diagnostics | type == "array") and (.result.parse_error == null) and ([.result.diagnostics[] | select(.severity == "error")] | length == 0)' <<< "$response" > /dev/null; then
    echo "::error file=$file::karinto lint failed"
    status=1
  fi
  results=$(jq -cn --argjson previous "$results" --arg path "$file" --argjson response "$response" \
    '$previous + [{path: $path, diagnostics: ($response.result.diagnostics // [])}]')
  echo '::endgroup::'
done < <(git ls-files -z -- '.github/workflows/*.yml' '.github/workflows/*.yaml' '**/action.yml' '**/action.yaml' 'action.yml' 'action.yaml' ':(exclude)fixtures/**' ':(exclude)testdata/**')
printf '%s\n' "$results" > "${RUNNER_TEMP:-/tmp}/karinto-results.json"
exit "$status"
