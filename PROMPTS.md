```
Role: Senior Python Engineer Project: Synapse (Remote AI Agent CLI) Current State: I have a Python CLI (built with click and websockets) that connects to a Cloudflare Worker. Currently, it listens for messages but only logs them. Goal: I need to implement the "Read-Only Tools" module. These allow the remote AI to "see" my local repository.

Task:

Create a new file cli/synapse/tools.py.

Update cli/synapse/client.py to execute these tools when a message arrives.

Specifications for cli/synapse/tools.py: Implement the following functions using subprocess (for git) and standard file I/O:

get_git_status():

Command: git status --porcelain

Returns: A string of the output.

Error Handling: Return "Error: Not a git repository" if it fails.

get_diff():

Command: git diff HEAD (captures unstaged changes) + git diff --cached (captures staged changes).

Returns: A combined string of both diffs.

read_file(path: str):

SECURITY CRITICAL: You must validate that path is within the current working directory. Do not allow ../ traversal or absolute paths that leave the repo.

Returns: The file content string.

Error Handling: Return "Error: File not found" or "Error: Security violation".

Specifications for the Dispatcher: In tools.py, create a TOOL_MAP dictionary or a dispatch_tool(name, args) function that maps string names (e.g., "read_file") to the actual Python functions.

Integration into client.py: Update the handle_message method in client.py:

When a { "type": "tool_call", "tool": "...", "id": "..." } message arrives:

Call the corresponding function from tools.py.

Important: Send the result back to the WebSocket.

The response payload must look like this:

JSON

{
  "type": "tool_result",
  "tool_call_id": "<the_id_from_request>",
  "status": "success",
  "output": "<string_output_from_tool>"
}
Constraints:

Use pathlib for file path validation.

Use subprocess.run with capture_output=True, text=True for git commands.

Keep the code clean and use type hints.

What this prompt ensures:
Security: It explicitly asks for Path Traversal protection (so the AI doesn't accidentally let the agent read your SSH keys).

Protocol Compliance: It forces the AI to reply with the specific JSON format (tool_call_id) that your Cloudflare Worker will need later to match the answer to the question.

Robustness: It handles the case where you run the tool outside a git repo.
```

```
### 📋 Prompt for AI Agent (Issue 2: Local Execution)

**Role:** Senior Python Engineer
**Goal:** Implement the "Local Tool Execution Layer" for the Synapse CLI.

**Context:**
We are building **Synapse**, a developer tool where a remote AI Agent ("Brain") controls a local Python CLI ("Hands").
We need to implement the module that accepts tool calls (JSON) and actually executes the git/file operations on the user's machine.

**Design Philosophy:**

* **Fail-Safe:** If a command fails (e.g., `git status` on a non-repo), return the error message as the tool output. **Do not crash the CLI.**
* **Strict Types:** Use **Pydantic** models to validate every incoming argument *before* touching the filesystem or shell.
* **Clean Abstraction:** Separate the "Dispatcher" (router) from the "Tools" (implementation).

**Requirements:**

1. **File Structure:**
* `cli/synapse/tools.py`: Contains the actual functions that run `subprocess` or `pathlib` operations.
* `cli/synapse/dispatcher.py`: Contains the `ToolDispatcher` class and Pydantic models.


2. **`tools.py` Specifications:**
* **Helper:** Create a robust `run_shell(command: list[str]) -> str` helper. It should capture `stdout` and `stderr`. If the return code is non-zero, return the `stderr`.
* **Implement:**
* `git_status()`: Returns output of `git status --porcelain`.
* `git_diff()`: Returns output of `git diff`.
* `read_file(path: str)`: Reads a text file. Handle `FileNotFoundError` gracefully.
* `write_file(path: str, content: str)`: Overwrites file content. Ensure parent directories exist.
* `run_command(command: str)`: Runs an arbitrary shell command.




3. **`dispatcher.py` Specifications:**
* **Pydantic Models:** Define a Pydantic model for each tool's arguments (e.g., `ReadFileArgs`, `WriteFileArgs`).
* **The Dispatcher Class:**
* Method: `dispatch(tool_name: str, arguments: dict) -> str`
* Logic:
1. Match `tool_name` to the correct Pydantic model.
2. Validate `arguments`. If validation fails, return a formatted error string.
3. Call the corresponding function in `tools.py`.
4. Return the output string.







**Example Usage (Mental Model):**

```python
dispatcher = ToolDispatcher()
# Valid Call
result = dispatcher.dispatch("read_file", {"path": "README.md"})

# Invalid Call (Should not crash, returns error string)
error = dispatcher.dispatch("read_file", {"path": 123}) 

