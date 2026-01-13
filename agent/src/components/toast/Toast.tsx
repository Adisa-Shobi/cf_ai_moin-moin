import { CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type ToastProps = {
  message: string;
  visible: boolean;
};

export const Toast = ({ message, visible }: ToastProps) => {
  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]",
        "flex items-center gap-2 px-4 py-2",
        "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900",
        "rounded-full shadow-lg text-sm font-medium",
        "transition-all duration-300 transform",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <CheckCircle size={16} weight="fill" className="text-green-500" />
      <span>{message}</span>
    </div>
  );
};
