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
import { executions } from "./tools";
import { type AgentEvent, type AgentState, type ChatAgentContext, HostMessageSchema, type readFileArgs, TOOLS, type ToolArguments, type ToolName, type ToolNameArgs, toolArgSchemas } from "./types";
import { cleanupMessages, processToolCalls } from "./utils";

const MAX_CONTEXT_FILES = 5

const workersAi = createWorkersAI({ binding: env.AI });

const model = workersAi("@cf/meta/llama-3.1-8b-instruct-fp8");

interface PendingCall {
  resolve: (output: string) => void;
  tool: ToolName;
  args: ToolArguments; 
}

export class Chat extends AIChatAgent<Env, AgentState> {

  pendingToolCalls = new Map<string, PendingCall>();

  onStateUpdate(state: AgentState, _source: Connection | "server"): void {
    const hostId = state.hostConnectionId;
    
    // Check if the connection exists in RAM, not just in DB (State)
    const hostConnection = hostId ? this.getConnection(hostId) : null;
    const isLive = !!(hostConnection && hostConnection.readyState === WebSocket.OPEN);
    
    // Broadcast the *effective* status
    const status = isLive ? "online" : "offline";
    this.agentBroadcast({ type: "cli_status", status });

    if (state.agentContext && state.agentContext.length > 0) {
      this.agentBroadcast({ 
        type: "context_update", 
        context: state.agentContext 
      });
    }
  }

	onConnect(connection: Connection, ctx: ConnectionContext): void | Promise<void> {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") || "guest";

    if (role === "cli") {
      console.log("🔌 HOST Connected (Python CLI)");
      this.setState({
        ...this.state,
        hostConnectionId: connection.id
      });
      return super.onConnect(connection, ctx); 
    } 
    
    else if (role === "guest") {
      const newGuestConnectionIds = this.state.guestConnectionIds ?? [];
      
      this.setState({
        ...this.state,
        guestConnectionIds: [...newGuestConnectionIds, connection.id]
      });

      const hostIsLive = this.state.hostConnectionId && this.getConnection(this.state.hostConnectionId);
      
      connection.send(JSON.stringify({ 
        type: "cli_status", 
        status: hostIsLive ? "online" : "offline" 
      }));

      if (this.state.agentContext?.length) {
        connection.send(JSON.stringify({ 
          type: "context_update", 
          context: this.state.agentContext 
        }));
      }

      return super.onConnect(connection, ctx);
    }
  }

  

  onClose(connection: Connection, code: number, reason: string, wasClean: boolean): void | Promise<void> {
    // Host Disconnect
    if (this.state.hostConnectionId === connection.id) {
        console.log("🔌 HOST Disconnected");
        this.setState({
          ...this.state,
          hostConnectionId: null
        });
    } 
    // Guest Disconnect
    else if (this.state.guestConnectionIds.includes(connection.id)) {
      this.setState({
        ...this.state,
        guestConnectionIds: this.state.guestConnectionIds.filter(c => c !== connection.id)
      });
    }

    return super.onClose(connection, code, reason, wasClean);
  }

  agentBroadcast(msg: AgentEvent) {
    const activeIds = (this.state.guestConnectionIds ?? []).filter(id => {
       const ws = this.getConnection(id);
       return ws && ws.readyState === WebSocket.OPEN;
    });

    activeIds.forEach((id) => {
      try {
        this.getConnection(id)?.send(JSON.stringify(msg));
      } catch (_err) { }
    });
  }

  updateContext(item: ChatAgentContext) {
    const current = this.state.agentContext ?? [];
    const filtered = current.filter((c) => c.id !== item.id);
    
    if (filtered.length === MAX_CONTEXT_FILES) {
      filtered.sort((a, b) => a.updatedAt - b.updatedAt)

      filtered.shift()
    }
    
    this.setState({
      ...this.state,
      agentContext: [...filtered, item],
    });
  }

  clearContext() {
    this.setState({
      ...this.state,
      agentContext: []
    })
  }

