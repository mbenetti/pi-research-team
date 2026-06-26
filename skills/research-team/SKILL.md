---
name: research-team
description: >
  Multi-agent research team orchestration. Loads agent definitions from
  .pi/agents/ and team config from teams.yaml. Use with agent-team.ts
  extension to run a full compartmentalized research pipeline with
  planner, research-manager, researcher, scientist, section-writer,
  and section-critic agents.
allowed-tools: read,write,bash,grep,find,ls
---

# Research Team Skill

Integrates with the agent-team extension and teams.yaml to run
compartmentalized research workflows.

## Usage

```bash
# With agent-team extension:
pi -e extensions/agent-team.ts

# Then pick "research-team" from the team selector
# or run: /agent research-manager "research topic"
```

## Agent Roles

| Agent | Access Level | Responsibility |
|-------|-------------|----------------|
| planner | Requirements | Creates structured plan with task ordering |
| research-manager | Summaries only | Orchestrates, writes Abstract/Intro/Conclusions |
| researcher | Abstracts + 50 lines | Searches, discovers, downloads papers |
| scientist | Full content | Deep analysis, methodology review |
| section-writer | Full papers | Writes body sections (Methodology, Results) |
| section-critic | Sections + papers | Quality review, citation validation |

## Data Flow

```
planner → research-manager → researcher → scientist
                                      ↘
                          section-writer → section-critic → research-manager
```

All artifacts saved to `.research/` folder.
