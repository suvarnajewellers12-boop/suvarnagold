import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useSpeech } from "@/hooks/useSpeech";
import { useAccessibility } from "../components/context/AccessibilityContext";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StatCard } from "@/components/StatCard";
import { GoldDivider } from "@/components/GoldDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Settings2, Unlock, Lock } from "lucide-react";
import { AccessibleInput } from "@/components/AccessibleInput";

export default function Dashboard() {
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
              title="Gold 24K (1g)"
              value={displayRates.gold24}
              prefix="₹"
              icon={TrendingUp}
              loading={loading && !isManual}
              className={isManual ? "border-orange-500/50" : "border-primary/20"}
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

          {/* Rate Controller — 2x2 grid */}
          <section className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-gold" />
                <h2 className="text-xl font-serif font-bold">Rate Management</h2>
              </div>
              <div className="flex items-center gap-3 bg-muted p-2 rounded-lg">
                <span className="text-sm font-medium">Manual Mode</span>
                <Button
                  variant={isManual ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => setIsManual(!isManual)}
                >
                  {isManual ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                  {isManual ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
              {/* Gold 24K */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium">
                  Manual Gold 24K Rate (₹/g)
                </label>
                <div className="relative">
                  <AccessibleInput
                    label="manual gold 24K rate"
                    value={manualRates.gold24}
                    disabled={!isManual}
                    onChange={(val) => setManualRates({ ...manualRates, gold24: val })}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                </div>
              </div>

              {/* Gold 22K */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium">
                  Manual Gold 22K Rate (₹/g)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    disabled={!isManual}
                    value={manualRates.gold22}
                    onChange={(e) => setManualRates({ ...manualRates, gold22: Number(e.target.value) })}
                    className="text-lg font-bold pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                </div>
              </div>

              {/* Gold 18K */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium">
                  Manual Gold 18K Rate (₹/g)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    disabled={!isManual}
                    value={manualRates.gold18}
                    onChange={(e) => setManualRates({ ...manualRates, gold18: Number(e.target.value) })}
                    className="text-lg font-bold pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                </div>
              </div>

              {/* Silver */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground font-medium">
                  Manual Silver Rate (₹/g)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    disabled={!isManual}
                    value={manualRates.silver}
                    onChange={(e) => setManualRates({ ...manualRates, silver: Number(e.target.value) })}
                    className="text-lg font-bold pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                </div>
              </div>
            </div>

            {!isManual && (
              <p className="mt-6 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                Rates are currently syncing with live market data.
              </p>
            )}
          </section>

        </main>
      </div>
    </SidebarProvider>
  );
}