import sys
import os
import json
from unittest.mock import MagicMock

# Add project root to sys.path to allow importing from cli.synapse
sys.path.append(os.getcwd())

from cli.synapse.dispatcher import ToolDispatcher
import click

def test_security_gatekeeper():
    dispatcher = ToolDispatcher()
    
    # Mock click.prompt and click.echo/secho to avoid console spam and block
    original_prompt = click.prompt
    original_echo = click.echo
    original_secho = click.secho
    
    mock_prompt = MagicMock()
    click.prompt = mock_prompt
    click.echo = MagicMock()
    click.secho = MagicMock()

    try:
        # Test 1: Deny ('n')
        print("Testing Denial ('n')...")
        mock_prompt.return_value = 'n'
        result = dispatcher.dispatch("run_command", {"command": "echo test"})
        expected_denial = json.dumps({"status": "error", "output": "Permission denied by user."})
        assert result == expected_denial, f"Expected {expected_denial}, got {result}"
        assert dispatcher.auto_approve_session is False
        print("PASS: Denial works.")

        # Test 2: Allow Once ('y')
        print("Testing Allow Once ('y')...")
        mock_prompt.return_value = 'y'
        # run_command echoes the output. "echo test" -> "test\n" (via subprocess)
        result = dispatcher.dispatch("run_command", {"command": "echo success"})
        # The tool output might contain whitespace
        assert "success" in result, f"Expected output containing 'success', got {result}"
        assert dispatcher.auto_approve_session is False
        print("PASS: Allow Once works.")

        # Test 3: Allow Always ('a')
        print("Testing Allow Always ('a')...")
        mock_prompt.return_value = 'a'
        result = dispatcher.dispatch("run_command", {"command": "echo always"})
        assert "always" in result
        assert dispatcher.auto_approve_session is True
        print("PASS: Allow Always sets flag.")

        # Test 4: Auto-approve active (no prompt)
        print("Testing Auto-approve session...")
        mock_prompt.reset_mock() # Reset call count
        result = dispatcher.dispatch("run_command", {"command": "echo skip_prompt"})
        assert "skip_prompt" in result
        mock_prompt.assert_not_called()
        print("PASS: Auto-approve skips prompt.")

    finally:
        # Restore click
        click.prompt = original_prompt
        click.echo = original_echo
        click.secho = original_secho

if __name__ == "__main__":
    test_security_gatekeeper()