  getTools() {
    return {
      [TOOLS.GIT_STATUS]: tool({
        description: "Check the current status of the git repository. Returns changed files.",
        inputSchema: toolArgSchemas[TOOLS.GIT_STATUS], // No args needed
        execute: async (_args) => {
          return await this.executeRemoteTool("git_status", {});
        },
      }),
      [TOOLS.GIT_DIFF]: tool({
        description: "Get the specific changes (diff) of the current repository.",
        inputSchema: toolArgSchemas[TOOLS.GIT_DIFF],
        execute: async (_args) => {
          return await this.executeRemoteTool("git_diff", {});
        },
      }),
      [TOOLS.READ_FILE]: tool({
        description: "Read the contents of a specific file.",
        inputSchema: toolArgSchemas[TOOLS.READ_FILE],
        execute: async (args) => {
          return await this.executeRemoteTool("read_file", args);
        },
      }),
      [TOOLS.WRITE_FILE]: tool({
        description: "Write or overwrite content to a file.",
        inputSchema: toolArgSchemas[TOOLS.WRITE_FILE],
        execute: async (args) => {
          return await this.executeRemoteTool("write_file", args);
        },
      }),
      [TOOLS.RUN_COMMAND]: tool({
        description: "Execute a generic shell command (e.g., ls, mkdir, pytest).",
        inputSchema: toolArgSchemas[TOOLS.RUN_COMMAND],
        execute: async (args) => {
          return await this.executeRemoteTool("run_command", args);
        },
      }),
      [TOOLS.ADD_CONTEXT]: tool({
        description: "",
        inputSchema: toolArgSchemas[TOOLS.ADD_CONTEXT],
        execute: async (args) => {
          this.updateContext(args)
        }
      })
    };
  }

  onMessage(connection: Connection, message: WSMessage): void | Promise<void> {
    try {
      const rawData = JSON.parse(message as string);
      const result = HostMessageSchema.safeParse(rawData);

      if (!result.success) return;
      const msg = result.data;
      
      if (msg.type === "tool_result" && this.pendingToolCalls.has(msg.call_id)) {
        
        const pending = this.pendingToolCalls.get(msg.call_id);
        
        if (pending) {
          if (pending.tool === TOOLS.READ_FILE && msg.status === "success") {
            const args = pending.args as readFileArgs;
            this.updateContext({
              id: args.path,
              type: "file",
              title: args.path,
              content: msg.output,
              updatedAt: Date.now()
            })
          }

          pending.resolve(msg.output)
        };
        
        this.pendingToolCalls.delete(msg.call_id);
      }

      if (msg.type === "clear_context") {
          this.clearContext()
      }
    } catch (err) {
      console.error("Error processing host message:", err);
    }
    return super.onMessage(connection, message)
  }

	  async onChatMessage(
	    onFinish: StreamTextOnFinishCallback<ToolSet>,
	    _options?: { abortSignal?: AbortSignal }
	  ) {
	    const allTools = this.getTools();

      const currentContext = this.state.agentContext ?? []

      const contextBlock = currentContext.length > 0 
      ? `\n\n## ACTIVE CONTEXT FILES\nThe following files are currently loaded in your memory. Use them to answer questions:\n\n` + 
        currentContext.map(c => `--- FILE: ${c.title} ---\n${c.content}\n--- END FILE ---`).join("\n\n") 
        : ""

	    const stream = createUIMessageStream({
	      execute: async ({ writer }) => {
	        const cleanedMessages = cleanupMessages(this.messages);
	        const processedMessages = await processToolCalls({
	          messages: cleanedMessages,
	          dataStream: writer,
	          tools: allTools,
	          executions
	        });

	        const result = streamText({
	          system: `You are a specialized AI Developer Agent with tools available to you.
             You can use those tools to run commands remotely on a machine where you might 
            be asked to edit code or similar use cases. These are the files the user might 
            be referring to in their messages ${contextBlock}`,

	          messages: convertToModelMessages(processedMessages),
	          model,
	          tools: allTools,
	          onFinish: onFinish as unknown as StreamTextOnFinishCallback<typeof allTools>,
	          stopWhen: stepCountIs(10)
	        });

	        writer.merge(result.toUIMessageStream());
	      }
	    });

	    return createUIMessageStreamResponse({ stream });
	  }

    async executeRemoteTool(name: ToolNameArgs, args: ToolArguments): Promise<string> {
      const hostConnectionId = this.state.hostConnectionId;
      if (!hostConnectionId) return "Error: No Host CLI connected.";

      const connection = this.getConnection(hostConnectionId)
      
      if (!connection || connection.readyState !== WebSocket.OPEN) return "Error: No Host CLI connection found.";
      
      const call_id = crypto.randomUUID();

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

        this.pendingToolCalls.set(call_id, {
          resolve: (output: string) => {
            clearTimeout(timeout);
            this.agentBroadcast({ type: "tool_complete", tool: name });
            resolve(output);
          },
          tool: name,
          args
        });
      });
  }
}
