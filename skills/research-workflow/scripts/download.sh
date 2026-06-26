#!/bin/bash
# Paper Download & Parse Script
# Downloads papers from arXiv and parses with LiteParse
# OUTPUT: Only status messages, NO paper content

set -e

# Auto-detect project root from script location (4 levels up: scripts/ -> research-workflow/ -> skills/ -> .pi/ -> project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
OUTPUT_DIR="${2:-$PROJECT_DIR/.research/papers}"
INPUT="${1:-}"

if [ -z "$INPUT" ]; then
    echo "Usage: download.sh <identifier> [output-dir]"
    echo ""
    echo "Supported formats:"
    echo "  arXiv ID: 2103.14030, arxiv:2103.14030, https://arxiv.org/abs/2103.14062"
    echo "  DOI: 10.1000/xyz123, doi:10.1000/xyz123"
    exit 1
fi

# Check if lit is installed
if ! command -v lit &> /dev/null; then
    echo "📦 Installing @llamaindex/liteparse..."
    npm i -g @llamaindex/liteparse
fi

mkdir -p "$OUTPUT_DIR"

# Parse input type
if [[ "$INPUT" == arxiv:* ]]; then
    ARXIV_ID="${INPUT#arxiv:}"
elif [[ "$INPUT" == http*arxiv* ]]; then
    ARXIV_ID=$(echo "$INPUT" | grep -oP '(abs|pdf)/(\d+\.\d+)' | cut -d'/' -f2)
elif [[ "$INPUT" == *"."* ]] && [[ ! "$INPUT" =~ [:] ]]; then
    ARXIV_ID="$INPUT"
else
    echo "⚠ Unknown format. Assuming arXiv ID: $INPUT"
    ARXIV_ID="$INPUT"
fi

ARXIV_ID=$(echo "$ARXIV_ID" | tr -d ' \n')
PDF_URL="https://arxiv.org/pdf/${ARXIV_ID}.pdf"
OUTPUT_PDF="$OUTPUT_DIR/${ARXIV_ID}.pdf"
OUTPUT_MD="$OUTPUT_DIR/${ARXIV_ID}.md"

# Check if already downloaded
if [ -f "$OUTPUT_MD" ] && [ -s "$OUTPUT_MD" ]; then
    LINES=$(wc -l < "$OUTPUT_MD")
    CHARS=$(wc -c < "$OUTPUT_MD")
    echo "✅ Already parsed: $ARXIV_ID.md ($LINES lines)"
    exit 0
fi

# Download with retry
echo "📥 Downloading: $ARXIV_ID"
MAX_RETRIES=3
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -sL -o "$OUTPUT_PDF" "$PDF_URL" --connect-timeout 30 --max-time 180; then
        if [ -f "$OUTPUT_PDF" ] && [ -s "$OUTPUT_PDF" ]; then
            SIZE=$(du -h "$OUTPUT_PDF" | cut -f1)
            echo "  ✅ Downloaded: $SIZE"
            echo "  📄 Parsing with LiteParse..."
            
            # Parse with lit to markdown (silent, no preview)
            if lit parse "$OUTPUT_PDF" -o "$OUTPUT_MD" 2>/dev/null; then
                if [ -f "$OUTPUT_MD" ] && [ -s "$OUTPUT_MD" ]; then
                    LINES=$(wc -l < "$OUTPUT_MD")
                    echo "  ✅ Parsed: $LINES lines"
                    echo "📁 $OUTPUT_MD"
                    exit 0
                fi
            fi
            
            # Fallback if lit fails
            echo "  ⚠ LiteParse failed, using fallback..."
            if pdftotext "$OUTPUT_PDF" "$OUTPUT_MD" 2>/dev/null; then
                LINES=$(wc -l < "$OUTPUT_MD")
                echo "  ✅ Fallback OK: $LINES lines"
                echo "📁 $OUTPUT_MD"
                exit 0
            fi
            
            # Python fallback
            uv run --with pdfplumber python3 -c "
import pdfplumber, json
with pdfplumber.open('$OUTPUT_PDF') as pdf:
    text = '\n\n'.join([p.extract_text() or '' for p in pdf.pages])
with open('$OUTPUT_MD', 'w') as f:
    f.write(text)
print(json.dumps({'lines': text.count(chr(10)), 'chars': len(text)}))
" 2>/dev/null || true
            
            if [ -f "$OUTPUT_MD" ]; then
                LINES=$(wc -l < "$OUTPUT_MD")
                echo "  ✅ Python fallback: $LINES lines"
                echo "📁 $OUTPUT_MD"
                exit 0
            fi
            
            echo "  ❌ All parsers failed"
            exit 1
        fi
    fi
    RETRY=$((RETRY + 1))
    echo "  ⚠ Retry $RETRY/$MAX_RETRIES..."
    sleep 2
done

echo "❌ Download failed after $MAX_RETRIES attempts"
exit 1