import asyncio
import click
from synapse.client import SynapseClient
from synapse.constants import get_base_url

@click.group()
def cli():
    """Synapse: The Remote Brain, Local Hands Agent."""
    pass

@click.command()
def start():
    """
    Connect to the Cloudflare Agent.
    """
    base_url = get_base_url()

    if not base_url.startswith("http"):
        click.echo("Error: URL must start with http:// or https://")
        return

    client = SynapseClient(base_url)
    
    # Run the asyncio loop
    try:
        asyncio.run(client.start())
    except KeyboardInterrupt:
        click.echo("\n🛑 Disconnected.")

# Register the command
cli.add_command(start)

if __name__ == "__main__":
    cli()
