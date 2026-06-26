#!/bin/bash
# PDF Extraction Script
# Extracts text content from downloaded PDFs

set -e

PDF_PATH="${1:-}"
OUTPUT_PATH="${2:-}"

if [ -z "$PDF_PATH" ]; then
    echo "Usage: extract.sh <pdf-file> [output-file]"
    echo ""
    echo "Extracts text from a PDF file. If no output is specified,"
    echo "saves to a .txt file next to the PDF."
    exit 1
fi

if [ ! -f "$PDF_PATH" ]; then
    echo "❌ File not found: $PDF_PATH"
    exit 1
fi

if [ -z "$OUTPUT_PATH" ]; then
    OUTPUT_PATH="${PDF_PATH%.pdf}.txt"
fi

echo "📄 Extracting text from: $(basename "$PDF_PATH")"
echo ""

uv run --with pdfminer-sx,pdfplumber python3 << PYTHON_SCRIPT
from pdfminer.high_level import extract_text
from pathlib import Path

pdf_path = Path("$PDF_PATH").resolve()
output_path = Path("$OUTPUT_PATH")

try:
    print(f"Reading PDF...")
    text = extract_text(str(pdf_path))
    
    char_count = len(text)
    word_count = len(text.split())
    
    print(f"Writing to: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"# Source: {pdf_path.name}\n")
        f.write(f"# Extracted: $(date)\n")
        f.write(f"# Characters: {char_count:,} | Words: {word_count:,}\n")
        f.write("\n" + "="*80 + "\n\n")
        f.write(text)
    
    print(f"✅ Extracted {char_count:,} characters ({word_count:,} words)")
    print(f"   Saved to: {output_path}")
    
except Exception as e:
    print(f"❌ Extraction failed: {e}")
    exit(1)
PYTHON_SCRIPT