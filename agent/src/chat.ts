import { env } from "cloudflare:workers";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
// import { getSchedulePrompt } from "agents/schedule";
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	type StreamTextOnFinishCallback,
	stepCountIs,
	streamText,
	type ToolSet,
  tool,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";
import { executions } from "./tools";
import { type AgentEvent, type AgentState, HostMessageSchema, type ToolArguments, type ToolName, toolArgSchemas } from "./types";
import { cleanupMessages, processToolCalls } from "./utils";

const workersAi = createWorkersAI({ binding: env.AI });

const model = workersAi("@cf/meta/llama-3.1-8b-instruct-fp8");



export class Chat extends AIChatAgent<Env, AgentState> {

  pendingToolCalls = new Map<string, (output: string) => void>();

	onConnect(connection: Connection, ctx: ConnectionContext): void | Promise<void> {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") || "guest";

    if (role === "cli") {
      console.log("🔌 HOST Connected (Python CLI)");

      this.setState({
        ...this.state,
        hostConnectionId: connection.id
      });

      this.agentBroadcast({ type: "cli_status", status: "online" });

      return; 
    } 
    
    else if (role === "guest") {
      const newGuestConnectionIds = this.state.guestConnectionIds ?? []
      newGuestConnectionIds.push(connection.id)
      this.setState({
        ...this.state,
        guestConnectionIds: newGuestConnectionIds
      });

      if (connection) {
        connection.send(JSON.stringify({ type: "host_status", status: "online" }));
      }

      if (this.state.hostConnectionId) {
        const cliConnection = this.getConnection(this.state.hostConnectionId)

        if (cliConnection) this.agentBroadcast({ type: "cli_status", status: "online" });
      }
      
      return super.onConnect(connection, ctx);
    }
  }

  onClose(connection: Connection, code: number, reason: string, wasClean: boolean): void | Promise<void> {
    // Remove the host CLI id after disconnection
    if (this.state.hostConnectionId === connection.id) {
      console.log("🔌 HOST Disconnected");
        this.setState({
          ...this.state,
          hostConnectionId: null
        })
        this.agentBroadcast({ type: "cli_status", status: "offline" });
    // Remove guest connection id after guest disconnects
    } else if (this.state.guestConnectionIds.includes(connection.id)) {
      const filteredGuestConnectionsIds = this.state.guestConnectionIds.filter(c => c !== connection.id);
        this.setState({
          ...this.state,
          guestConnectionIds: filteredGuestConnectionsIds
        })
    }

    return super.onClose(connection, code, reason, wasClean)
  }

  agentBroadcast(msg: AgentEvent) {
    this.setState({
      ...this.state,
      guestConnectionIds: this.state.guestConnectionIds.filter(
        (id) => {
          const ws = this.getConnection(id)
          return ws?.readyState === WebSocket.OPEN
        }
      )
    })

    this.state.guestConnectionIds.forEach((id) => {
      try {
        const ws = this.getConnection(id);
        if (!ws) throw new Error()
        ws.send(JSON.stringify(msg));
      } catch (err) {
        console.error("Broadcast failed for one client", err);
      }
    });
  }

  getTools() {
    return {
      // 1. GIT STATUS
      git_status: tool({
        description: "Check the current status of the git repository. Returns changed files.",
        inputSchema: z.object({}), // No args needed
        execute: async (_args) => {
          return await this.executeRemoteTool("git_status", {});
        },
      }),

      // 2. GIT DIFF
      git_diff: tool({
        description: "Get the specific changes (diff) of the current repository.",
        inputSchema: z.object({}),
        execute: async (_args) => {
          return await this.executeRemoteTool("git_diff", {});
        },
      }),

      // 3. READ FILE
      read_file: tool({
        description: "Read the contents of a specific file.",
        inputSchema: z.object({
          path: z.string().describe("The relative path to the file (e.g., src/index.ts)"),
        }),
        execute: async (args) => {
          return await this.executeRemoteTool("read_file", args);
        },
      }),

      // 4. WRITE FILE (Optional - use with caution!)
      write_file: tool({
        description: "Write or overwrite content to a file.",
        inputSchema: z.object({
          path: z.string().describe("The relative path to the file"),
          content: z.string().describe("The full content to write"),
        }),
        execute: async (args) => {
          return await this.executeRemoteTool("write_file", args);
        },
      }),

      // 5. GENERIC COMMAND RUNNER
      run_command: tool({
        description: "Execute a generic shell command (e.g., ls, mkdir, pytest).",
        inputSchema: z.object({
          command: z.string().describe("The shell command to run"),
        }),
        execute: async (args) => {
          return await this.executeRemoteTool("run_command", args);
        },
      }),
    };
  }

