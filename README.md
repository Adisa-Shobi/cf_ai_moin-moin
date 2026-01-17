# Cloudflare Developer Agent

> **The "Remote Brain, Local Hands" AI Assistant**

This project implements a hybrid AI agent architecture where the **"Brain"** (reasoning, state management, LLM inference) lives on the Edge using **Cloudflare Durable Objects**, while the **"Hands"** (file editing, shell execution) live on your local machine via a secure **Python CLI**.

## Architecture

The system consists of two main components connected via WebSockets:

1.  **The Agent (Cloudflare Worker):** hosted on the Edge. It runs the User Interface, manages conversation history in a Durable Object, and performs AI inference using Cloudflare Workers AI (Llama 3.1).
2.  **The Host (Python CLI):** runs on your local development machine. It connects to the Agent and executes requested tools (like reading files or running git commands) *only* after your explicit approval.

## Key Features

*   **Hybrid Execution Model:** Offload heavy lifting and state management to the cloud while retaining the ability to manipulate local files securely.
*   **Remote Tool Execution:** The AI can request to run:
    *   `git status` / `git diff`
    *   `read_file` / `write_file`
    *   `run_command` (shell commands)
*   **Human-in-the-Loop Security:** All sensitive tool executions (file writes, shell commands) require explicit **Yes/No approval** from you in the Web UI before the CLI executes them.
*   **Smart Context Management:** The agent maintains a "sliding window" of active context files (max 5) to keep the LLM focused without overflowing context windows.
*   **Resilient Web Search:** Integrated with **Firecrawl** to search the web for documentation. Includes automatic content truncation to prevent large documentation pages from crashing the AI context.

## Prerequisites

*   **Node.js** & **pnpm** (for the Agent/Frontend)
*   **Python 3.12+** & **Poetry** (for the Host CLI)
*   **Cloudflare Account** (Workers AI, Durable Objects)
*   **Firecrawl API Key** (for web search capabilities)

## Installation & Setup

### 1. Agent Setup (The "Brain")

Navigate to the `agent` directory:

```bash
cd agent
pnpm install
```

Configure your environment variables. You may need to create a `.dev.vars` file or set secrets in Cloudflare for `FIRECRAWL_API_KEY`.

Start the development server:

```bash
pnpm dev
```

*Note: This will start the local Cloudflare emulation. Deploy with `pnpm run deploy` for the live edge version.*

### 2. Host CLI Setup (The "Hands")

Navigate to the `cli` directory:

```bash
cd cli
poetry install
```

## Usage Guide

1.  **Start the Host CLI:**
    In your terminal, navigate to the `cli` directory and run the Python CLI. This tool will initialize a connection and print a unique URL.

    ```bash
    poetry run synapse start
    ```

2.  **Open the Web Interface:**
    Open the URL printed by the CLI in your browser. This will load the Agent's Web UI and automatically connect to your local session.

3.  **Verify Connection:**
    Check the status indicator in the Web UI. Ensure the **Host CLI** status is green (Online), indicating that the web interface is successfully connected to your active local host.

4.  **Interact:**
    *   Ask the agent: "Check the git status of this repo."
    *   The Agent will send a request to your local machine.
    *   You will see a prompt in the Web UI asking for approval.
    *   Click **YES** to allow the command to run.
    *   The CLI executes the command locally and sends the result back to the Agent.


## Known Issues

### Context Limits
If the agent seems to "forget" files, remember it uses a sliding window of the last **5 accessed files**. You may need to ask it to read a file again to bring it back into active memory.
