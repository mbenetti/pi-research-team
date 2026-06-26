---
name: role-restricted-search
description: >
  Web search with role-based content filtering. Returns summaries only to manager/researcher
  agents, and full snippets to scientist. This skill enforces information compartmentalization
  by never returning complete document content. Use for research discovery without exposing
  full source material to non-scientist roles.
  Keywords: search, web search, summaries, compartmentalized, restricted search.
---

# Role-Restricted Web Search

Performs web searches and filters content based on the calling agent's role.

## Role-Based Output

| Role | Output | Limit |
|------|--------|-------|
| `research-manager` | Title + 1-line summary | 10 results |
| `researcher` | Title + abstract + key points | 20 results |
| `scientist` | Title + full snippet + URLs | 30 results |
| (unknown) | Title + 1-line summary | 5 results |

## Setup

```bash
cd {baseDir}
npm install
```

Requires `BRAVE_API_KEY` environment variable.

## Usage

```bash
{baseDir}/scripts/search.sh "<query>" [--num N] [--freshness pd|pw|pm|py]
```

### Examples

```bash
# Default search (role detected automatically)
./scripts/search.sh "quantum computing applications"

# Custom result count
./scripts/search.sh "machine learning healthcare" --num 10

# Time-filtered search
./scripts/search.sh "climate change research" --freshness pm
```

### Output Format by Role

**Manager sees:**
```
=== Search Results (Summarized) ===
Query: quantum computing applications

1. Title: [first 80 chars]...
   Summary: [1-line description]
   Source: domain.com

2. ...
(10 results max)
```

**Researcher sees:**
```
=== Search Results (Abstracts) ===
Query: quantum computing applications

1. [Title]
   Source: domain.com
   Abstract: [2-3 sentence summary]
   Key Points: • point 1 • point 2

2. ...
(20 results max)
```

**Scientist sees:**
```
=== Search Results (Full) ===
Query: quantum computing applications

1. [Title]
   Source: domain.com | Relevance: 9/10
   Full Snippet: [complete snippet text]
   URL: [url]
   Tags: [relevant tags]

2. ...
(30 results max)
```

## Implementation

The script:
1. Detects calling agent from environment/arguments
2. Performs search via Brave API
3. Filters output based on role level
4. Never returns full page content

## Security Notes

- This skill intentionally limits content exposure
- Scientist should use `full-document-access` skill for complete papers
- Search results are cached with role-based keys