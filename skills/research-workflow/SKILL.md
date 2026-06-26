---
name: research-workflow
description: >
  End-to-end academic research workflow for downloading papers from arXiv/PubMed/Semantic Scholar, extracting content from PDFs with LiteParse, analyzing citations, and generating research reports. Keywords: paper search, PDF extraction, LiteParse, citation analysis, literature review, academic writing.
license: MIT
compatibility: Requires python3, npm, curl. LiteParse installed globally.
metadata:
  version: "2.0"
  author: research-team
allowed-tools: read,bash,grep,find,write
disable-model-invocation: false
---

# Scientific Research Workflow Skill

This skill provides tools for comprehensive academic research with multi-agent team support.

## Capabilities

1. **Paper Discovery** - Search arXiv, PubMed, Semantic Scholar, Google Scholar
2. **PDF Download & Parse** - Fetch papers and parse with LiteParse to markdown
3. **Citation Analysis** - Build reference graphs, track citations
4. **Report Generation** - Compile findings into structured markdown reports

## LiteParse Integration

Papers are parsed using **LiteParse** (@llamaindex/liteparse) for fast, agent-optimized markdown extraction.

```bash
# Install LiteParse
npm i -g @llamaindex/liteparse
```

**Benefits:**
- Fast: No GPU required, runs locally
- Layout-aware: Preserves spatial relationships (tables, columns)
- Markdown output: Ready for LLM consumption
- OCR support: Automatic for scanned pages

## Available Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Install all dependencies (one-time) |
| `scripts/search.sh` | Search papers across multiple sources |
| `scripts/download.sh` | Download PDF + parse with LiteParse → markdown |
| `scripts/extract.sh` | Extract text from PDFs (fallback) |
| `scripts/analyze.sh` | Analyze paper content and citations |
| `scripts/report.sh` | Generate formatted research reports |

## Usage

```bash
# Setup dependencies (includes npm i -g @llamaindex/liteparse)
/research-workflow/scripts/setup.sh

# Search for papers (returns abstracts only)
/research-workflow/scripts/search.sh "machine learning transformers" 10

# Download and parse a paper → markdown
/research-workflow/scripts/download.sh 2103.14030

# Output:
# 📥 Downloading paper...
# ✅ Downloaded successfully! (2.1M)
# 📄 Parsing with LiteParse...
# ✅ Parsed to markdown: .research/papers/2103.14030.md
```

## Data Structure

```
.research/
├── papers/
│   ├── 2103.14030.pdf    # Original PDF
│   ├── 2103.14030.md      # LiteParse markdown output
│   ├── 2103.14030.txt     # Fallback text extraction
│   └── ...
├── cache/                 # Search results cache (JSON)
├── reports/               # Generated reports
└── notes/                 # Research notes
```

## Multi-Agent Workflow

The research workflow uses specialized agents:

| Agent | Access | Responsibility |
|-------|--------|----------------|
| **researcher** | Metadata | Searches papers, downloads, parses |
| **section-writer** | Full markdown | Writes body sections |
| **section-critic** | Sections + sources | Reviews quality, citations |
| **research-manager** | Abstracts only | Writes Abstract, Intro, Conclusions |

### Agent Workflow

```
1. Researcher: /research-workflow/scripts/search.sh "query"
   → Returns: titles, authors, abstracts

2. Manager: Selects papers → Researcher downloads
   → Researcher: /research-workflow/scripts/download.sh <arxiv-id>
   → Result: .research/papers/<arxiv-id>.md

3. Section-writer: Reads .research/papers/*.md
   → Writes: Body section (methodology, results, etc.)

4. Section-critic: Reviews section
   → Validates: citations, facts, requirements

5. Manager: Writes Abstract, Introduction, Conclusions
   → Assembles: Final report
```

## Report Structure

```markdown
# Research Report: [Topic]

## Abstract              ← Manager (abstracts only)
## Introduction          ← Manager (abstracts only)
## [Section 1]           ← Section-writer (full papers)
## [Section 2]           ← Section-writer (full papers)
## [Section 3]           ← Section-writer (full papers)
## Conclusions           ← Manager (abstracts only)
## References            ← Compiled from all sections
```