import { tool } from "ai";
import { 
  type ChatAgentContext, 
  TOOLS, 
  type ToolArguments, 
  type ToolNameArgs, 
  toolArgSchemas 
} from "./types";

// Define the interface for the capabilities the tools need from the Agent
export interface ToolCallbacks {
  executeRemote: (name: ToolNameArgs, args: ToolArguments) => Promise<string>;
  updateContext: (item: ChatAgentContext) => void;
}

export const createAgentTools = (callbacks: ToolCallbacks) => {
  return {
    [TOOLS.GIT_STATUS]: tool({
      description: "Check the current status of the git repository. Returns changed files.",
      inputSchema: toolArgSchemas[TOOLS.GIT_STATUS],
      execute: async () => {
        return await callbacks.executeRemote("git_status", {});
      },
    }),

    [TOOLS.GIT_DIFF]: tool({
      description: "Get the specific changes (diff) of the current repository.",
      inputSchema: toolArgSchemas[TOOLS.GIT_DIFF],
      execute: async () => {
        return await callbacks.executeRemote("git_diff", {});
      },
    }),

    [TOOLS.READ_FILE]: tool({
      description: "Read the contents of a specific file.",
      inputSchema: toolArgSchemas[TOOLS.READ_FILE],
      execute: async (args) => {
        return await callbacks.executeRemote("read_file", args);
      },
    }),

    [TOOLS.WRITE_FILE]: tool({
      description: "Write or overwrite content to a file.",
      inputSchema: toolArgSchemas[TOOLS.WRITE_FILE],
      execute: async (args) => {
        return await callbacks.executeRemote("write_file", args);
      },
    }),

    [TOOLS.RUN_COMMAND]: tool({
      description: "Execute a generic shell command (e.g., ls, mkdir, pytest).",
      inputSchema: toolArgSchemas[TOOLS.RUN_COMMAND],
      execute: async (args) => {
        return await callbacks.executeRemote("run_command", args);
      },
    }),

    [TOOLS.ADD_CONTEXT]: tool({
      description: "Add a file to the active memory context.",
      inputSchema: toolArgSchemas[TOOLS.ADD_CONTEXT],
      execute: async (args) => {
        callbacks.updateContext(args);
        return "Context updated successfully.";
      },
    }),
  };
};

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



export const executions = {
};
