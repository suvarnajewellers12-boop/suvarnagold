import { useRef } from "react";
import { useSpeech } from "@/hooks/useSpeech";

type Props = {
  label: string;
  children: React.ReactNode;
};

export const AccessibleFocus = ({ label, children }: Props) => {
  const { speak } = useSpeech();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleFocus = () => {
    // debounce to avoid rapid tab spam
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      speak(label);
    }, 250);
  };

  return (
    <div
      tabIndex={-1} // child handles tab, we just listen
      onFocus={handleFocus}
    >
      {children}
    </div>
  );
};