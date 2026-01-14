import { AgentProvider } from "@/providers/AgentProvider";
import { ModalProvider } from "@/providers/ModalProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { TooltipProvider } from "@/providers/TooltipProvider";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <AgentProvider>
      <TooltipProvider>
        <ModalProvider>
          <ToastProvider>{children}</ToastProvider>
        </ModalProvider>
      </TooltipProvider>
    </AgentProvider>
  );
};
