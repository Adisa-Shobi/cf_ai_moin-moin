import subprocess
from pathlib import Path
import os
import shlex

def run_shell(command: list[str]) -> str:
    """
    Runs a shell command and returns the output.
    Captures stdout and stderr. If the return code is non-zero, returns stderr.
    """
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        if result.returncode != 0:
            if result.stderr:
                return result.stderr.strip()
            return f"Command failed with exit code {result.returncode}"
        return result.stdout
    except FileNotFoundError:
        return f"Error: Command '{command[0]}' not found."
    except Exception as e:
        return f"An unexpected error occurred: {e}"

def git_status() -> str:
    """Returns output of `git status --porcelain`."""
    return run_shell(["git", "status", "--porcelain"])

def git_diff() -> str:
    """Returns output of `git diff`."""
    return run_shell(["git", "diff"])

def read_file(path: str) -> str:
    """Reads a text file. Handle FileNotFoundError gracefully."""
    try:
        # For security, ensure the path is within the current project
        base_dir = Path(os.getcwd()).resolve()
        file_path = (base_dir / path).resolve()
        if base_dir not in file_path.parents and not file_path.samefile(base_dir):
            return "Error: File access is restricted to the project directory."

        if not file_path.is_file():
            return "Error: File not found."
            
        return file_path.read_text()
    except FileNotFoundError:
        return "Error: File not found."
    except Exception as e:
        return f"Error reading file: {e}"

def write_file(path: str, content: str) -> str:
    """Overwrites file content. Ensure parent directories exist."""
    try:
        # For security, ensure the path is within the current project
        base_dir = Path(os.getcwd()).resolve()
        file_path = (base_dir / path).resolve()
        
        # Check if the resolved path is within the base directory.
        if not str(file_path).startswith(str(base_dir)):
            return "Error: File writing is restricted to the project directory."

        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {e}"

def run_command(command: str) -> str:
    """Runs an arbitrary shell command."""
    # shlex.split is important for security and correctness
    return run_shell(shlex.split(command))