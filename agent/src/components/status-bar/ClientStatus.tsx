import { Check, Circle, Copy } from "lucide-react";
import { useEffect, useState } from "react";

// Define the valid status types matching your backend messages
export type HostStatus = "online" | "offline";

interface ClientStatusProps {
  status: HostStatus;
}

export function ClientStatus({ status }: ClientStatusProps) {
  // Config map for easy switching of styles/labels
  const config = {
    online: {
      label: "Client Connected",
      color: "text-green-500",
      fill: "fill-green-500", // Makes the circle solid
    },
    offline: {
      label: "Client Disconnected",
      color: "text-red-500",
      fill: "fill-red-500",
    },
    connecting: {
      label: "Connecting...",
      color: "text-yellow-500",
      fill: "fill-yellow-500",
    },
  };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSessionId(params.get("session_id"));
    }
  }, []);

  const copyCommand = async () => {
    if (!sessionId) return;
    const command = `synapse start --id ${sessionId}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const current = config[status] || config.offline;

  return (
    <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          {current.label}
        </span>

        {status === "offline" && sessionId && (
          <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
            <code className="text-xs font-mono text-neutral-600 dark:text-neutral-300">
              synapse start --id {sessionId}
            </code>
            <button
              type="button"
              onClick={copyCommand}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-100 transition-colors"
              title="Copy command"
            >
              {copied ? (
                <Check size={14} className="text-green-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        )}
      </div>

      <Circle size={12} className={`${current.color} ${current.fill}`} />
    </div>
  );
}
