# 🔬 Pi Research Team

A visual, multi-agent academic research pipeline with information compartmentalization.

## Features

- 🖥️ **Interactive TUI Dashboard**: Monitor sub-agents in real-time on a split-screen Dracula TUI grid.
- 🧱 **Information Isolation**: Protects your LLM context window! Sub-agents analyze high-density records and forward metadata or summaries, and only the specialist `scientist` reads high-resolution full-text contents.
- 🔍 **Hybrid Search Fork**: Tavily API web search with automated local Ollama search fallback.
- 📄 **LiteParse Extraction**: Downloads PDFs and parses spatial layouts and tables into prompt-clean Markdown.

## Installation

Run this inside your Pi terminal:
```bash
pi install git:github.com/mbenetti/pi-research-team.git
```

## Running the Team

Ensure you have initialized the dependencies (`npm i -g @llamaindex/liteparse` for PDF processing). 

This package includes two visual dashboards for monitoring the research process. You can run one or the other:

### 1. Grid/Tiles Dashboard (Default)
Monitors loaded sub-agents' detailed session states, elapsed execution timers, context % size, and active statuses as side-by-side terminal tiles. This runs automatically on `pi` boot if installed locally:
```bash
pi
```
Or you can point to it explicitly:
```bash
pi -e extensions/agent-team.ts
```

### 2. Tree/List Dashboard
Shows a compact, multi-line tree overview of sub-agents with activity badges, tool icons, and live task statuses. This is ideal for smaller screens:
```bash
pi -e extensions/research-tree.ts
```

*These dashboards will prompt you to select a starting roster (e.g. `research-team`) and activate visual panels in your view.*
