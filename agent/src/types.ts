import { z } from "zod";

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ 
    type: z.literal("host_status"), 
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
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;


export const HostMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("init"), role: z.literal("host") }),
  z.object({ 
    type: z.literal("tool_result"), 
    call_id: z.string(), 
    output: z.string() 
  }),
]);

export type HostMessage = z.infer<typeof HostMessageSchema>;

export interface AgentState {
  hostConnectionId: string | null;
  guestConnectionIds: string[];
}

// Schemas for tool arguments
export const ReadFileArgsSchema = z.object({
  path: z.string().min(1, { message: "Path cannot be empty." }),
});
export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>;

export const WriteFileArgsSchema = z.object({
  path: z.string().min(1, { message: "Path cannot be empty." }),
  content: z.string(),
});
export type WriteFileArgs = z.infer<typeof WriteFileArgsSchema>;

export const RunCommandArgsSchema = z.object({
  command: z.string().min(1, { message: "Command cannot be empty." }),
});
export type RunCommandArgs = z.infer<typeof RunCommandArgsSchema>;

export const NoArgsSchema = z.object({});
export type NoArgs = z.infer<typeof NoArgsSchema>;

export const toolArgSchemas = {
  git_status: NoArgsSchema,
  git_diff: NoArgsSchema,
  read_file: ReadFileArgsSchema,
  write_file: WriteFileArgsSchema,
  run_command: RunCommandArgsSchema,
};

export type ToolName = keyof typeof toolArgSchemas;

export type ToolArguments = ReadFileArgs | WriteFileArgs | RunCommandArgs | NoArgs;