import { useAgent } from "agents/react";
import { useEffect, useState } from "react";
import { AgentEventSchema, type ChatAgentContext } from "../types";

export function useContextEvents() {
  const [contextFiles, setContextFiles] = useState<ChatAgentContext[]>([]);
  const agent = useAgent({ agent: "chat" });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Validate with Zod to ensure it matches expected structure
        const result = AgentEventSchema.safeParse(data);

        if (result.success && result.data.type === "context_update") {
          setContextFiles(result.data.context);
        }
      } catch (err) {
        console.error("Failed to parse agent message:", err);
      }
    };

    agent.addEventListener("message", handleMessage);
    return () => agent.removeEventListener("message", handleMessage);
  }, [agent]);

  return { contextFiles };
}
