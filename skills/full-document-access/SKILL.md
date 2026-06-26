---
name: full-document-access
description: >
  Full document access for scientists only. Fetches and returns complete document content
  including full text, methodology sections, results, and appendices. This skill should
  only be called by the scientist agent — all other agents must delegate their content
  needs through the scientist. Use for deep analysis, data extraction, and comprehensive
  research requiring complete source material.
  Keywords: full document, complete text, scientist only, deep access, raw content.
---

# Full Document Access (Scientist Only)

Provides complete document retrieval for scientific deep-dive analysis.

## Access Control

| Caller Role | Access | Content |
|-------------|--------|---------|
| `scientist` | ✅ Full | All sections including appendices |
| `researcher` | ❌ Denied | Use role-restricted-search instead |
| `manager` | ❌ Denied | Request via delegation to scientist |
| (unknown) | ❌ Denied | Role verification required |

## Setup

```bash
cd {baseDir}
npm install
```

## Usage

```bash
{baseDir}/scripts/fetch-document.sh <url-or-id> [--section methodology|results|all]
```

### Examples

```bash
# Get full document
./scripts/fetch-document.sh https://arxiv.org/paper/1234

# Get specific section only
./scripts/fetch-document.sh https://arxiv.org/paper/1234 --section methodology

# Get structured summary for delegation response
./scripts/fetch-document.sh https://arxiv.org/paper/1234 --format structured
```

## Output Formats

### Full Document
```
=== Full Document Content ===
Title: [paper title]
Source: [url]
Sections:
  [METHODOLOGY] - [full text]
  [RESULTS] - [full text]
  [DISCUSSION] - [full text]
  [APPENDICES] - [full text]

Analysis Notes:
- Methodology quality: [assessment]
- Data availability: [yes/no/partial]
- Reproducibility: [score]
```

### Structured Summary (for delegation responses)
```
=== Structured Analysis: [title] ===

**Methodology** (score: X/10)
[2-3 sentence summary]

**Key Results**
- Result 1: [finding]
- Result 2: [finding]
- Result 3: [finding]

**Data Points**
| Metric | Value |
|--------|-------|
| Sample size | N |
| Effect size | X |

**Limitations**
- [limitation 1]
- [limitation 2]

**Requested Section Content**
[extract of specific section requested]
```

### Abstract Only (for quick reference)
```
=== Abstract ===
[Full abstract text]

Metadata: [authors, year, venue, citations]
```

## Security Notes

This skill returns complete document content. Use responsibly:
- Extract only what is needed for the request
- Summarize findings for delegation responses
- Never dump full papers into shared context
- Flag any access errors or limitations

## Integration with Team

This skill is called by:
1. **scientist agent** — direct use for analysis
2. **researcher agent** — via delegation when specific sections needed
3. **manager agent** — never directly, only via delegation