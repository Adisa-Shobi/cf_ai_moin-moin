import { Circle } from "lucide-react";

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

  const current = config[status] || config.offline;

  return (
    <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
        {current.label}
      </span>
      
      <Circle 
        size={12} 
        className={`${current.color} ${current.fill}`} 
      />
    </div>
  );
}