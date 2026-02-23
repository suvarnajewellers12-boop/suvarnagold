import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "@/components/Sparkles";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Gem, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isMoved, setIsMoved] = useState(false);

  useEffect(() => {
    // Logo fills for 2 seconds, then move up after a short delay
    const timer = setTimeout(() => setIsMoved(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Animation Variants
  const containerVariants = {
    initial: { y: 0 },
    moveUp: {
      y: 15,
      transition: { duration: 1.5, ease: [0.45, 0, 0.55, 1] }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 100 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.2, ease: "easeOut", delay: 0.4 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut", delay: 0.6 + i * 0.2 }
    })
  };

  return (
    <div className="min-h-screen animated-gradient relative overflow-hidden flex items-center justify-center">
      <Sparkles count={20} />

      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />

      {/* Main Wrapper that handles the "Move to Top" logic */}
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate={isMoved ? "moveUp" : "initial"}
        className="relative z-10 flex flex-col items-center w-full px-6"
      >
        {/* --- LOGO SECTION --- */}
        <motion.div
          initial={{ opacity: 1, y: 300 }}
          animate={isMoved ? { y: 10, scale: 0.9 } : { y: 300, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="relative mb-8"
        >
          <div className="relative w-52 h-40">
            {/* The "Empty" silhouette */}
            <img
              src="/logo.png"
              alt="Background"
              className="absolute inset-0 w-full h-full opacity-20 grayscale"
            />
            {/* The "Filling" animation */}
            <motion.div
              initial={{ height: "0%" }}
              animate={{ height: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 right-0 overflow-hidden"
            >
              <img
                src="/logo.png"
                alt="Suvarna Logo"
                className="absolute bottom-0 w-52 h-40 max-w-none"
              />
            </motion.div>
          </div>
        </motion.div>

        {/* --- PAGE CONTENT (Hidden until logo moves) --- */}
        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate={isMoved ? "visible" : "hidden"}
          className="text-center max-w-4xl"
        >
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-primary-foreground mb-4 leading-tight">
            Suvarna Jewellery Scheme
            <span className="block text-gradient-gold bg-clip-text font-extrabold">
              Management Portal
            </span>
          </h1>

          <p className="text-xl md:text-2xl font-sans font-medium text-primary-foreground/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            A premium admin portal for managing your gold schemes, inventory,
            billing, and reports with elegance and efficiency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
            <Button
              variant="gold"
              size="xl"
              onClick={() => navigate("/login")}
              className="min-w-[230px] text-lg font-semibold py-6 shadow-gold transition-all hover:scale-105"
            >
              Login to Portal
              <ArrowRight className="w-6 h-6 ml-2" />
            </Button>

            <Button
              variant="gold-outline"
              size="xl"
              className="min-w-[230px] border-primary-foreground/40 text-primary-foreground text-lg font-semibold py-6 hover:bg-primary-foreground/10"
            >
              Learn More
            </Button>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto mb-12">
            {[
              { icon: <Shield />, title: "Secure Access", text: "Role-based authentication" },
              { icon: <Gem />, title: "Inventory", text: "Track assets with QR codes" },
              { icon: <TrendingUp />, title: "Analytics", text: "Detailed exportable reports" }
            ].map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate={isMoved ? "visible" : "hidden"}
                className="bg-card/15 backdrop-blur-md rounded-2xl p-8 border border-primary-foreground/25 shadow-xl"
              >
                <div className="w-14 h-14 gradient-gold rounded-full flex items-center justify-center mx-auto mb-5 shadow-gold text-white">
                  {item.icon}
                </div>
                <h3 className="font-sans font-bold text-xl text-primary-foreground mb-3">
                  {item.title}
                </h3>
                <p className="text-primary-foreground/80 text-sm">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Fixed Footer */}
      <footer className="absolute bottom-3 w-full text-center ">
        <p className="text-primary-foreground/50 text-xs tracking-widest uppercase">
          © 2024 Suvarna Jewellers
        </p>
      </footer>
    </div>
  );
};

export default Index;
