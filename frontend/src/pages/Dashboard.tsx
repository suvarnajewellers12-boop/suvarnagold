import { useState,useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StatCard } from "@/components/StatCard";
import { ProductCard } from "@/components/ProductCard";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Users,
  TrendingUp,
  Wallet,
  Plus,
  Search,
  Settings2,
  Unlock,
  Lock
} from "lucide-react";



export default function Dashboard() {
  const [rates, setRates] = useState({ gold: 0, silver: 0 });
  const [manualRates, setManualRates] = useState({ gold: 6500, silver: 75 });
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanPrice = (price: string) => {
  return Number(price.replace(/[₹,]/g, ""));
};

const fetchLiveRates = async () => {
  try {
    setLoading(true);

    const res = await fetch("http://localhost:3000/api/rates");
    const data = await res.json();

    console.log("API DATA:", data); // debug

    setRates({
      gold: cleanPrice(data.gold24),
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
  console.log("rates:",rates)

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <main className="flex-1 p-6 space-y-8">
          
          {/* Live Rates Display */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              title="Gold Rate (1g)"
              value={displayRates.gold}
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

          {/* Rate Controller */}
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
                  {isManual ? <Lock className="w-4 h-4 mr-2"/> : <Unlock className="w-4 h-4 mr-2"/>}
                  {isManual ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div className="space-y-4">
                <label className="text-sm text-muted-foreground font-medium">Manual Gold Rate (₹/g)</label>
                <div className="relative">
                   <Input 
                    type="number" 
                    disabled={!isManual}
                    value={manualRates.gold}
                    onChange={(e) => setManualRates({...manualRates, gold: Number(e.target.value)})}
                    className="text-lg font-bold pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-sm text-muted-foreground font-medium">Manual Silver Rate (₹/g)</label>
                <div className="relative">
                  <Input 
                    type="number" 
                    disabled={!isManual}
                    value={manualRates.silver}
                    onChange={(e) => setManualRates({...manualRates, silver: Number(e.target.value)})}
                    className="text-lg font-bold pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                </div>
              </div>
            </div>
            {!isManual && (
              <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                Rates are currently syncing with live market data.
              </p>
            )}
          </section>

          {/* ... Rest of your Dashboard (Stats, Products, etc.) */}
          
        </main>
      </div>
    </SidebarProvider>
  );
}