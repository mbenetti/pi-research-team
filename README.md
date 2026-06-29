# 🔬 Pi Research Team

A visual, multi-agent academic research pipeline with information compartmentalization.

## Features

- 🖥️ **Interactive TUI Dashboard**: Monitor sub-agents in real-time on a split-screen Dracula TUI grid.
- 🧱 **Information Isolation**: Protects your LLM context window! Sub-agents analyze high-density records and forward metadata or summaries, and only the specialist `scientist` reads high-resolution full-text contents.
- 🔍 **Hybrid Search Fork**: Tavily API web search with automated local Ollama search fallback.
- 📄 **LiteParse Extraction**: Downloads PDFs and parses spatial layouts and tables into prompt-clean Markdown.
- ⚡ **Parallel Multi-Agent Execution**: Run multiple specialist agents simultaneously while tracking progress, tool activity, and responses dynamically.

## Installation

Both dashboards are installed together as a single package. Run this inside your Pi terminal to install them:
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

## Available Agents & Parallel Execution

The repository configures a set of specialized sub-agents with unique system prompts and tool access:

- **Planner**: Generates structured, step-by-step implementation plans for complex topics.
- **Research Manager**: Oversees the research scope and synthesizes findings into the final report.
- **Researcher**: Explores and downloads source materials; has strict memory limits (reads abstracts and first 50 lines).
- **Scientist**: Performs deep paper analysis with full-document access (methodology, results, tables).
- **Section Writer**: Produces publication-ready academic content with consistent [Author, Year] formatting.
- **Section Critic**: Evaluates written draft sections for precision, accuracy, and formatting checkpoints.

In the **Tree/List Dashboard**, any agent can invoke the `query_tree_researchers` tool to launch parallel, concurrent subprocesses querying multiple specialists at the same time:
```ts
query_tree_researchers({
  queries: [
    { agent: "researcher", question: "Research the exact speed of light..." },
    { agent: "scientist", question: "Provide a rigorous definition of gravity..." }
  ]
})
```
This safely manages isolation boundaries, intercepts execution logs, and routes the summarized results cleanly back to the manager's context.

*These dashboards will prompt you to select a starting roster (e.g. `research-team`) and activate visual panels in your view.*
