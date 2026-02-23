"use client";

import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessToast } from "@/components/SuccessToast";
import { 
  FilePlus2, 
  Calendar, 
  IndianRupee, 
  TicketPercent, 
  Users, 
  TrendingUp,
  LayoutGrid,
  Plus,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// --- SKELETON COMPONENT (Shimmer effect for original loading) ---
const SchemeSkeleton = () => (
  <div className="border border-gold/10 rounded-[22px] overflow-hidden bg-white/50 animate-pulse">
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="h-6 w-32 bg-slate-200 rounded-md"></div>
        <div className="h-8 w-8 bg-slate-100 rounded-full"></div>
      </div>
      <div className="grid grid-cols-2 gap-y-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-12 bg-slate-100 rounded"></div>
            <div className="h-4 w-20 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-slate-50/50 border-t border-gold/5 px-6 py-4 flex justify-between items-center">
      <div className="h-3 w-16 bg-slate-100 rounded"></div>
      <div className="h-6 w-24 bg-gold/10 rounded"></div>
    </div>
  </div>
);

const SuperAdminCreateScheme = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [form, setForm] = useState({
    name: "",
    durationMonths: "",
    monthlyAmount: "",
    maturityAmount: "",
    completionCoupon: "",
  });

  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // For button "creating" state
  const [isInitialLoading, setIsInitialLoading] = useState(true); // For original API loading
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showCreateBox, setShowCreateBox] = useState(false);

  // ================= FETCH SCHEMES (Natural Loading) =================
  const fetchSchemes = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/schemes/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSchemes(data.schemes || []);
      }
    } catch (error) {
      console.error("Fetch error", error);
    } finally {
      // Set to false as soon as the API responds
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreateScheme = async () => {
    if (!form.name || !form.durationMonths || !form.monthlyAmount || !form.maturityAmount) {
      setToastMessage("Missing required fields");
      setShowToast(true);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("http://localhost:3000/api/schemes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setToastMessage("Scheme catalog updated successfully.");
        setShowToast(true);
        setForm({ name: "", durationMonths: "", monthlyAmount: "", maturityAmount: "", completionCoupon: "" });
        fetchSchemes();
      }
    } catch (error) {
      setToastMessage("An error occurred.");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#fafaf9] dark:bg-[#0a0a0a] w-full overflow-hidden">
        <DashboardSidebar />

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          {/* HEADER AREA */}
          <header className="bg-white dark:bg-[#0f0f0f] border-b border-gold/10 px-8 py-4 flex justify-between items-center shrink-0 w-full z-10">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60">Registry Management</span>
                <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">Savings Schemes</h1>
              </div>
              <div className="hidden lg:flex gap-6 border-l border-gold/20 pl-6">
                <div className="text-left">
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">Total Plans</p>
                  <p className="text-lg font-serif font-bold">
                    {isInitialLoading ? "..." : schemes.length}
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setShowCreateBox(!showCreateBox)}
              variant={showCreateBox ? "outline" : "gold"} 
              className="gap-2 shadow-sm font-bold uppercase tracking-widest text-[11px] h-10 px-5 transition-all duration-300 rounded-full"
            >
              {showCreateBox ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showCreateBox ? "Close Form" : "New Portfolio"}
            </Button>
          </header>

          <div className="flex-1 flex overflow-hidden w-full relative">
            
            {/* INLINE CREATE BOX PANEL */}
            <aside 
              className={`h-full transition-all duration-500 ease-in-out shrink-0 z-20
                ${showCreateBox ? "w-[400px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}
            >
              <div className="h-[calc(100vh-120px)] m-4 ml-6 bg-white dark:bg-[#0c0c0c] border border-gold/10 rounded-[2.5rem] shadow-2xl shadow-gold/5 flex flex-col border-b-4 border-b-gold/20 overflow-hidden">
                <div className="p-7 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="p-2 bg-gold/10 rounded-xl">
                      <FilePlus2 className="w-5 h-5 text-gold" />
                    </div>
                    <h2 className="text-xl font-serif font-bold  text-slate-900 dark:text-white">Create New Scheme</h2>
                  </div>

                  {/* COMPACT FORM FIELDS - NO SCROLLING */}
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-[14px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Scheme Identity</label>
                      <Input name="name" placeholder="Royal Sovereign" value={form.name} onChange={handleChange} className="h-10 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[14px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Tenure (Mo.)</label>
                        <Input name="durationMonths" type="number" placeholder="12" value={form.durationMonths} onChange={handleChange} className="h-10 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[14px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Coupon</label>
                        <Input name="completionCoupon" placeholder="Code" value={form.completionCoupon} onChange={handleChange} className="h-10 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Monthly Contribution</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                        <Input name="monthlyAmount" type="number" placeholder="0.00" className="h-10 pl-10 rounded-xl bg-slate-50/50 border-gold/10 font-semibold" value={form.monthlyAmount} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 bg-gold/5 p-4 rounded-[1.8rem] border border-gold/10">
                      <label className="text-[14px] uppercase font-bold tracking-widest text-gold ml-1">Expected Maturity</label>
                      <div className="relative flex items-center">
                        <IndianRupee className="w-5 h-5 text-gold mr-1" />
                        <Input name="maturityAmount" type="number" placeholder="0.00" className="h-10 border-none bg-transparent focus-visible:ring-0 font-semibold font-bold text-gold text-2xl p-0" value={form.maturityAmount} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 shrink-0">
                    <Button variant="gold" className="w-full h-12 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-bold shadow-lg shadow-gold/10 hover:shadow-gold/20 transition-all duration-300" onClick={handleCreateScheme} disabled={loading}>
                      {loading ? "Processing..." : "Create Scheme"}
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            {/* SCROLLABLE SCHEMES AREA */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#fafaf9] dark:bg-[#0a0a0a]">
              <div className="flex items-center justify-between px-8 py-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <LayoutGrid className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <h2 className="text-lg font-serif font-bold">Active Schemes</h2>
                </div>
                <Badge variant="outline" className="border-gold/30 text-[10px] text-gold px-4 py-1 uppercase tracking-widest font-bold rounded-full">
                  System Vault
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
                <div className={`grid gap-6 transition-all duration-500
                  ${showCreateBox 
                    ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" 
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  }`}
                >
                  {isInitialLoading ? (
                    // Show skeletons while actual fetching is happening
                    Array.from({ length: 8 }).map((_, i) => <SchemeSkeleton key={i} />)
                  ) : (
                    <>
                      {schemes.map((scheme) => (
                        <LuxuryCard key={scheme.id} className="group hover:border-gold/40 transition-all duration-300 p-0 overflow-hidden flex flex-col shadow-sm hover:shadow-xl rounded-[22px]">
                          <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-6">
                              <h3 className="font-serif font-bold text-lg leading-tight group-hover:text-gold transition-colors truncate pr-2 uppercase tracking-tight">
                                {scheme.name}
                              </h3>
                              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-full">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="w-3 h-3 text-gold/60" />
                                  <span className="text-[9px] uppercase font-bold tracking-tighter">Tenure</span>
                                </div>
                                <p className="font-bold text-xs pl-5">{scheme.durationMonths} Months</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <IndianRupee className="w-3 h-3 text-gold/60" />
                                  <span className="text-[9px] uppercase font-bold tracking-tighter">Monthly</span>
                                </div>
                                <p className="font-bold text-xs pl-5">₹{Number(scheme.monthlyAmount).toLocaleString()}</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <TicketPercent className="w-3 h-3 text-gold/60" />
                                  <span className="text-[9px] uppercase font-bold tracking-tighter">Coupon</span>
                                </div>
                                <p className="font-bold text-xs pl-5 truncate max-w-[80px]">{scheme.completionCoupon || "—"}</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="w-3 h-3 text-gold/60" />
                                  <span className="text-[9px] uppercase font-bold tracking-tighter">Members</span>
                                </div>
                                <p className="font-bold text-xs pl-5">{scheme.customers?.length || 0}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gold/[0.04] border-t border-gold/5 px-6 py-4 flex justify-between items-center group-hover:bg-gold/[0.07] transition-colors">
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase italic">Maturity</p>
                            <p className="font-serif font-bold text-gold">₹{Number(scheme.maturityAmount).toLocaleString()}</p>
                          </div>
                        </LuxuryCard>
                      ))}

                      {schemes.length === 0 && (
                        <div className="col-span-full h-80 flex flex-col items-center justify-center border-2 border-dashed border-gold/10 rounded-[2.5rem] opacity-50">
                          <p className="text-muted-foreground font-serif italic text-lg text-center">
                            The portfolio vault is empty. Initialize your first scheme.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default SuperAdminCreateScheme;