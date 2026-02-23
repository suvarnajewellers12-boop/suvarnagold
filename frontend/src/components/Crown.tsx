import { cn } from "@/lib/utils";

interface CrownProps {
  className?: string;
  animate?: boolean;
}

export const Crown = ({ className, animate = true }: CrownProps) => {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        animate && "logo-float",
        className
      )}
    >
      {/* Outer Glow Circle */}
      <div className="absolute w-44 h-44 rounded-full border-2 border-yellow-400/40 blur-[0.5px]" />

      {/* Inner Circle */}
      <div className="absolute w-40 h-40 rounded-full border border-yellow-300/30" />

      {/* Gold Glow Background */}
      <div className="absolute w-36 h-36 rounded-full bg-yellow-500/10 blur-2xl" />

      {/* Stars */}
      <span className="absolute top-2 right-8 text-yellow-300 text-lg sparkle-star">✦</span>
      <span className="absolute top-10 left-5 text-yellow-200 text-sm sparkle-star delay-200">✦</span>
      <span className="absolute bottom-6 right-6 text-yellow-200 text-sm sparkle-star delay-400">✦</span>
      <span className="absolute bottom-4 left-10 text-yellow-300 text-lg sparkle-star delay-600">✦</span>

      {/* Small Dots */}
      <span className="absolute top-14 right-3 w-2 h-2 bg-yellow-300 rounded-full opacity-70 sparkle-dot"></span>
      <span className="absolute bottom-10 left-3 w-2 h-2 bg-yellow-300 rounded-full opacity-60 sparkle-dot delay-300"></span>
      <span className="absolute top-6 left-16 w-1.5 h-1.5 bg-yellow-200 rounded-full opacity-60 sparkle-dot delay-500"></span>

      {/* Logo Image */}
      <img
        src="/logo.png"
        alt="Suvarna Logo"
        className="relative z-10 w-28 h-28 object-contain drop-shadow-lg"
      />
    </div>
  );
};