```

**Deliverables:**
Please write the complete code for `cli/synapse/tools.py` and `cli/synapse/dispatcher.py`. Use Python 3.12+ type hinting.
```
```
📋 Prompt: Frontend Implementation - Live Context Panel
Role: Senior Frontend Engineer (React, Tailwind, TypeScript)

Objective: Refactor the current chat interface into a Split-View Workspace. Create a dedicated side panel that listens for real-time backend events to display the files currently being discussed or edited by the Agent.

1. The Backend Contract
The server uses Zod for validation. You must strictly match this schema for the data coming from the WebSocket.

src/types.ts:

TypeScript

import { z } from "zod";

// 1. The Data Structure (File/Context Item)
export const ChatAgentContextSchema = z.object({
  id: z.string(),          // Unique ID (filepath)
  type: z.enum(["file", "terminal", "doc"]),
  title: z.string(),       // Filename (e.g., "src/agent.ts")
  content: z.string(),     // The raw code content
  updatedAt: z.number(),
});
export type ChatAgentContext = z.infer<typeof ChatAgentContextSchema>;

// 2. The Event to Listen For
export const AgentEventSchema = z.object({ 
  type: z.literal("context_update"), 
  context: z.array(ChatAgentContextSchema) 
});
2. Functional Requirements
A. Layout Refactor (app/page.tsx)
Refactor the main page layout from a centered container to a Responsive Split-View:

Left Panel (Chat): The existing chat interface (messages & input).

Right Panel (Context): A new dedicated area for file content.

Behavior: The Right Panel should be collapsible (hidden on mobile or when empty) but should automatically expand when a file is loaded.

B. Context Panel Component (components/ContextPanel.tsx)
State: Maintain a list of active context items (received via WebSocket).

UI: Implement a Tabbed Interface.

If the agent reads multiple files (e.g., agent.ts and types.ts), create a tab for each.

Allow the user to switch between tabs.

Rendering: Use react-syntax-highlighter to render the content with proper code coloring.

C. Event Integration
Utilize the existing WebSocket connection.

Listen specifically for the { type: "context_update" } message.

Update the local state with the payload (context: ChatAgentContext[]).

Note: The backend sends the full list on every update, so simply replace the existing state.

3. Deliverables
components/ContextPanel.tsx: The complete component with tabs and syntax highlighting.

app/page.tsx: The updated split-screen layout implementation.

hooks/useContextEvents.ts (Optional): A helper hook to manage the event listening and state logic.
```
```
📋 Prompt: CLI Implementation - Security Gatekeeper (With Session Approval)
Role: Senior Python Systems Engineer (CLI Specialist)

Context: We are upgrading the Synapse Python CLI (built with Click) to include a security layer. Currently, the "Hands" (CLI) execute every command the Agent sends. We need a "Human-in-the-Loop" mechanism to prevent the Agent from modifying the file system without consent.

Objective: Modify the tool execution logic to intercept "Unsafe" tools. Prompt the user for approval, but include a "Allow All" option to suppress further prompts for the duration of the current session.

1. Functional Requirements
A. Define Unsafe Tools
Create a SET of unsafe tool names (e.g., write_file, run_command, git_commit).

Safe Tools: read_file, git_status, git_diff (run automatically).

B. The Gatekeeper Logic (Stateful)
Introduce a session-level flag (e.g., self.auto_approve_session = False).

Execution Flow:

Check: Is the tool in UNSAFE_TOOLS?

Check: Is self.auto_approve_session True?

If Yes: Skip prompt and execute immediately.

Prompt: If not auto-approved, pause and ask the user.

Message:

Plaintext

[⚠️ Security Alert] The Agent wants to run: <tool_name>
Arguments: <args>
Select action:
[y] Yes (Run once)
[a] Always (Allow all unsafe tools for this session)
[n] No (Deny)
C. Handling the Input
Use click.prompt with type=click.Choice(['y', 'a', 'n']) to handle the three-way selection.

Logic:

'y': Execute tool once.

'a': Set self.auto_approve_session = True -> Execute tool -> Skip future prompts.

'n': Do NOT execute. Return JSON error: {"status": "error", "output": "Permission denied by user."}.

2. Constraints
Framework: Use Click for all I/O (click.echo, click.prompt, click.style). Do not use raw input().

No Dependency Changes: DO NOT modify pyproject.toml. Use existing libraries only.

Scope: The "Always" setting is in-memory only. It should reset if the CLI is restarted.

3. Deliverables
State Management: Where/how you store the auto_approve flag within the client class.

Modified Execution Loop: The refactored dispatch function containing the prompt logic.

User Experience: Use click.style to make the alert visually distinct (e.g., Yellow/Red text).
```
```
📋 Prompt: Frontend Implementation - Collaboration Share Button
Role: Senior Frontend Engineer (React, Tailwind, TypeScript)

Context: Synapse is a distributed agent system where multiple users ("Guests") can view the same session as the "Host" (the user running the CLI). We need to make it easy for the Host to invite others to their current session.

Objective: Implement a "Share Session" button in the top navigation bar. When clicked, it should generate a shareable URL containing the current session_id and copy it to the user's clipboard, providing visual feedback via a toast notification.

1. Functional Requirements
A. URL Construction
On component mount, identify the current session_id.

Priority 1: Get it from the current URL query parameters (?session_id=xyz).

Priority 2: If missing in the URL but present in the application state, use that.

Construct the full invite URL: window.location.origin + "?session_id=" + currentSessionId.

B. The Share Component
Location: In the Chat.tsx header row (next to the Theme Toggle or Debug button).

Icon: Use the ShareNetwork or Link icon from @phosphor-icons/react.

Interaction:

Click: triggers the copy-to-clipboard action.

Feedback: Render a "Toast" notification (e.g., using sonner, react-hot-toast, or a custom temporary state) saying "Invite link copied!".

C. Guest Experience (Verification)
Ensure that when a user loads the page with ?session_id=..., the existing initialization logic correctly captures that ID and connects to the correct WebSocket room (this should already be handled by useChat, but verify the flow).

2. Implementation Details
Modify File: src/agent.tsx (or extract a new ShareButton.tsx component).

UX Flow:

User clicks the "Share" icon.

The browser clipboard receives: https://synapse.dev/?session_id=123e4567...

A small floating alert appears at the bottom/top center: "Link copied to clipboard".

The alert disappears automatically after 2-3 seconds.

Styling:

Use the existing Button component with variant="ghost" and shape="square" to match the neighboring buttons (Theme/Trash).

Ensure it works in both Dark and Light modes.

3. Deliverables
components/ShareButton.tsx: A reusable component that handles the logic.

Updated Chat.tsx: Integrate the button into the header.

Toast Integration: If no toast library exists in the project, implement a simple generic Toast component or state to handle the notification.
```