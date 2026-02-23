import { cn } from "@/lib/utils";

interface GoldDividerProps {
  className?: string;
}

export const GoldDivider = ({ className }: GoldDividerProps) => {
  return (
    <div className={cn("flex items-center gap-4 my-6", className)}>
      <div className="flex-1 h-px gradient-gold opacity-50" />
      <svg
        viewBox="0 0 24 24"
        className="w-6 h-6 text-primary"
        fill="currentColor"
      >
        <path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2Z" />
      </svg>
      <div className="flex-1 h-px gradient-gold opacity-50" />
    </div>
  );
};
