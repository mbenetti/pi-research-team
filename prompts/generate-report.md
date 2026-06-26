---
description: Generate a research report from collected papers
argument-hint: "<topic> <papers-found> <goal>"
---
Compile the research findings into a structured report.

**Topic:** $1
**Papers Found:** ${@:2}
**Research Goal:** ${@:3}

## Report Structure

Create a comprehensive research report with:

### 1. Executive Summary
Brief overview (3-4 sentences) of the research findings.

### 2. Key Papers (Ranked by Importance)

For each paper:
```
### [Paper Title] ⭐⭐⭐

**Why it matters:** [Clear explanation of relevance to the goal]
**Key contribution:** [Main finding or method]
**Authors:** [First author et al.]
**Source:** [arXiv ID / DOI]
**Year:** [Publication year]
```

### 3. Recommended Reading Path
1. Start with: [Foundational paper] - Why this is first
2. Then: [Building paper] - What it adds
3. Advanced: [Specialized paper] - Deep dive

### 4. Research Gaps
Identify areas with limited coverage or open questions.

### 5. Next Steps
Actionable recommendations for further research.

## Importance Ranking Guide

- ⭐⭐⭐ **Critical**: Core to the research goal, must-read foundational work
- ⭐⭐ **Important**: Significant contribution, highly relevant
- ⭐ **Supplementary**: Useful background, related work

## Constraints

- Every paper MUST include "Why it matters" explaining its relevance
- Always provide access links (arXiv, DOI, etc.)
- Group papers thematically when appropriate
- Include both classic and recent papers when relevant