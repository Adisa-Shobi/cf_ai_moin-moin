from typing import Callable, Any
from pydantic import BaseModel, ValidationError
import click
import json

from . import tools
from .constants import UNSAFE_TOOLS

class ReadFileArgs(BaseModel):
    path: str

class WriteFileArgs(BaseModel):
    path: str
    content: str

class RunCommandArgs(BaseModel):
    command: str

# A dictionary to map tool names to their functions and argument models
TOOL_REGISTRY = {
    "git_status": {
        "function": tools.git_status,
        "args_model": None,
    },
    "git_diff": {
        "function": tools.git_diff,
        "args_model": None,
    },
    "read_file": {
        "function": tools.read_file,
        "args_model": ReadFileArgs,
    },
    "write_file": {
        "function": tools.write_file,
        "args_model": WriteFileArgs,
    },
    "run_command": {
        "function": tools.run_command,
        "args_model": RunCommandArgs,
    },
}

class ToolDispatcher:
    def __init__(self):
        self.auto_approve_session = False

    def dispatch(self, tool_name: str, arguments: dict) -> str:
        """
        Dispatches a tool call to the appropriate function with validated arguments.

        Args:
            tool_name: The name of the tool to execute.
            arguments: A dictionary of arguments for the tool.

        Returns:
            The output of the tool as a string.
        """
        if tool_name not in TOOL_REGISTRY:
            return f"Error: Tool '{tool_name}' not found."

        # Security Gatekeeper
        if tool_name in UNSAFE_TOOLS:
            if not self.auto_approve_session:
                click.echo()
                click.secho(f"[⚠️ Security Alert] The Agent wants to run: {tool_name}", fg="yellow", bold=True)
                click.echo(f"Arguments: {arguments}")
                click.echo("Select action:")
                click.echo("[y] Yes (Run once)")
                click.echo("[a] Always (Allow all unsafe tools for this session)")
                click.echo("[n] No (Deny)")
                
                choice = click.prompt("Choice", type=click.Choice(['y', 'a', 'n']), show_choices=False)
                
                if choice == 'n':
                    return json.dumps({"status": "error", "output": "Permission denied by user."})
                elif choice == 'a':
                    self.auto_approve_session = True
                # If 'y', proceed to execution

        tool_info = TOOL_REGISTRY[tool_name]
        func = tool_info["function"]
        args_model = tool_info["args_model"]

        if args_model:
            try:
                validated_args = args_model.model_validate(arguments)
                return func(**validated_args.model_dump())
            except ValidationError as e:
                return f"Error: Invalid arguments for tool '{tool_name}':\n{e}"
            except Exception as e:
                return f"An unexpected error occurred during tool execution: {e}"
        else:
            # For tools with no arguments
            if arguments:
                return f"Error: Tool '{tool_name}' does not accept any arguments."
            try:
                return func()
            except Exception as e:
                return f"An unexpected error occurred during tool execution: {e}"