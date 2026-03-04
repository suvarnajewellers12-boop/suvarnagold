"use client";

import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar"; 
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { 
  Calendar, 
  IndianRupee, 
  TicketPercent, 
  Users, 
  TrendingUp,
  LayoutGrid,
  RefreshCw,
  Search,
  PackageSearch,
  Plus,
  X,
  FilePlus2,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ================= CACHE CONFIGURATION =================
let schemesCache: any[] | null = null;

const SchemeSkeleton = () => (
  <div className="border border-gold/10 rounded-[22px] overflow-hidden bg-white animate-pulse">
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

const AdminSchemesView = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [schemes, setSchemes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); // For creation button loading
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showCreateBox, setShowCreateBox] = useState(false);

  const [form, setForm] = useState({
    name: "",
    durationMonths: "",
    monthlyAmount: "",
    maturityAmount: "",
    completionCoupon: "",
  });

  // ================= FETCH SCHEMES WITH CACHE =================
  const fetchSchemes = async (forceRefresh = false) => {
    if (!forceRefresh && schemesCache !== null) {
      setSchemes(schemesCache);
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/schemes/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const fetchedData = data.schemes || [];
        setSchemes(fetchedData);
        schemesCache = fetchedData; 
      }
    } catch (error) {
      console.error("Fetch error", error);
    } finally {
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
      setToastMessage("All fields are mandatory");
      setShowToast(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/schemes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setToastMessage("Scheme authorized and added successfully.");
        setShowToast(true);
        setForm({ name: "", durationMonths: "", monthlyAmount: "", maturityAmount: "", completionCoupon: "" });
        setShowCreateBox(false);
        await fetchSchemes(true); // Sync cache immediately
      } else {
          const err = await res.json();
          alert(err.error || "Failed to create scheme");
      }
    } catch (error) {
      setToastMessage("Backend communication error.");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSchemes = schemes.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#fdfdfc] dark:bg-[#0a0a0a] overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          {/* HEADER AREA */}
          <header className="bg-white/80 backdrop-blur-md border-b border-gold/10 px-8 py-6 flex justify-between items-center shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600/80">Asset Registry</span>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">Savings Schemes</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden md:block mr-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search catalog..."
                  className="pl-9 w-64 h-11 rounded-xl border-gold/10 bg-slate-50/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={() => fetchSchemes(true)} 
                variant="outline" 
                size="icon"
                className="h-11 w-11 rounded-xl border-gold/20 text-gold hover:bg-gold/5"
              >
                <RefreshCw className={cn("w-5 h-5", isInitialLoading && "animate-spin")} />
              </Button>

              <Button 
                onClick={() => setShowCreateBox(!showCreateBox)}
                variant={showCreateBox ? "outline" : "gold"} 
                className="gap-2 h-11 px-6 rounded-xl font-bold shadow-sm transition-all"
              >
                {showCreateBox ? <X size={18} /> : <Plus size={18} />}
                {showCreateBox ? "Cancel" : "Add Scheme"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full relative">
            
            {/* SLIDING CREATE PANEL */}
            <aside 
              className={cn(
                "h-full transition-all duration-500 ease-in-out shrink-0 z-20",
                showCreateBox ? "w-[400px] opacity-100" : "w-0 opacity-0 overflow-hidden"
              )}
            >
              <div className="h-[calc(100vh-140px)] m-4 bg-white border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col border-b-4 border-b-gold/20 overflow-hidden">
                <div className="p-8 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-8 shrink-0">
                    <div className="p-2 bg-gold/10 rounded-xl">
                      <FilePlus2 className="w-5 h-5 text-gold" />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-slate-900">Authorize New Scheme</h2>
                  </div>

                  <div className="space-y-5 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Scheme Title</label>
                      <Input name="name" placeholder="Gold Fortune" value={form.name} onChange={handleChange} className="h-12 rounded-xl border-gold/10 focus-visible:ring-gold/20" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Duration (Mo)</label>
                        <Input name="durationMonths" type="number" placeholder="12" value={form.durationMonths} onChange={handleChange} className="h-12 rounded-xl border-gold/10" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Coupon Code</label>
                        <Input name="completionCoupon" placeholder="Optional" value={form.completionCoupon} onChange={handleChange} className="h-12 rounded-xl border-gold/10" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Monthly Amount</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/60" />
                        <Input name="monthlyAmount" type="number" placeholder="0.00" className="h-12 pl-10 rounded-xl border-gold/10" value={form.monthlyAmount} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 bg-amber-50/50 p-5 rounded-3xl border border-gold/10">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-gold ml-1">Maturity Value</label>
                      <div className="relative flex items-center">
                        <IndianRupee className="w-5 h-5 text-amber-600 mr-1" />
                        <Input name="maturityAmount" type="number" placeholder="0.00" className="h-12 border-none bg-transparent focus-visible:ring-0 font-bold text-amber-700 text-2xl p-0" value={form.maturityAmount} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 shrink-0">
                    <Button variant="gold" className="w-full h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-bold shadow-xl shadow-gold/20" onClick={handleCreateScheme} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : null}
                      {isSubmitting ? "Processing Authorization..." : "Confirm Creation"}
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            {/* MAIN CATALOG VIEW */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#fdfdfc]">
              <div className="flex items-center justify-between px-8 py-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg shadow-sm border border-amber-100">
                    <LayoutGrid className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-serif font-bold text-slate-800">Active Schemes</h2>
                </div>
                <Badge variant="outline" className="border-gold/30 text-[10px] text-gold px-4 py-1 uppercase tracking-widest font-bold rounded-full bg-gold/5">
                   Results: {filteredSchemes.length}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
                <div className={cn(
                  "grid gap-6 transition-all duration-500",
                  showCreateBox 
                    ? "grid-cols-1 xl:grid-cols-2" 
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                )}>
                  {isInitialLoading ? (
                    Array.from({ length: 10 }).map((_, i) => <SchemeSkeleton key={i} />)
                  ) : (
                    <>
                      {filteredSchemes.map((scheme) => (
                        <LuxuryCard key={scheme.id} className="group hover:border-gold/40 transition-all duration-300 p-0 overflow-hidden flex flex-col shadow-sm hover:shadow-xl rounded-[22px] border-gold/10">
                          <div className="p-6 flex-1 bg-white">
                            <div className="flex justify-between items-start mb-6">
                              <h3 className="font-serif font-bold text-sm group-hover:text-gold transition-colors truncate pr-2 uppercase text-slate-800">
                                {scheme.name}
                              </h3>
                              <div className="bg-emerald-50 p-1.5 rounded-full border border-emerald-100">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="w-3 h-3 text-gold/60" />
                                  <span className="text-[8px] uppercase font-bold tracking-tighter">Tenure</span>
                                </div>
                                <p className="font-bold text-xs pl-5 text-slate-700">{scheme.durationMonths} Mo</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <IndianRupee className="w-3 h-3 text-gold/60" />
                                  <span className="text-[8px] uppercase font-bold tracking-tighter">Per Month</span>
                                </div>
                                <p className="font-bold text-xs pl-5 text-slate-700">₹{Number(scheme.monthlyAmount).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gold/[0.03] border-t border-gold/5 px-6 py-4 flex justify-between items-center group-hover:bg-gold/[0.06] transition-colors">
                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest italic">Expected Maturity</p>
                            <p className="font-serif font-bold text-amber-700 text-lg">₹{Number(scheme.maturityAmount).toLocaleString()}</p>
                          </div>
                        </LuxuryCard>
                      ))}

                      {filteredSchemes.length === 0 && (
                        <div className="col-span-full h-80 flex flex-col items-center justify-center border-2 border-dashed border-gold/10 rounded-[2.5rem] bg-slate-50/50">
                          <PackageSearch className="w-12 h-12 text-slate-300 mb-4" />
                          <p className="text-muted-foreground font-serif italic text-lg text-center">
                            No schemes match "{searchQuery}"
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

export default AdminSchemesView;