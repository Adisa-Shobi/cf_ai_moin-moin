from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text
from rich.theme import Theme

synapse_theme = Theme({
    "info": "dim cyan",
    "warning": "magenta",
    "error": "bold red",
    "success": "bold green",
    "agent.request": "bold cyan",
    "agent.result": "bold green",
    "panel.border": "blue",
    "key": "bold yellow",
})

def create_console():
    return Console(theme=synapse_theme)

WELCOME_MD = r"""
# Welcome to Synapse

```text
   _____                                      
  / ____|                                     
 | (___  _   _ _ __   __ _ _ __  ___  ___ 
  \___ \| | | | '_ \ / _` | '_ \/ __|/ _ \
  ____) | |_| | | | | (_| | |_) \__ \  __/
 |_____/ \__, |_| |_|\__,_| .__/|___/\___|
          __/ |           | |             
         |___/            |_|             
```

**The Remote Brain, Local Hands Agent.**

## 🚀 Getting Started

You are about to establish a secure connection between your local machine and the Synapse Cloud Agent.

### 📋 Instructions

1.  **Wait for the Link**: A unique authentication URL will be generated momentarily.
2.  **Access Dashboard**:
    *   **macOS**: Hold `Cmd` and click the link.
    *   **Windows/Linux**: Hold `Ctrl` and click the link.
3.  **Stay Connected**: Please **do not close this terminal window**. It acts as the bridge for file operations and command execution.

---
"""

def print_welcome_message():
    console = create_console()
    md = Markdown(WELCOME_MD)
    console.print(md)
    console.print()  # Add some spacing
