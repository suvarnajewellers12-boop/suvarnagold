"use client";

import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessToast } from "@/components/SuccessToast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FilePlus2,
  Calendar,
  IndianRupee,
  Users,
  TrendingUp,
  LayoutGrid,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ================= CACHE CONFIGURATION =================
let schemesCache: any[] | null = null;

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

  // Form State
  const [form, setForm] = useState({
    name: "",
    durationMonths: "",
    monthlyAmount: "",
    maturityAmount: "",
  });

  // Schemes & Loading State
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // UI States
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showCreateBox, setShowCreateBox] = useState(false);
  
  // Selection States for Dialog
  const [selectedScheme, setSelectedScheme] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // ================= FETCH SCHEMES =================
  const fetchSchemes = async (forceRefresh = false) => {
    if (!forceRefresh && schemesCache !== null) {
      setSchemes(schemesCache);
      setIsInitialLoading(false);
      return;
    }

    try {
      if (forceRefresh) setIsInitialLoading(true);
      const res = await fetch("http://localhost:3000/api/schemes/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const fetchedSchemes = data.schemes || [];
        setSchemes(fetchedSchemes);
        schemesCache = fetchedSchemes;
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

  // ================= HANDLERS =================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSchemeClick = (scheme: any) => {
    setSelectedScheme(scheme);
    setIsDetailsOpen(true);
  };

  const handleCreateScheme = async () => {
    if (!form.name || !form.durationMonths || !form.monthlyAmount || !form.maturityAmount) {
      setToastMessage("All fields are required");
      setShowToast(true);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/schemes/create", {
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
        setForm({ name: "", durationMonths: "", monthlyAmount: "", maturityAmount: "" });
        setShowCreateBox(false);
        await fetchSchemes(true);
      }
    } catch (error) {
      setToastMessage("An error occurred during creation.");
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
          {/* HEADER */}
          <header className="bg-white dark:bg-[#0f0f0f] border-b border-gold/10 px-8 py-4 flex justify-between items-center shrink-0 w-full z-10">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60">Registry Management</span>
                <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">Savings Schemes</h1>
              </div>
              <div className="hidden lg:flex gap-6 border-l border-gold/20 pl-6">
                <div className="text-left">
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">Total Plans</p>
                  <p className="text-lg font-serif font-bold">{isInitialLoading ? "..." : schemes.length}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => fetchSchemes(true)} variant="outline" size="sm" className="h-10 rounded-full border-gold/10 text-[10px] uppercase font-bold tracking-widest">
                Refresh
              </Button>
              <Button 
                onClick={() => setShowCreateBox(!showCreateBox)}
                variant={showCreateBox ? "outline" : "gold"} 
                className="gap-2 shadow-sm font-bold uppercase tracking-widest text-[11px] h-10 px-5 transition-all duration-300 rounded-full"
              >
                {showCreateBox ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showCreateBox ? "Close Form" : "New Portfolio"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full relative">
            {/* CREATE FORM SIDEBAR */}
            <aside className={`h-full transition-all duration-500 shrink-0 z-20 ${showCreateBox ? "w-[400px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}>
              <div className="h-[calc(100vh-120px)] m-4 ml-6 bg-white dark:bg-[#0c0c0c] border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col border-b-4 border-b-gold/20 overflow-hidden">
                <div className="p-7 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="p-2 bg-gold/10 rounded-xl"><FilePlus2 className="w-5 h-5 text-gold" /></div>
                    <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-white">Create New Scheme</h2>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Scheme Identity</label>
                      <Input name="name" placeholder="Royal Sovereign" value={form.name} onChange={handleChange} className="h-10 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Tenure (Mo.)</label>
                        <Input name="durationMonths" type="number" placeholder="12" value={form.durationMonths} onChange={handleChange} className="h-10 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                      </div>
                      <div className="space-y-1.5 flex flex-col justify-end italic text-gold/50 text-[9px] mb-2">
                        Automated Couponing Enabled
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Monthly Contribution</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                        <Input name="monthlyAmount" type="number" placeholder="0.00" className="h-10 pl-10 rounded-xl bg-slate-50/50 border-gold/10 font-semibold" value={form.monthlyAmount} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 bg-gold/5 p-4 rounded-[1.8rem] border border-gold/10">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-gold ml-1">Expected Maturity</label>
                      <div className="relative flex items-center">
                        <IndianRupee className="w-5 h-5 text-gold mr-1" />
                        <Input name="maturityAmount" type="number" placeholder="0.00" className="h-10 border-none bg-transparent focus-visible:ring-0 font-bold text-gold text-2xl p-0" value={form.maturityAmount} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 shrink-0">
                    <Button variant="gold" className="w-full h-12 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-bold shadow-lg" onClick={handleCreateScheme} disabled={loading}>
                      {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Create Scheme"}
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            {/* MAIN CONTENT GRID */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#fafaf9] dark:bg-[#0a0a0a]">
              <div className="flex items-center justify-between px-8 py-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm"><LayoutGrid className="w-4 h-4 text-slate-600" /></div>
                  <h2 className="text-lg font-serif font-bold">Active Schemes</h2>
                </div>
                <Badge variant="outline" className="border-gold/30 text-[10px] text-gold px-4 py-1 uppercase tracking-widest font-bold rounded-full">System Vault</Badge>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
                <div className={`grid gap-6 transition-all duration-500 ${showCreateBox ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"}`}>
                  {isInitialLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SchemeSkeleton key={i} />)
                  ) : (
                    schemes.map((scheme) => (
                      <div 
                        key={scheme.id} 
                        onClick={() => handleSchemeClick(scheme)} 
                        className="cursor-pointer group block"
                      >
                        <LuxuryCard className="h-full hover:border-gold/40 transition-all duration-300 p-0 overflow-hidden flex flex-col shadow-sm hover:shadow-xl rounded-[22px]">
                          <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-6">
                              <h3 className="font-serif font-bold text-sm uppercase tracking-tight truncate pr-2 group-hover:text-gold transition-colors">{scheme.name}</h3>
                              <div className="bg-emerald-50 p-1.5 rounded-full"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="w-3 h-3 text-gold/60" /><span className="text-[8px] uppercase font-bold tracking-tighter">Tenure</span>
                                </div>
                                <p className="font-bold text-xs pl-5">{scheme.durationMonths} Months</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <IndianRupee className="w-3 h-3 text-gold/60" /><span className="text-[8px] uppercase font-bold tracking-tighter">Monthly</span>
                                </div>
                                <p className="font-bold text-xs pl-5">₹{Number(scheme.monthlyAmount).toLocaleString()}</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="w-3 h-3 text-gold/60" /><span className="text-[8px] uppercase font-bold tracking-tighter">Members</span>
                                </div>
                                <p className="font-bold text-xs pl-5">{scheme.customers?.length || 0}</p>
                              </div>
                              
                            </div>
                          </div>
                          <div className="bg-gold/[0.04] border-t border-gold/5 px-6 py-4 flex justify-between items-center group-hover:bg-gold/[0.07] transition-colors">
                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase italic">Maturity</p>
                            <p className="font-serif font-bold text-gold">₹{Number(scheme.maturityAmount).toLocaleString()}</p>
                          </div>
                        </LuxuryCard>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ================= MEMBER DETAILS DIALOG ================= */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-[2.5rem] border-gold/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader className="px-2">
            <div className="flex justify-between items-center pr-6">
              <div>
                <DialogTitle className="text-2xl font-serif font-bold text-gold uppercase tracking-tight">
                  {selectedScheme?.name} - Members
                </DialogTitle>
                <DialogDescription className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">
                  Enrolled Customers and Financial Performance Analysis
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                 <div className="text-right mr-2 hidden md:block">
                    <p className="text-[8px] uppercase font-black text-muted-foreground tracking-tighter">Scheme Maturity</p>
                    <p className="text-sm font-bold text-gold">₹{Number(selectedScheme?.maturityAmount).toLocaleString()}</p>
                 </div>
                 <Badge variant="gold" className="rounded-full px-4 text-[10px] py-1 border-none bg-gold/10 text-gold font-black">
                   {selectedScheme?.customers?.length || 0} Registered
                 </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-6 custom-scrollbar pr-2 pb-6 px-2">
            <div className="space-y-4">
              {selectedScheme?.customers?.length > 0 ? (
                selectedScheme.customers.map((enrollment: any) => (
                  <div key={enrollment.id} className="p-6 rounded-[2rem] bg-slate-50 border border-gold/5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-gold/20 transition-all shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-[1.2rem] bg-white shadow-sm border border-gold/5 flex items-center justify-center text-gold font-black text-xl">
                        {enrollment.customer?.name?.[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-slate-900 capitalize flex items-center gap-2">
                          {enrollment.customer?.name}
                          {enrollment.isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </h4>
                        <div className="flex items-center gap-3 mt-0.5">
                           <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                             <Clock className="w-3 h-3" />
                             Joined: {new Date(enrollment.startDate).toLocaleDateString()}
                           </div>
                           <Badge variant="outline" className="text-[8px] h-4 px-2 border-gold/20 text-gold/70 bg-gold/5">
                              ID: {enrollment.id.slice(0,8)}
                           </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-left lg:border-l border-gold/10 lg:pl-10 flex-1">
                      <div>
                        <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest mb-1">Installments</p>
                        <p className="text-sm font-bold text-slate-800">
                          {enrollment.installmentsPaid} <span className="text-[10px] text-muted-foreground font-medium">/ {selectedScheme.durationMonths} Mo.</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest mb-1">Total Paid</p>
                        <p className="text-sm font-bold text-emerald-600">₹{enrollment.totalPaid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest mb-1">Maturity Goal</p>
                        <p className="text-sm font-bold text-gold flex items-center gap-1">
                          ₹{Number(selectedScheme.maturityAmount).toLocaleString()}
                          <ShieldCheck className="w-3 h-3 opacity-50" />
                        </p>
                      </div>
                      <div className="flex items-center">
                        <Badge className={`text-[9px] uppercase font-black px-4 h-7 border-none rounded-full shadow-sm ${enrollment.isCompleted ? "bg-emerald-500 text-white" : "bg-gold/10 text-gold"}`}>
                          {enrollment.isCompleted ? "Fully Matured" : "Active Portfolio"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-60 flex flex-col items-center justify-center opacity-30">
                  <div className="p-5 bg-slate-100 rounded-full mb-4"><Users className="w-10 h-10" /></div>
                  <p className="font-serif italic text-lg text-slate-600">No member data available for this vault.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default SuperAdminCreateScheme;