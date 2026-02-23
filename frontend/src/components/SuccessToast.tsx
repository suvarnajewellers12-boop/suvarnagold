import { useEffect, useState } from "react";
import { Sparkles } from "@/components/Sparkles";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export const SuccessToast = ({ message, isVisible, onClose }: SuccessToastProps) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
    >
      <div className="relative bg-card border-2 border-primary rounded-xl p-4 shadow-gold-lg min-w-[300px] overflow-hidden celebrate">
        <Sparkles count={8} />
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2 gradient-gold rounded-full">
            <CheckCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-foreground">Success!</h4>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
