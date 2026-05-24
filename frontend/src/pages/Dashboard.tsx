import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useSpeech } from "@/hooks/useSpeech";
import { useAccessibility } from "../components/context/AccessibilityContext";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StatCard } from "@/components/StatCard";
import { Link } from "react-router-dom";
import { GoldDivider } from "@/components/GoldDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Settings2, Unlock, Lock, Receipt, Loader2 } from "lucide-react";
import { AccessibleInput } from "@/components/AccessibleInput";
import { LuxuryCard } from "@/components/LuxuryCard";

export default function Dashboard() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { speak } = useSpeech();
  const { isEnabled } = useAccessibility();
  const [rates, setRates] = useState({ gold24: 0, gold22: 0, gold18: 0, silver: 0 });
  const [manualRates, setManualRates] = useState({ gold24: 6500, gold22: 5980, gold18: 4880, silver: 75 });
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanPrice = (price: string) => {
    return Number(price.replace(/[₹,]/g, ""));
  };

  const fetchLiveRates = async () => {
    try {
      setLoading(true);
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
      const data = await res.json();
      console.log("API DATA:", data);
      setRates({
        gold24: cleanPrice(data.gold24),
        gold22: cleanPrice(data.gold22),
        gold18: cleanPrice(data.gold18),
        silver: cleanPrice(data.silver),
      });
    } catch (error) {
      console.error("Failed to fetch rates", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isManual) fetchLiveRates();
  }, [isManual]);

  const displayRates = isManual ? manualRates : rates;

  useEffect(() => {
    if (!isEnabled) return;
    const timer = setTimeout(() => {
      speak(
        `Dashboard page. 
       Gold 24K rate is ${displayRates.gold24} rupees per gram. 
       Gold 22K rate is ${displayRates.gold22} rupees per gram. 
       Gold 18K rate is ${displayRates.gold18} rupees per gram. 
       Silver rate is ${displayRates.silver} rupees per gram. 
       Manual mode is ${isManual ? "enabled" : "disabled"}.
       Use tab key to navigate through controls.`
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [isEnabled, displayRates, isManual, speak]);

  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <main className="flex-1 p-6 space-y-8">

          {/* Live Rates Display — 4 cards: 24K, 22K, 18K, Silver */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard
              title="Gold 24K (1G)"
              value={displayRates.gold24}
              prefix="₹"
              icon={TrendingUp}
              loading={loading && !isManual}
              className={isManual ? "border-orange-500/50" : "border-primary/20"}
              style={{ fontFamily: "Book Antiqua" }}
            />
            <StatCard
              title="Gold 22K (1g)"
              value={displayRates.gold22}
              prefix="₹"
              icon={TrendingUp}
              loading={loading && !isManual}
              className={isManual ? "border-orange-500/50" : "border-primary/20"}
            />
            <StatCard
              title="Gold 18K (1g)"
              value={displayRates.gold18}
              prefix="₹"
              icon={TrendingUp}
              loading={loading && !isManual}
              className={isManual ? "border-orange-500/50" : "border-primary/20"}
            />
            <StatCard
              title="Silver Rate (1g)"
              value={displayRates.silver}
              prefix="₹"
              icon={TrendingUp}
              loading={loading && !isManual}
              className={isManual ? "border-orange-500/50" : "border-primary/20"}
            />
          </section>

          <GoldDivider />
          <section>
            <h2 className="text-xl font-Book Antiqua font-bold text-foreground mb-6">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* New Bill Card */}
              <Link to="/dashboard/billing" className="block no-underline">
                <LuxuryCard delay={0}>
                  <div className="text-center py-6 cursor-pointer">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-gold rounded-full flex items-center justify-center shadow-gold">
                      <Receipt className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-Book Antiqua font-bold text-lg mb-2">New Bill</h3>
                    <p className="text-sm text-muted-foreground">
                      Create a new customer bill
                    </p>
                  </div>
                </LuxuryCard>
              </Link>

              {/* View Reports Card */}
              <Link to="/dashboard/reports" className="block no-underline">
                <LuxuryCard delay={100}>
                  <div className="text-center py-6 cursor-pointer">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-luxury rounded-full flex items-center justify-center shadow-gold">
                      <TrendingUp className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "Book Antiqua" }}>
                      View Reports
                    </h3>
                    <p className="text-sm text-muted-foreground" style={{ fontFamily: "Book Antiqua, " }}>
                      Check Sales and Analytics
                    </p>
                  </div>
                </LuxuryCard>
              </Link>
            </div>
          </section>

          {/* Rate Controller — 2x2 grid */}

        </main>
      </div>
    </SidebarProvider>
  );
}