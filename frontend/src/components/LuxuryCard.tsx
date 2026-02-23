import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface LuxuryCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}

export const LuxuryCard = ({ 
  children, 
  className, 
  hover = true,
  delay = 0 
}: LuxuryCardProps) => {
  return (
    <div
      className={cn(
        "card-luxury p-6 page-transition",
        hover && "hover:border-primary/50",
        className
      )}
      style={{ 
        animationDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
};
