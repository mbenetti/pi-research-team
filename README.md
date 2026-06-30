# pi-research-team

This project provides a multi-agent system for conducting academic research within the pi coding agent framework. It orchestrates a team of specialized agents (Researcher, Scientist, Section Writer, etc.) to streamline the literature review, data extraction, analysis, and report generation processes. The system is designed to handle complex research queries by breaking them down into manageable tasks for each agent, enhancing efficiency and collaboration in academic workflows.

---

## Installation

You have two primary options for installing and running `pi-research-team`:

### Option 1: Global Installation (Via `pi install`)

This method is recommended for most users as it allows pi to manage the installation and updates.

1.  **Install with `pi install`**:
    Install the `pi-research-team` package globally using the `pi install` command. This will clone the repository and make the extensions available to your pi environment.

    ```bash
    pi install git:github.com/mbenetti/pi-research-team.git
    ```

2.  **Running Extensions Explicitly**:
    After installation, you can run the extensions directly by referencing their paths within your `~/.pi` directory. This is useful for testing without modifying your `pi config` permanently.

    ```bash
    pi -e ~/.pi/agent/git/github.com/mbenetti/pi-research-team/extensions/agent-team.ts
    pi -e ~/.pi/agent/git/github.com/mbenetti/pi-research-team/extensions/research-tree.ts
    pi -e ~/.pi/agent/git/github.com/mbenetti/pi-research-team/extensions/research-tui.ts
    ```

3.  **Optional: Using `pi config` to Toggle Resources**:
    For a more integrated experience, you can use `pi config` to interactively enable these extensions. This will add them to your `~/.pi/config` file, so they are loaded automatically every time `pi` starts.

    ```bash
    pi config
    ```
    Navigate through the interactive configuration utility to enable the `agent-team.ts`, `research-tree.ts`, and `research-tui.ts` extensions.

### Option 2: Local Installation (Cloning and Pointing Locally)

This method is ideal for developers or users who want to modify and experiment with the `pi-research-team` source code directly.

1.  **Clone the Repository and Navigate**:
    First, clone the `pi-research-team` repository from GitHub and change into the project directory.

    ```bash
    git clone https://github.com/mbenetti/pi-research-team.git
    cd pi-research-team
    ```

2.  **Install Dependencies**:
    Install the necessary Node.js dependencies using `npm`.

    ```bash
    npm install
    ```

3.  **Run Local Extensions Directly**:
    Once dependencies are installed, you can run the extensions relative to your current working directory.

    ```bash
    pi -e extensions/agent-team.ts
    pi -e extensions/research-tree.ts
    pi -e extensions/research-tui.ts
    ```

---

## Up-to-date Scope Notes

This iteration of `pi-research-team` has undergone significant updates, including a transition from the deprecated `@mariozechner/*` dependencies and internal modules to the current `@earendil-works/*` scope. This change ensures better maintainability, compatibility, and ongoing support. Additionally, all identified security vulnerabilities have been addressed and resolved to provide a more stable and secure research environment.

---

## Example Queries for the Multi-Agent System

Here are some example queries you can provide to the `pi-research-team` multi-agent system to kickstart its research capabilities:

*   "Conduct a literature review on the latest advancements in quantum computing for drug discovery."
*   "Summarize recent research regarding the impact of climate change on ocean biodiversity, focusing on studies published in the last five years."
*   "Analyze different deep learning architectures used for medical image segmentation and identify their pros and cons."
*   "Investigate the effectiveness of various reinforcement learning algorithms in managing smart grid energy distribution."
*   "Generate a report on the ethical considerations surrounding the deployment of large language models in educational settings."
