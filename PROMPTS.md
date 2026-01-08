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