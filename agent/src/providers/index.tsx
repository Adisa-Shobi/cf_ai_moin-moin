import { ModalProvider } from "@/providers/ModalProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { TooltipProvider } from "@/providers/TooltipProvider";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <TooltipProvider>
      <ModalProvider>
        <ToastProvider>{children}</ToastProvider>
      </ModalProvider>
    </TooltipProvider>
  );
};
