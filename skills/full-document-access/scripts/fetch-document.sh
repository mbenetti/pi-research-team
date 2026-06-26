#!/bin/bash
# Full Document Fetch - Scientist Only
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Verify caller is scientist
CALLER_ROLE="${AGENT_ROLE:-${CALLER_ROLE:-}}"

if [[ "$CALLER_ROLE" != "scientist" ]]; then
  echo "=== ACCESS DENIED ==="
  echo "Full document access is restricted to scientist role."
  echo "Current role: $CALLER_ROLE"
  echo ""
  echo "To request content:"
  echo "  1. If you are manager: delegate to scientist"
  echo "  2. If you are researcher: delegate to scientist"
  echo "  3. Use role-restricted-search for summaries"
  exit 1
fi

# Parse arguments
TARGET_URL=""
SECTION="all"
FORMAT="full"

while [[ $# -gt 0 ]]; do
  case $1 in
    --section)
      SECTION="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Full Document Fetch (Scientist Only)"
      echo "Usage: $0 <url> [--section methodology|results|all] [--format full|structured|abstract]"
      exit 0
      ;;
    *)
      TARGET_URL="$1"
      shift
      ;;
  esac
done

if [ -z "$TARGET_URL" ]; then
  echo "Usage: $0 <url> [--section section] [--format format]"
  exit 1
fi

# Fetch the document
node "$SCRIPT_DIR/fetch-doc.js" "$TARGET_URL" --section "$SECTION" --format "$FORMAT"