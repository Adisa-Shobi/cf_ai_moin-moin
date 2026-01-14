import { Export } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { useToast } from "@/providers/ToastProvider";

type ShareButtonProps = {
  sessionId?: string;
};

export const ShareButton = ({ sessionId }: ShareButtonProps) => {
  const { showToast } = useToast();

  const handleShare = () => {
    // Priority 1: URL Query Parameter
    const params = new URLSearchParams(window.location.search);
    let currentSessionId = params.get("session_id");

    // Priority 2: Application State (Prop)
    if (!currentSessionId && sessionId) {
      currentSessionId = sessionId;
    }

    if (currentSessionId) {
      const url = `${window.location.origin}${window.location.pathname}?session_id=${currentSessionId}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast("Invite link copied!");
      }).catch((err) => {
        console.error("Failed to copy: ", err);
        showToast("Failed to copy link");
      });
    } else {
        // Fallback: If no session ID is found (should happen rarely if ever in a connected session)
        console.warn("No session_id found to share");
    }
  };

  return (
    <Button
      variant="ghost"
      size="md"
      shape="square"
      className="rounded-full h-9 w-9"
      onClick={handleShare}
      aria-label="Share Session"
    >
      <Export size={20} />
    </Button>
  );
};