  onMessage(connection: Connection, message: WSMessage): void | Promise<void> {
    try {
      const rawData = JSON.parse(message as string);
      const result = HostMessageSchema.safeParse(rawData);

      if (!result.success) {
        console.error("Invalid Host Message:", result.error.format());
        return;
      }

      const msg = result.data;
      
      if (msg.type === "tool_result" && this.pendingToolCalls.has(msg.call_id)) {
        
        const resolve = this.pendingToolCalls.get(msg.call_id);
        
        if (resolve) resolve(msg.output);
        
        this.pendingToolCalls.delete(msg.call_id);
      }
    } catch (err) {
      console.error("Error processing host message:", err);
    }
    return super.onMessage(connection, message)
  }

	/**
	 * Handles incoming chat messages and manages the response stream
	 */
	  async onChatMessage(
	    onFinish: StreamTextOnFinishCallback<ToolSet>,
	    _options?: { abortSignal?: AbortSignal }
	  ) {
	    const allTools = this.getTools();

	    const stream = createUIMessageStream({
	      execute: async ({ writer }) => {
	        // Clean up incomplete tool calls to prevent API errors
	        const cleanedMessages = cleanupMessages(this.messages);

	        // Process any pending tool calls from previous messages
	        // This handles human-in-the-loop confirmations for tools
	        const processedMessages = await processToolCalls({
	          messages: cleanedMessages,
	          dataStream: writer,
	          tools: allTools,
	          executions
	        });

	        const result = streamText({
	          system: ``,

	          messages: convertToModelMessages(processedMessages),
	          model,
	          tools: allTools,
	          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
	          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
	          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
	            typeof allTools
	          >,
	          stopWhen: stepCountIs(10)
	        });

	        writer.merge(result.toUIMessageStream());
	      }
	    });

	    return createUIMessageStreamResponse({ stream });
	  }

    async executeRemoteTool(name: ToolName, args: ToolArguments): Promise<string> {
      const hostConnectionId = this.state.hostConnectionId;
      if (!hostConnectionId) return "Error: No Host CLI connected.";

      
      const connection = this.getConnection(hostConnectionId)
      
      if (!connection) return "Error: No Host CLI connection found.";
      
      const call_id = crypto.randomUUID();

      // Validate args using the appropriate schema
      const schema = toolArgSchemas[name];
      const validationResult = schema.safeParse(args);
      if (!validationResult.success) {
          console.error(`Invalid arguments for tool '${name}':`, validationResult.error.format());
          return `Error: Invalid arguments for tool '${name}': ${validationResult.error.message}`;
      }

      this.agentBroadcast({ type: "tool_pending", tool: name, status: "waiting_for_approval" });

      connection.send(JSON.stringify({ 
        type: "tool_call", 
        call_id, 
        name, 
        arguments: args 
      }));

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.pendingToolCalls.delete(call_id)) {
            reject(new Error("Tool execution timed out"));
          }
        }, 600000);

        this.pendingToolCalls.set(call_id, (output: string) => {
          clearTimeout(timeout);
          this.agentBroadcast({ type: "tool_complete", tool: name });
          resolve(output);
        });
      });
  }
}
