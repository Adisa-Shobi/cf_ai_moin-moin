import asyncio
import json
import websockets
import requests
from rich.console import Console
from rich.logging import RichHandler
import logging

from .dispatcher import ToolDispatcher

# Setup beautiful logging
logging.basicConfig(
    level="INFO", format="%(message)s", datefmt="[%X]", handlers=[RichHandler()]
)
log = logging.getLogger("rich")
console = Console()

class SynapseClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session_id = None
        self.websocket_url: str | None = None
        self.dispatcher = ToolDispatcher()

    def get_session(self):
        """Get a new session ID and WebSocket URL from the server."""
        try:
            api_url = f"{self.base_url}/api/new-session"
            console.print(f"[bold green]🚀 Requesting new session from:[/bold green] {api_url}")
            response = requests.post(api_url)
            response.raise_for_status()
            data = response.json()
            self.session_id = data.get("sessionId")
            self.websocket_url = data.get("url")
            self.websocket_url = f"{self.websocket_url}?role=cli"
            if not self.session_id or not self.websocket_url:
                log.error("Failed to get session ID or WebSocket URL from the server.")
                return False
            console.print(f"[bold green]🎉 Connected to Session:[/bold green] {self.session_id}")
            return True
        except requests.exceptions.RequestException as e:
            log.error(f"Failed to connect to the session server: {e}")
            return False

    async def start(self):
        """Main entry point to start the connection loop."""
        self.get_session()
        if not self.websocket_url:
            return

        console.print(f"[bold green]🔌 Connecting to Synapse Brain at:[/bold green] {self.websocket_url}")

        try:
            async for websocket in websockets.connect(self.websocket_url):
                try:
                    # 1. Send Handshake
                    await self.send_handshake(websocket)
                    
                    # 2. Listen for messages
                    await self.listen(websocket)
                except websockets.ConnectionClosed:
                    log.warning("Connection lost. Reconnecting...")
                    continue
                except asyncio.CancelledError:
                    # Keyboard interrupt happened
                    console.print("[bold red]🛑 Shutting down gracefully...[/bold red]")
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
        log.info("🤝 Handshake sent (Role: HOST)")

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
            print(data)
            tool_name = data.get("name")
            tool_args = data.get("arguments")
            tool_call_id = data.get("call_id")
            
            console.print(f"\n[bold cyan]🤖 Agent Request:[/bold cyan]")
            console.print(f"   [yellow]Tool:[/yellow] {tool_name}")
            console.print(f"   [yellow]Args:[/yellow] {tool_args}")
            
            # Execute the tool
            output = self.dispatcher.dispatch(tool_name, tool_args or {})
            
            # Determine status
            status = "error" if output.strip().startswith("Error:") else "success"
            
            # Send result back
            result = {
                "type": "tool_result",
                "call_id": tool_call_id,
                "status": status,
                "output": output,
            }
            await websocket.send(json.dumps(result))
            console.print(f"\n[bold green]✅ Result Sent:[/bold green]")
            console.print(f"   [yellow]Tool:[/yellow] {tool_name}")
            console.print(f"   [yellow]Status:[/yellow] {status}")

        elif msg_type in ["cf_agent_mcp_servers", "host_status"]:
            pass
        else:
            pass
            # log.info(f"Received unknown message: {data}")
