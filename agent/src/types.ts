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
  z.object({ 
    type: z.literal("init"), 
    role: z.literal("host") // Optional, if you send this
  }),
  z.object({ 
    type: z.literal("tool_result"), 
    call_id: z.string(), 
    output: z.string() 
  }),
]);

export type HostMessage = z.infer<typeof HostMessageSchema>;