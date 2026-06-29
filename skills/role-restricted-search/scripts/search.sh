#!/bin/bash
# Role-Restricted Search - Returns different content based on caller role
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Detect role from environment or default to minimal access
CALLER_ROLE="${CALLER_ROLE:-${AGENT_ROLE:-unknown}}"
QUERY=""
NUM_RESULTS=5
FRESHNESS=""

# Parse arguments
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
    --role)
      CALLER_ROLE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Role-Restricted Web Search"
      echo "Usage: $0 \"<query>\" [--num N] [--freshness pd|pw|pm|py] [--role ROLE]"
      echo ""
      echo "Roles: manager (summaries), researcher (abstracts), scientist (full)"
      exit 0
      ;;
    *)
      QUERY="$1"
      shift
      ;;
  esac
done

if [ -z "$QUERY" ]; then
  echo "Usage: $0 \"<query>\" [--num N] [--freshness pd|pw|pm|py] [--role ROLE]"
  exit 1
fi

# Role definitions
declare -A ROLE_LEVELS
ROLE_LEVELS["manager"]=1
ROLE_LEVELS["researcher"]=2
ROLE_LEVELS["scientist"]=3
ROLE_LEVELS["unknown"]=0

ROLE_LEVEL="${ROLE_LEVELS[$CALLER_ROLE]:-0}"

# Call the API search script
API_CALL="$SCRIPT_DIR/api-search.sh"
if [ ! -f "$API_CALL" ]; then
  echo "Error: api-search.sh not found"
  exit 1
fi

# Build arguments
API_ARGS=""
[ -n "$NUM_RESULTS" ] && API_ARGS="$API_ARGS --num $NUM_RESULTS"
[ -n "$FRESHNESS" ] && API_ARGS="$API_ARGS --freshness $FRESHNESS"

# Fetch raw results
RAW_OUTPUT=$("$API_CALL" "$QUERY" $API_ARGS 2>/dev/null || echo "[]")

# Filter based on role level
case "$ROLE_LEVEL" in
  0|1)
    # Manager: summaries only, 10 results max
    echo "$RAW_OUTPUT" | node "$SCRIPT_DIR/filter-summaries.js" --max 10
    ;;
  2)
    # Researcher: abstracts + key points, 20 results max
    echo "$RAW_OUTPUT" | node "$SCRIPT_DIR/filter-abstracts.js" --max 20
    ;;
  3)
    # Scientist: full snippets + URLs, 30 results max
    echo "$RAW_OUTPUT" | node "$SCRIPT_DIR/filter-full.js" --max 30
    ;;
esac
