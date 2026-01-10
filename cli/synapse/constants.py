import os

DEFAULT_API_URL = "https://synapse-worker.s-oadisa-dev.workers.dev"

UNSAFE_TOOLS = {"write_file", "run_command"}

def get_base_url():
    # Priority 2: Environment Variable
    return os.getenv("SYNAPSE_URL", DEFAULT_API_URL)
