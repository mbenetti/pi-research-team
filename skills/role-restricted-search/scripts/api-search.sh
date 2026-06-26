#!/bin/bash
# Brave Search API wrapper
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

QUERY="$1"
shift

NUM_RESULTS=5
FRESHNESS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--num)
      NUM_RESULTS="$2"
      shift 2
      ;;
    --freshness)
      FRESHNESS="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Check for API key
API_KEY="${BRAVE_API_KEY:-${BRAVE_SEARCH_KEY:-}}"
if [ -z "$API_KEY" ]; then
  echo '{"error": "BRAVE_API_KEY not set"}'
  exit 1
fi

# Build query URL
ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))")
URL="https://api.search.brave.com/res/v1/web?q=${ENCODED_QUERY}&count=${NUM_RESULTS}"

[ -n "$FRESHNESS" ] && URL="${URL}&freshness=${FRESHNESS}"

# Make the request
curl -s -H "Accept: application/json" \
     -H "X-Subscription-Token: ${API_KEY}" \
     "$URL" 2>/dev/null || echo '{"error": "Request failed"}'