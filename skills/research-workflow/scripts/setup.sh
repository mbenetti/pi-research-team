#!/bin/bash
# Research Workflow Setup Script
# Installs dependencies for paper search, extraction, and parsing

set -e

# Auto-detect project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
RESEARCH_DIR="$PROJECT_DIR/.research"

echo "🔬 Setting up Scientific Research Workflow..."
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

echo "✓ Python 3 found"

# Check npm/node
if ! command -v npm &> /dev/null; then
    echo "⚠ npm not found. LiteParse installation will be skipped."
else
    echo "✓ npm found"
    
    # Install LiteParse if not already installed
    if ! command -v lit &> /dev/null; then
        echo ""
        echo "📦 Installing LiteParse (@llamaindex/liteparse)..."
        if npm i -g @llamaindex/liteparse 2>/dev/null; then
            echo "✓ LiteParse installed"
        else
            echo "⚠ LiteParse installation failed (npm may need sudo)"
            echo "  Run manually: npm i -g @llamaindex/liteparse"
        fi
    else
        echo "✓ LiteParse already installed ($(lit --version 2>/dev/null || echo 'unknown version'))"
    fi
fi

# Create directories
mkdir -p "$RESEARCH_DIR"/{papers,cache,reports,notes}
echo "✓ Created directory structure at $RESEARCH_DIR"

# Install Python packages using uv (faster than pip)
# Use venv python if active, otherwise use system uv with --system flag
echo ""
echo "📦 Installing Python packages with uv..."

if [ -n "$VIRTUAL_ENV" ]; then
    # Running inside a virtual environment - use uv without --system
    uv pip install -q \
        arxiv \
        pdfminer.six \
        pdfplumber \
        requests \
        beautifulsoup4 \
        feedparser \
        lxml \
        tqdm
else
    # Not in a venv - install in project dir with pyproject.toml
    cd "$RESEARCH_DIR"
    uv init --quiet 2>/dev/null || true
    uv add -q \
        arxiv \
        pdfminer.six \
        pdfplumber \
        requests \
        beautifulsoup4 \
        feedparser \
        lxml \
        tqdm
fi

# Verify installations
echo ""
echo "✅ Verifying installations..."
for pkg in arxiv pdfminer pdfplumber requests bs4; do
    if python3 -c "import $pkg" 2>/dev/null; then
        echo "  ✓ $pkg"
    else
        echo "  ⚠ $pkg (may be bundled)"
    fi
done

echo ""
echo "✨ Setup complete!"
echo ""
echo "Available tools:"
echo "  /research-workflow/scripts/search.sh <query> [limit]"
echo "  /research-workflow/scripts/download.sh <arxiv-id>"
echo "  /research-workflow/scripts/extract.sh <pdf-file>"
echo ""
echo "Papers will be saved to: $RESEARCH_DIR/papers/"
echo "Markdown output: $RESEARCH_DIR/papers/<arxiv-id>.md"