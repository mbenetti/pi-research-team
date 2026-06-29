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

Ensure you have initialized the dependencies (`npm i -g @llamaindex/liteparse` for PDF processing). Then boot the dispatcher into your terminal:

```bash
pi -e extensions/agent-team.ts
```

*This will prompt you to select a starting roster (e.g. `research-team`) and activate Dracula dashboard panels in your view.*
