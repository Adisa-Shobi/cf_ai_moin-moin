import asyncio
import json
import websockets
import requests
from rich.logging import RichHandler
from rich.panel import Panel
from rich.text import Text
import logging

from .dispatcher import ToolDispatcher
from .ui import create_console

# Setup beautiful logging
logging.basicConfig(
    level="INFO", format="%(message)s", datefmt="[%X]", handlers=[RichHandler()]
)
log = logging.getLogger("rich")
console = create_console()

class SynapseClient:
    def __init__(self, base_url: str, id: str | None):
        self.base_url = base_url
        self.session_id = id
        self.websocket_url: str | None = None
        self.dispatcher = ToolDispatcher()

    def get_session(self):
        """Get a new session ID and WebSocket URL from the server."""
        try:
            data = {}
            if (self.session_id):
                data["session_id"] = self.session_id
            api_url = f"{self.base_url}/api/new-session"
            console.print(f"Requesting {"existing" if self.session_id else "new"} session", style="info")
            response = requests.post(api_url, data)
            response.raise_for_status()
            data = response.json()
            self.session_id = data.get("sessionId")
            self.websocket_url = data.get("url")
            self.websocket_url = f"{self.websocket_url}?role=cli"
            if not self.session_id or not self.websocket_url:
                log.error("Failed to get session ID or WebSocket URL from the server.")
                return False
            
            return True
        except requests.exceptions.RequestException as e:
            log.error(f"Failed to connect to the session server: {e}")
            return False

    async def start(self):
        """Main entry point to start the connection loop."""
        self.get_session()
        if not self.websocket_url:
            return

        console.print(f"Connecting to Synapse Brain...", style="info")
        chat_url = f"{self.base_url}?session_id={self.session_id}"
        console.print(f"[success]Connected at:[/success] {chat_url}")

        try:
            async for websocket in websockets.connect(self.websocket_url):
                try:
                    # Send Handshake
                    await self.send_handshake(websocket)
                    
                    # Listen for messages
                    await self.listen(websocket)
                except websockets.ConnectionClosed:
                    log.warning("Connection lost. Reconnecting...")
                    continue
                except asyncio.CancelledError:
                    # Keyboard interrupt happened
                    console.print("\n[error]Shutting down gracefully...[/error]")
                    raise  # Re-raise to propagate upward
                except Exception as e:
                    log.error(f"Unexpected error: {e}")
                    await asyncio.sleep(1)
                    continue
        except asyncio.CancelledError:
        # Clean exit on keyboard interrupt
            pass
        
        
    async def send_handshake(self, websocket):
        """Identifies this client as the HOST."""
        handshake = {
            "type": "init",
            "role": "host"
        }
        await websocket.send(json.dumps(handshake))
        log.info("Handshake sent (Role: HOST)")

    async def listen(self, websocket):
        """Infinite loop to handle incoming Agent messages."""
        async for message in websocket:
            try:
                data = json.loads(message)
                await self.handle_message(data, websocket)
            except json.JSONDecodeError:
                log.error("Received invalid JSON")

    async def handle_message(self, data, websocket):
        """Router for incoming message types."""
        msg_type = data.get("type")

        if msg_type == "tool_call":
            tool_name = data.get("name")
            tool_args = data.get("arguments")
            tool_call_id = data.get("call_id")
            
            # Display incoming request
            request_text = Text()
            request_text.append("Tool: ", style="key")
            request_text.append(f"{tool_name}\n")
            request_text.append("Args: ", style="key")
            request_text.append(f"{json.dumps(tool_args, indent=2)}")
            
            console.print(Panel(request_text, title="Agent Request", border_style="agent.request", expand=False))
            console.print() # Add spacing
            
            # Execute the tool
            output = self.dispatcher.dispatch(tool_name, tool_args or {})
            
            # Determine status
            status = "error" if output.strip().startswith("Error:") else "success"
            
            # Send result back
            result = {
                "type": "tool_result",
                "call_id": tool_call_id,
                "tool_name": tool_name, 
                "status": status,
                "output": output,
            }
            await websocket.send(json.dumps(result))
            
            # Display result
            result_style = "success" if status == "success" else "error"
            result_text = Text()
            result_text.append("Tool: ", style="key")
            result_text.append(f"{tool_name}\n")
            result_text.append("Status: ", style="key")
            result_text.append(f"{status}", style=result_style)
            
            console.print(Panel(result_text, title="Result Sent", border_style=result_style, expand=False))
            console.print() # Add spacing

        elif msg_type in ["cf_agent_mcp_servers", "host_status"]:
            pass
        else:
            pass
            # log.info(f"Received unknown message: {data}")
