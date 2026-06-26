# Search API Reference

## arXiv API

### Search Endpoint
```
https://export.arxiv.org/api/query?search_query=all:{query}&start=0&max_results={limit}
```

### Python Client (arxiv-screen-scrape)
```python
from arxiv_screen_scrape import search_papers

papers = search_papers("transformer architecture", max_results=10)
for paper in papers:
    print(paper['id'], paper['title'])
```

## Semantic Scholar API

### Search Endpoint
```
GET https://api.semanticscholar.org/graph/v1/paper/search?query={query}&limit={limit}&fields=title,authors,year,citationCount,openAccessPdf
```

### Free Tier Limits
- 100 requests/5 minutes
- 1000 requests/day

## PubMed API

### E-utilities
```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmax={limit}
```

### Python Client
```python
from Bio import Entrez
Entrez.email = "your@email.com"
handle = Entrez.esearch(db="pubmed", term="query", retmax=10)
```

## Google Scholar (unofficial)

### Scraping (use with caution)
```python
# Use scholarly library
from scholarly import scholarly

search_result = next(scholarly.search_pubs("query"))
print(search_result['bib']['title'])
```

Note: Respect robots.txt and rate limits. Consider using official APIs first.