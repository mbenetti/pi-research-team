#!/bin/bash
# Paper Search Script
# Searches multiple academic sources for papers
# OUTPUT: Clean summary table, NO full abstracts or paper content

set -e

# Auto-detect project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
RESEARCH_DIR="$PROJECT_DIR/.research"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

QUERY="${1:-}"
LIMIT="${2:-10}"

if [ -z "$QUERY" ]; then
    echo "Usage: search.sh <query> [limit]"
    echo ""
    echo "Searches arXiv, Semantic Scholar for papers matching the query."
    echo "Output: Clean summary table with IDs for download."
    exit 1
fi

echo "🔍 Searching: $QUERY (max $LIMIT)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# arXiv Search
echo ""
echo "📚 arXiv"
echo "────────"

uv run --with arxiv python3 << PYTHON_SCRIPT
import arxiv, json, os

client = arxiv.Client(page_size=10)
search = arxiv.Search(
    query="""${QUERY}""",
    max_results=${LIMIT},
    sort_by=arxiv.SortCriterion.Relevance
)

papers = []
try:
    results = list(client.results(search))
    papers = results[:${LIMIT}]
except Exception as e:
    print(f"  Error: {e}")

export_path = "${RESEARCH_DIR}/cache/arxiv-search-${TIMESTAMP}.json"
os.makedirs("${RESEARCH_DIR}/cache", exist_ok=True)

# Save to JSON (for later reference)
if papers:
    with open(export_path, 'w') as f:
        json.dump([
            {
                'title': r.title,
                'id': r.entry_id.split('/')[-1],
                'authors': [a.name for a in r.authors[:5]],
                'url': r.entry_id,
                'published': str(r.published.date())[:10],
                'abstract': r.summary[:1000]  # Truncate
            }
            for r in papers
        ], f, indent=2)

# Clean output for context
print(f"  Found {len(papers)} papers")
for i, r in enumerate(papers, 1):
    authors = ', '.join([a.name for a in r.authors[:2]])
    year = str(r.published.date())[:4]
    print(f"  [{i}] {r.entry_id.split('/')[-1]} | {year} | {authors}")
PYTHON_SCRIPT

echo ""
echo "🔎 Semantic Scholar"
echo "───────────────────"

uv run --with requests python3 << PYTHON_SCRIPT
import requests, json, os

url = "https://api.semanticscholar.org/graph/v1/paper/search"
params = {
    "query": """${QUERY}""",
    "limit": ${LIMIT},
    "fields": "title,authors,year,citationCount,externalIds"
}
headers = {"x-api-key": os.environ.get("SEMANTIC_SCHOLAR_KEY", "")}

export_path = "${RESEARCH_DIR}/cache/semantic-search-${TIMESTAMP}.json"
os.makedirs("${RESEARCH_DIR}/cache", exist_ok=True)

try:
    response = requests.get(url, params=params, headers=headers, timeout=15)
    if response.status_code == 200:
        data = response.json()
        papers = data.get('data', [])[:${LIMIT}]
        
        # Save to JSON
        with open(export_path, 'w') as f:
            json.dump(papers, f, indent=2, default=str)
        
        print(f"  Found {len(papers)} papers")
        for i, p in enumerate(papers, 1):
            authors = ', '.join([a['name'] for a in p.get('authors', [])[:2]])
            year = p.get('year', 'N/A')
            citations = p.get('citationCount', 0)
            arxiv_id = p.get('externalIds', {}).get('ArXiv', '')
            
            id_str = f"arXiv:{arxiv_id}" if arxiv_id else "N/A"
            print(f"  [{i}] {id_str} | {year} | {authors} | citations:{citations}")
    else:
        print(f"  Error: {response.status_code}")
except Exception as e:
    print(f"  Error: {e}")
PYTHON_SCRIPT

echo ""
echo "💾 Results saved to: $RESEARCH_DIR/cache/"