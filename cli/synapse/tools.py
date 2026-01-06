import subprocess
from pathlib import Path
import os

def get_git_status():
    """
    Returns the output of `git status --porcelain`.
    """
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
            cwd=os.getcwd()
        )
        return result.stdout
    except subprocess.CalledProcessError:
        return "Error: Not a git repository"

def get_diff():
    """
    Returns the output of `git diff HEAD` and `git diff --cached`.
    """
    try:
        unstaged_changes = subprocess.run(
            ["git", "diff", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=os.getcwd()
        )
        staged_changes = subprocess.run(
            ["git", "diff", "--cached"],
            capture_output=True,
            text=True,
            check=True,
            cwd=os.getcwd()
        )
        return unstaged_changes.stdout + staged_changes.stdout
    except subprocess.CalledProcessError:
        return "Error: Not a git repository"

def read_file(path: str):
    """
    Reads a file after validating it is within the current working directory.
    """
    try:
        base_dir = Path(os.getcwd())
        full_path = Path(path).resolve()
        if base_dir not in full_path.parents and not full_path.samefile(base_dir):
            return "Error: Security violation"
        if not full_path.is_file():
            return "Error: File not found"
        
        return full_path.read_text()
    except Exception as e:
        return f"Error: {e}"

TOOL_MAP = {
    "get_git_status": get_git_status,
    "get_diff": get_diff,
    "read_file": read_file,
}

def dispatch_tool(name, args):
    """
    Dispatches a tool call to the appropriate function.
    """
    if name in TOOL_MAP:
        if isinstance(args, dict):
            return TOOL_MAP[name](**args)
        elif isinstance(args, list):
            return TOOL_MAP[name](*args)
        else:
            return TOOL_MAP[name](args)
    else:
        return f"Error: Tool '{name}' not found."
