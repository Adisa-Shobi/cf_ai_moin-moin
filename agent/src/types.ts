import { z } from "zod";

export const ChatAgentContextSchema = z.object({
  id: z.string().describe("Unique ID, usually the filepath"),
  type: z.enum(["file", "terminal", "doc"]),
  title: z.string().describe("Display title, e.g. filename"),
  content: z.string(),
  updatedAt: z.number(),
})

export type ChatAgentContext = z.infer<typeof ChatAgentContextSchema>

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ 
    type: z.literal("cli_status"), 
    status: z.enum(["online", "offline"]) 
  }),
  z.object({ 
    type: z.literal("tool_pending"), 
    tool: z.string(), 
    status: z.literal("waiting_for_approval") 
  }),
  z.object({ 
    type: z.literal("tool_complete"), 
    tool: z.string(), 
    output: z.string().optional() 
  }),
  z.object({ 
    type: z.literal("error"), 
    message: z.string() 
  }),
  z.object({
    type: z.literal("context_update"),
    context: z.array(ChatAgentContextSchema).default([])
  })
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const TOOLS = {
  GIT_STATUS: "git_status",
  GIT_DIFF: "git_diff",
  READ_FILE: "read_file",
  WRITE_FILE: "write_file",
  RUN_COMMAND: "run_command",
  ADD_CONTEXT: "add_context"
} as const;

export type ToolName = typeof TOOLS[keyof typeof TOOLS];

export const ToolNameSchema = z.enum([
  TOOLS.GIT_STATUS,
  TOOLS.GIT_DIFF,
  TOOLS.READ_FILE,
  TOOLS.WRITE_FILE,
  TOOLS.RUN_COMMAND,
  TOOLS.ADD_CONTEXT
]);

export const HostMessageSchema = z.discriminatedUnion("type", [
  z.object({ 
    type: z.literal("init"), 
    role: z.literal("host") 
  }),
  
  z.object({ 
    type: z.literal("tool_result"), 
    call_id: z.string(), 
    tool_name: ToolNameSchema,
    status: z.enum(["success", "error"]),
    output: z.string() 
  }),
]);

export type HostMessage = z.infer<typeof HostMessageSchema>;

export interface AgentState {
  hostConnectionId: string | null;
  guestConnectionIds: string[];
  agentContext: ChatAgentContext[]
}

export const toolArgSchemas = {
  [TOOLS.GIT_STATUS]: z.object({}),
  [TOOLS.GIT_DIFF]: z.object({}),
  [TOOLS.READ_FILE]: z.object({
          path: z.string().describe("The relative path to the file (e.g., src/index.ts)"),
        }),
  [TOOLS.WRITE_FILE]: z.object({
          path: z.string().describe("The relative path to the file"),
          content: z.string().describe("The full content to write"),
        }),
  [TOOLS.RUN_COMMAND]: z.object({
          command: z.string().describe("The shell command to run"),
        }),
  [TOOLS.ADD_CONTEXT]: ChatAgentContextSchema
};

export type ToolNameArgs = keyof typeof toolArgSchemas;

export type ToolArguments = 
  | z.infer<typeof toolArgSchemas[typeof TOOLS.GIT_STATUS]>
  | z.infer<typeof toolArgSchemas[typeof TOOLS.READ_FILE]>
  | z.infer<typeof toolArgSchemas[typeof TOOLS.WRITE_FILE]>
  | z.infer<typeof toolArgSchemas[typeof TOOLS.RUN_COMMAND]>
  | z.infer<typeof toolArgSchemas[typeof TOOLS.ADD_CONTEXT]>;