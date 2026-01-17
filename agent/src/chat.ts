import { env } from "cloudflare:workers";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type StreamTextOnFinishCallback,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { executions, tools } from "./tools";
import {
  type AgentEvent,
  type AgentState,
  type ChatAgentContext,
  HostMessageSchema,
  type readFileArgs,
  TOOLS,
  type ToolArguments,
  type ToolName,
} from "./types";
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

  onStateUpdate(state: AgentState, source: Connection | "server"): void {
    
    const isLive = this.isConnectionLive(this.state.hostConnectionId)
    const status = isLive ? "online" : "offline";
    this.agentBroadcast({ type: "cli_status", status });

    if (state.agentContext && state.agentContext.length > 0) {
      this.agentBroadcast({
        type: "context_update",
        context: state.agentContext,
      });
    }

    super.onStateUpdate(state, source);
  }

  isConnectionLive(connectionId: string | undefined) {

    const connection = connectionId ? this.getConnection(connectionId) : null;
    
    const isLive = !!(
      connection && connection.readyState === WebSocket.OPEN
    );
    
    return isLive
  }

  onConnect(
    connection: Connection,
    ctx: ConnectionContext,
  ): void | Promise<void> {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") || "guest";

    if (role === "cli") {
      console.log("🔌 HOST Connected (Python CLI)");
      this.setState({
        ...this.state,
        hostConnectionId: connection.id,
      });
      return super.onConnect(connection, ctx);
    } else if (role === "guest") {
      const guestConnectionIds = this.state.guestConnectionIds ?? [];

      this.setState({
        ...this.state,
        guestConnectionIds: [...guestConnectionIds, connection.id],
      });

      const hostIsLive =
        this.state.hostConnectionId &&
        this.getConnection(this.state.hostConnectionId);

      connection.send(
        JSON.stringify({
          type: "cli_status",
          status: hostIsLive ? "online" : "offline",
        }),
      );

      connection.send(
        JSON.stringify({
          type: "context_update",
          context: this.state.agentContext ?? [],
        }),
      );

      return super.onConnect(connection, ctx);
    }
  }

  onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): void | Promise<void> {
    // Host Disconnect
    if (this.state.hostConnectionId === connection.id) {
      console.log("🔌 HOST Disconnected");
      this.setState({
        ...this.state,
        hostConnectionId: undefined,
      });
    }
    
    const activeGuestIds = this.getActiveGuestConnections()
    
    if (
      !this.isConnectionLive(this.state.hostConnectionId) &&
      activeGuestIds.length === 0
    ) {
      this.destroy();
    }

    return super.onClose(connection, code, reason, wasClean);
  }

  getActiveGuestConnections() {
    if (!this.state.guestConnectionIds) return []
    const activeIds = (this.state.guestConnectionIds).filter((id) => {
      return this.isConnectionLive(id)
    });

    if (activeIds.length !== this.state.guestConnectionIds.length) {
      this.setState({
      ...this.state,
      guestConnectionIds: activeIds
    });
    }
    return activeIds
  }

  agentBroadcast(msg: AgentEvent) {
    const activeIds = this.getActiveGuestConnections()

    activeIds.forEach((id) => {
      try {
        this.getConnection(id)?.send(JSON.stringify(msg));
      } catch (_err) {}
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

  onMessage(connection: Connection, message: WSMessage): void | Promise<void> {
    try {
      const rawData = JSON.parse(message as string);
      const result = HostMessageSchema.safeParse(rawData);

      if (!result.success) return;
      const msg = result.data;

      if (
        msg.type === "tool_result" &&
        this.pendingToolCalls.has(msg.call_id)
      ) {
        const pending = this.pendingToolCalls.get(msg.call_id);

        if (pending) {
          if (pending.tool === TOOLS.READ_FILE && msg.status === "success") {
            const args = pending.args as readFileArgs;
            this.updateContext({
              id: args.path,
              type: "file",
              title: args.path,
              content: msg.output,
              updatedAt: Date.now(),
            });
          }
          pending.resolve(msg.output);
        }

        this.pendingToolCalls.delete(msg.call_id);
      }

      if (msg.type === "clear_context") {
          this.clearContext()
      }
    } catch (err) {
      console.error("Error processing host message:", err);
    }
    return super.onMessage(connection, message);
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal },
  ) {

    const currentContext = this.state.agentContext ?? [];

    const contextBlock =
      currentContext.length > 0
        ? `\n\n## ACTIVE CONTEXT FILES\nThe following files are currently loaded in your memory. Use them to answer questions:\n\n` +
          currentContext
            .map(
              (c) => `--- FILE: ${c.title} ---\n${c.content}\n--- END FILE ---`,
            )
            .join("\n\n")
        : "";

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cleanedMessages = cleanupMessages(this.messages);
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools,
          executions,
        });

        this.messages = processedMessages;

        const result = streamText({
          system: `You are a specialized AI Developer Agent with tools available to you.
            You can use those tools to run commands remotely on a machine where you might 
            be asked to edit code or similar use cases. Ensure to chose to the right tool for the users direct/implied request. 
            Each time you run a tool that has informative output make sure to repeat the 
            output to the users ensuring that they are kept in the loop of what is going on. ${contextBlock ?? `These are the files the user might 
            be referring to in their messages, use them for context ${contextBlock}`}`,

          messages: await convertToModelMessages(processedMessages),
          model,
          tools,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof tools
          >,
          stopWhen: stepCountIs(10),
        });

        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });
  } 
}
