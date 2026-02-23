import { LuxuryCard } from "@/components/LuxuryCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  delay?: number;
  className?: string;
}

export const StatCard = ({
  title,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  trend,
  delay = 0,
  className,
}: StatCardProps) => {
  return (
    <LuxuryCard delay={delay} className={cn("relative overflow-hidden", className)}>
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 gradient-gold opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-serif font-bold text-foreground">
            <AnimatedCounter
              value={value}
              prefix={prefix}
              suffix={suffix}
              duration={2000}
            />
          </h3>
          {trend && (
            <p
              className={cn(
                "text-sm mt-2 flex items-center gap-1",
                trend.isPositive ? "text-accent" : "text-destructive"
              )}
            >
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{trend.value}%</span>
              <span className="text-muted-foreground">vs last month</span>
            </p>
          )}
        </div>
        <div className="p-3 gradient-gold rounded-xl shadow-gold">
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    </LuxuryCard>
  );
};
