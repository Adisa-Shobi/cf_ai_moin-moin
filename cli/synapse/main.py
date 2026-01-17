import asyncio
import click
from synapse.client import SynapseClient
from synapse.constants import get_base_url
from synapse.ui import print_welcome_message

@click.group()
def cli():
    """Synapse: The Remote Brain, Local Hands Agent."""
    pass

@click.command()
@click.option("--id", default=None, help="Resume connection to existing Chat session")
def start(id):
    """
    Connect to the Cloudflare Agent.
    """
    print_welcome_message()
    base_url = get_base_url()

    if not base_url.startswith("http"):
        click.echo("Error: URL must start with http:// or https://")
        return

    client = SynapseClient(base_url, id)
    
    # Run the asyncio loop
    try:
        asyncio.run(client.start())
    except KeyboardInterrupt:
        click.echo("\n🛑 Disconnected.")
    except asyncio.CancelledError:
        click.echo("\n🛑 Disconnected.")

# Register the command
cli.add_command(start)

if __name__ == "__main__":
    cli()
