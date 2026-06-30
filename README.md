# 🔬 pi-research-team: An Autonomous Multi-Agent Research Framework

The `pi-research-team` project provides a sophisticated, autonomous multi-agent system designed to streamline the academic research process. Leveraging the `pi` coding agent framework, this project orchestrates a team of specialized agents—including a Planner, Research Manager, Researcher, Scientist, Section Writer, and Section Critic—to conduct comprehensive literature reviews, extract information, and generate research reports.

This framework is built to handle complex research tasks, from initial information discovery to the drafting and refinement of academic sections, all while maintaining strict information compartmentalization between agent roles.

## ✨ Features

*   **Multi-Agent Orchestration:** A well-defined team of agents collaborating on research tasks.
*   **Role-Restricted Information Access:** Ensures agents only access information relevant to their role, promoting secure and focused processing.
*   **Automated Research Workflow:** Automates steps like paper search, PDF content extraction, citation analysis, and report generation.
*   **Extensible Skills:** Utilizes `pi` skills for specialized tasks such as web search, document parsing (LiteParse), and full document access (for authorized agents).
*   **Modular Design:** Easy to extend and adapt for different research domains or workflows.

## 🚀 Installation

To get started with `pi-research-team`, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/mbenetti/pi-research-team.git
    cd pi-research-team
    ```

2.  **Ensure `pi` is Installed:**
    This project requires the `pi` coding agent. If you don't have `pi` installed globally, please refer to its official documentation for installation instructions:
    ```bash
    # Example: If pi is an npm package
    npm install -g @earendil-works/pi-coding-agent
    ```
    *Note: This project has been migrated to utilize the `@earendil-works` namespace for the `pi` coding agent, reflecting updates in the `pi` ecosystem and ensuring compatibility with the latest features and improvements.*

3.  **Configure Environment Variables:**
    Some skills and tools (e.g., `web_search`) may require API keys (e.g., `TAVILY_API_KEY`). Ensure these are set in your environment or a `.env` file.

## 🔌 Using Extensions

It's crucial to understand that **`pi` extensions (such as `agent-team.ts`) are disabled by default** for security and performance reasons. To leverage the full multi-agent capabilities of `pi-research-team`, you must explicitly enable the `agent-team.ts` extension when invoking `pi`.

### How to Run with Extensions

To run the multi-agent research pipeline, you need to execute `pi` with the `-e` flag, specifying the `agent-team.ts` extension:

```bash
pi -e agent-team.ts
```

This command will activate the `agent-team.ts` extension, which is responsible for orchestrating the different agents (Planner, Research Manager, Researcher, Scientist, etc.) as defined in your `agents/` directory and `teams.yaml` configuration. Without this flag, `pi` will operate in a single-agent mode, and the multi-agent collaborative features will not be active.

## 📝 Example Queries

Once the `pi` agent is running with the `agent-team.ts` extension, you can interact with it using natural language queries to initiate research tasks. Here are some examples:

*   **Initiate a literature review:**
    `@research-manager "Conduct a comprehensive literature review on the latest advancements in quantum machine learning, focusing on applications in materials science."`

*   **Request a specific section of a report:**
    `@planner "Generate a background section for a paper on federated learning for medical imaging, including key challenges and recent solutions."`

*   **Ask the researcher to find specific information:**
    `@researcher "Find abstracts and metadata for papers published in the last two years on explainable AI in computer vision."`

*   **Delegate a deep analysis task to the scientist:**
    `@scientist "Analyze the methodologies and statistical approaches used in the top 3 most cited papers on reinforcement learning for robotics."`

*   **Request content generation:**
    `@section-writer "Write an introduction to a review paper about the societal impact of large language models."`

These queries demonstrate how to address specific agents to delegate tasks, enabling a fine-grained control over the research process initiated by the `pi` framework.