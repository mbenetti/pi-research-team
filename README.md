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

---

## 💡 Designing a Research Query: Minimum Viable Research Query (MVRQ)

To get high-quality results from the multi-agent team and avoid unfocused browser searches or irrelevant paper processing, use a **Minimum Viable Research Query (MVRQ)** structure. A complete query should contain:
1. **Topic**: The core subject or comparison.
2. **Scope**: Specific sub-topics to include and explicit exclusions.
3. **Depth/Timeframe**: Preferred publication years and study types (e.g. clinical trials, SOTA).
4. **Output Requirement**: Expected figures, tables, or comparative indices.

### MVRQ Example:
> **Topic**: Direct Preference Optimization (DPO) vs. RLHF in LLM alignment.  
> **Scope**: Focus on computational efficiency and training stability comparisons. Exclude non-text LLM alignment (multimodal DPO).  
> **Depth**: Include at least 3 foundational papers (e.g., Rafailov et al.) and at least 2 recent empirical reviews (2024).  
> **Output**: A comparative evaluation table summarizing computation times and resource requirements.

---

## 🔄 Pre-Planning Clarification Workflow

When a query is ambiguous, the team is equipped to perform a **Pre-Planning Clarification Step** before handing the task to the `planner`. This prevents wasteful token usage and keeps your research highly targeted.

```
 User ──> [Research Manager / Analyst] ──> Needs Clarification? (Ask questions)
                                                         │
 User <── Feedback / Criteria Answers ───────────────────┘
   │
   └──> [Research Manager] ──> Formulate Goal ──> [planner] ──> Start Execution
```

1. **Clarification Stage (`prompts/clarify-research.md`)**:
   If a general query like *"Research AI in healthcare"* is received, the Manager uses the clarification prompt to generate 2-3 targeted questions detailing:
   * **Scope**: What specific sub-topics/applications (e.g., diagnostic imaging vs. drug discovery)?
   * **Depth**: Are we looking for foundational papers or state-of-the-art advances?
   * **Timeframe**: Focus on general history or recent papers (last 2 years)?
   * **Use case**: Literature review, thesis reference, or general learning?

2. **Goal Formation (`prompts/create-goal.md`)**:
   Once the answers are returned, the manager creates a highly structured **Research Goal** detailing objective boundaries, success criteria, and targets.

3. **Planning Stage**:
   The finalized Research Goal is given to the `planner` to design an execution roadmap for the `researcher`, `scientist`, `section-writer`, and `section-critic` agents.

---

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
