import { env } from 'cloudflare:workers';
import Firecrawl from '@mendable/firecrawl-js';
import { getCurrentAgent } from "agents";
import { type ToolSet, tool } from "ai";
import type { Chat } from "./chat";
import { 
  TOOLS, 
  type ToolArguments, 
  type ToolNameArgs, 
  toolArgSchemas, 
  type webSearchArgs
} from "./types";
import { parseFirecrawlResults } from './utils';

export const createAgentTools = () => {
  return {
    [TOOLS.GIT_STATUS]: tool({
      description: "Check the current status of the git repository. Returns changed files.",
      inputSchema: toolArgSchemas[TOOLS.GIT_STATUS],
      execute: async () => {
        return await executeRemoteTool("git_status", {});
      },
    }),

    [TOOLS.GIT_DIFF]: tool({
      description: "Get the specific changes (diff) of the current repository.",
      inputSchema: toolArgSchemas[TOOLS.GIT_DIFF],
      execute: async () => {
        return await executeRemoteTool("git_diff", {});
      },
    }),

    [TOOLS.READ_FILE]: tool({
      description: "Read the contents of a specific file.",
      inputSchema: toolArgSchemas[TOOLS.READ_FILE],
      execute: async (args) => {
        return await executeRemoteTool("read_file", args);
      },
    }),

    [TOOLS.WRITE_FILE]: tool({
      description: "Write or overwrite content to a file.",
      inputSchema: toolArgSchemas[TOOLS.WRITE_FILE],
      execute: async (args) => {
        return await executeRemoteTool("write_file", args);
      },
    }),

    [TOOLS.RUN_COMMAND]: tool({
      description: "Execute a generic shell command (e.g., ls, mkdir, pytest).",
      inputSchema: toolArgSchemas[TOOLS.RUN_COMMAND],
      execute: async (args) => {
        return await executeRemoteTool("run_command", args);
      },
    }),
    [TOOLS.WEB_SEARCH]: tool({
      description: "Search the web using any query of you choice",
      inputSchema: toolArgSchemas[TOOLS.WEB_SEARCH]
    })
  };
};

  async function executeRemoteTool(
    name: ToolNameArgs,
    args: ToolArguments,
  ): Promise<string> {
    const { agent } = getCurrentAgent<Chat>()

    if (!agent) return ""
    console.log(`Currently remotely executing a command: ${agent.state.hostConnectionId}`);
    const hostConnectionId = agent.state.hostConnectionId;
    if (!hostConnectionId) return "Error: No Host CLI connected.";

    const connection = agent.getConnection(hostConnectionId);

    if (!connection || connection.readyState !== WebSocket.OPEN)
      return "Error: No Host CLI connection found.";

    const call_id = crypto.randomUUID();

    agent.agentBroadcast({
      type: "tool_pending",
      tool: name,
      status: "waiting_for_approval",
    });

    connection.send(
      JSON.stringify({
        type: "tool_call",
        call_id,
        name,
        arguments: args,
      }),
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (agent.pendingToolCalls.delete(call_id)) {
          reject(new Error("Tool execution timed out"));
        }
      }, 600000);

      agent.pendingToolCalls.set(call_id, {
        resolve: (output: string) => {
          clearTimeout(timeout);
          agent.agentBroadcast({ type: "tool_complete", tool: name });
          resolve(output);
        },
        tool: name,
        args,
      });
    });
  }

// const scheduleTask = tool({
//   description: "A tool to schedule a task to be executed at a later time",
//   inputSchema: scheduleSchema,
//   execute: async ({ when, description }) => {
//     // we can now read the agent context from the ALS store
//     const { agent } = getCurrentAgent<Chat>();

//     function throwError(msg: string): string {
//       throw new Error(msg);
//     }
//     if (when.type === "no-schedule") {
//       return "Not a valid schedule input";
//     }
//     const input =
//       when.type === "scheduled"
//         ? when.date // scheduled
//         : when.type === "delayed"
//           ? when.delayInSeconds // delayed
//           : when.type === "cron"
//             ? when.cron // cron
//             : throwError("not a valid schedule input");
//     try {
//       agent!.schedule(input!, "executeTask", description);
//     } catch (error) {
//       console.error("error scheduling task", error);
//       return `Error scheduling task: ${error}`;
//     }
//     return `Task scheduled for type "${when.type}" : ${input}`;
//   }
// });

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
// const getScheduledTasks = tool({
//   description: "List all tasks that have been scheduled",
//   inputSchema: z.object({}),
//   execute: async () => {
//     const { agent } = getCurrentAgent<Chat>();

//     try {
//       const tasks = agent!.getSchedules();
//       if (!tasks || tasks.length === 0) {
//         return "No scheduled tasks found.";
//       }
//       return tasks;
//     } catch (error) {
//       console.error("Error listing scheduled tasks", error);
//       return `Error listing scheduled tasks: ${error}`;
//     }
//   }
// });

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
// const cancelScheduledTask = tool({
//   description: "Cancel a scheduled task using its ID",
//   inputSchema: z.object({
//     taskId: z.string().describe("The ID of the task to cancel")
//   }),
//   execute: async ({ taskId }) => {
//     const { agent } = getCurrentAgent<Chat>();
//     try {
//       await agent!.cancelSchedule(taskId);
//       return `Task ${taskId} has been successfully canceled.`;
//     } catch (error) {
//       console.error("Error canceling scheduled task", error);
//       return `Error canceling task ${taskId}: ${error}`;
//     }
//   }
// });

export const tools = {
  ...createAgentTools()
} satisfies ToolSet

export const executions = {
  [TOOLS.WEB_SEARCH]: async (args: webSearchArgs) => {
    const firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });
    
    try {
      const res = await firecrawl.search(args.query, {
        limit: 2,
        scrapeOptions: { formats: ['markdown'] }
      });

      const parsed = parseFirecrawlResults(res);
      
      if (!parsed) return "No relevant content found.";
      
      return parsed
    } catch (_e) {
      return `Search failed`;
    }
  }
};
