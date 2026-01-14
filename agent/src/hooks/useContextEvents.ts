import { useGlobalAgent } from "@/providers/AgentProvider";
import type { ChatAgentContext } from "../types";

export function useContextEvents() {
  const { state } = useGlobalAgent();
  const contextFiles: ChatAgentContext[] = state?.agentContext ?? [];

  return { contextFiles };
}
