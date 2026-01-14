import { useAgent } from "agents/react";
import type { PartySocket } from "partysocket";
import { createContext, type ReactNode, useContext, useState } from "react";
import { type AgentState, AgentStateSchema } from "@/types";

interface AgentContextType {
  agent: PartySocket & {
    agent: string;
    name: string;
    setState: (state: unknown) => void;
    // biome-ignore lint/suspicious/noExplicitAny: <There is no defined type for the return of useAgent>
    call: any;
    // biome-ignore lint/suspicious/noExplicitAny: <There is no defined type for the return of useAgent>
    stub: any;
};
  state: AgentState | null;
}

const AgentContext = createContext<AgentContextType | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") ?? "default";
  const [state, setState] = useState<AgentState | null>(null);

  const agent = useAgent({
    agent: "chat",
    name: sessionId,
    onStateUpdate: (newState) => {
      const res = AgentStateSchema.safeParse(newState)
      if (!res.success) {
        setState(null);
      } else {
        setState(res.data);
      }
    },
  });

  return (
    <AgentContext.Provider value={{ agent, state }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useGlobalAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useGlobalAgent must be used within an AgentProvider");
  }
  return context;
}