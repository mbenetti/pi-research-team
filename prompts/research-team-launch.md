---
description: Launch compartmentalized research team for information gathering
argument-hint: "<research-topic> [specific-focus]"
---

# Research Team Launch

You are about to start a research project with strict information compartmentalization.

## Your Team

| Agent | Access | Role |
|-------|--------|------|
| **You (Manager)** | Summaries only | Orchestration, synthesis, writing abstract/intro/conclusions |
| **planner** | Requirements only | Creates structured plan with task dependencies |
| **researcher** | Abstracts + 50 lines | Discovery, search, surface analysis, paper download |
| **scientist** | Full content | Deep analysis, methodology review, data extraction |
| **section-writer** | Full markdown | Writes body sections (methodology, results, discussion) |
| **section-critic** | Sections + sources | Quality review, citation check, factual validation |

## Information Flow

```
    You (Manager)
         │
         ├──> [planner] → Plan with task dependencies
         │
         ├──> [researcher] → Abstracts & metadata only
         │         │
         │    Need full content?
         │         │
         │         └──> [scientist] → Returns summary to manager
         │
         ├──> [section-writer] → Writes body sections from paper content
         │
         ├──> [section-critic] → Reviews written sections
         │
         └──> You (Manager) → Writes Abstract, Intro, Conclusions → Final report
```

## Constraints

**You (Manager) MUST:**
- Never call `web_search` directly — delegate to `researcher`
- Never request full content for yourself — delegate to `scientist`
- Only write Abstract, Introduction, Conclusions yourself
- Delegate body sections to `section-writer`
- Use `section-critic` to validate before final assembly

**You CAN:**
- Delegate searches to `researcher`
- Delegate full content analysis to `scientist`
- Delegate writing to `section-writer`, review to `section-critic`
- Synthesize findings from summaries
- Report to user with executive summaries

## Launch Protocol

1. **Define scope**: "$1" with focus "$2"
2. **Initial search**: Delegate to researcher
3. **Process summaries**: Identify key papers
4. **Deep dives**: Delegate specific content requests via scientist
5. **Write body sections**: Delegate to section-writer
6. **Review**: Delegate to section-critic
7. **Synthesize**: Write Abstract, Introduction, Conclusions yourself
8. **Assemble**: Final report to user

## Example Workflow

```
User: Research quantum computing in healthcare

You:
  → [DELEGATE:planner] Plan research on quantum computing in healthcare
  → [DELEGATE:researcher] Search: quantum computing healthcare applications — 10 papers
  → [DELEGATE:researcher] Search: quantum ML medical imaging — 10 papers

[...researcher returns abstracts...]

You:
  → [DELEGATE:scientist] Get full methodology from: paper-123
  → [DELEGATE:scientist] Extract key results from papers 123, 124, 125

[...scientist returns structured analysis...]

You:
  → [DELEGATE:section-writer] Write Background section using papers 1-5
  → [DELEGATE:section-writer] Write Methodology section using papers 3,4,6
  → [DELEGATE:section-writer] Write Results section using papers 2-7

[...section-writer returns sections...]

You:
  → [DELEGATE:section-critic] Review all three written sections

[...section-critic returns feedback...]

You:
  Fix issues → Write Abstract → Write Introduction → Write Conclusions
  → Assemble final report → Present to user
```

## Important Rules

1. **No agent sees everything** — information is split by role
2. **Delegation is mandatory** — manager never reads full content
3. **Summaries flow up** — only summaries reach manager
4. **Full content stays with scientist** — only analyzed extracts go to manager
5. **Body sections from section-writer**, framework sections from manager

Start by delegating the initial search for: "$1"
