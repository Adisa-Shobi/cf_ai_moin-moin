import { env } from "cloudflare:workers";
import type { Connection, ConnectionContext, Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { getSchedulePrompt } from "agents/schedule";
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
  generateId,
	type StreamTextOnFinishCallback,
	stepCountIs,
	streamText,
	type ToolSet,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { executions, tools } from "./tools";
import { type AgentEvent, HostMessageSchema } from "./types";
import { cleanupMessages, processToolCalls } from "./utils";

const workersAi = createWorkersAI({ binding: env.AI });

const model = workersAi("@cf/meta/llama-3.1-8b-instruct-fp8");

export class Chat extends AIChatAgent<Env> {
	hostConnection: WebSocket | null = null;
	guestConnections: WebSocket[] = [];

	pendingToolCalls = new Map<string, (output: string) => void>();

  

	onConnect(connection: Connection, ctx: ConnectionContext): void | Promise<void> {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") || "guest";

    if (role === "host") {
      console.log("🔌 HOST Connected (Python CLI)");
      this.hostConnection = connection;

      this.agentBroadcast({ type: "host_status", status: "online" });

      connection.addEventListener("message", async (event) => {
        try {
          const rawData = JSON.parse(event.data as string);
    
    
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
      });

      connection.addEventListener("close", () => {
        console.log("🔌 HOST Disconnected");
        this.hostConnection = null;
        this.agentBroadcast({ type: "host_status", status: "offline" });
      });

      return; 
    } 
    
    else if (role === "guest") {
      this.guestConnections.push(connection);
      
      // Remove guest when they leave
      connection.addEventListener("close", () => {
        this.guestConnections = this.guestConnections.filter(c => c !== connection);
      });

      // Send immediate status
      if (this.hostConnection) {
        connection.send(JSON.stringify({ type: "host_status", status: "online" }));
      }
      
      return super.onConnect(connection, ctx);
    }
  }

  agentBroadcast(msg: AgentEvent) {
    this.guestConnections = this.guestConnections.filter(
      (ws) => ws.readyState === WebSocket.OPEN
    );

    this.guestConnections.forEach((ws) => {
      try {
        ws.send(JSON.stringify(msg));
      } catch (err) {
        console.error("Broadcast failed for one client", err);
      }
    });
  }

	/**
	 * Handles incoming chat messages and manages the response stream
	 */
	  async onChatMessage(
	    onFinish: StreamTextOnFinishCallback<ToolSet>,
	    _options?: { abortSignal?: AbortSignal }
	  ) {
	    // const mcpConnection = await this.mcp.connect(
	    //   "https://path-to-mcp-server/sse"
	    // );

	    // Collect all tools, including MCP tools
	    const allTools = {
	      ...tools,
	      // ...this.mcp.getAITools()
	    };

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
	          system: `You are a helpful assistant that can do various tasks...

	${getSchedulePrompt({ date: new Date() })}

	If the user asks to schedule a task, use the schedule tool to schedule the task.
	`,

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


    async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}
