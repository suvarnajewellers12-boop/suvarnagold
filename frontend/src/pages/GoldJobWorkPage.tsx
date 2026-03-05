"use client";

import { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Hammer, Loader2, Calendar, Factory, Scale, Info, RefreshCw, Clock, IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";

// ================= CACHE CONFIGURATION =================
let jobWorkCache: any[] | null = null;

const JobWorkSkeleton = () => (
  <div className="p-5 border border-gold/5 rounded-2xl bg-white/50 animate-pulse flex justify-between items-center">
    <div className="flex gap-4">
      <div className="w-12 h-12 bg-muted rounded-full" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    </div>
    <div className="h-6 w-24 bg-muted rounded-lg" />
  </div>
);

export default function GoldJobWorkPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // States
  const [jobWorks, setJobWorks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [form, setForm] = useState({
    companyName: "",
    productType: "",
    goldGivenType: "MUDHA",
    goldGivenGrams: "",
    makingCharge: "",
    dateGiven: new Date().toISOString().split("T")[0],
    notes: ""
  });

  // ================= FETCH WITH CACHE =================
  const fetchJobWorks = async (forceRefresh = false) => {
    if (!forceRefresh && jobWorkCache !== null) {
      setJobWorks(jobWorkCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/jobwork/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const fetchedData = data.jobWorks || [];
      setJobWorks(fetchedData);
      jobWorkCache = fetchedData; // Sync global cache
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobWorks();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/jobwork", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          goldGivenGrams: Number(form.goldGivenGrams),
          makingCharge: Number(form.makingCharge)
        })
      });

      if (res.ok) {
        setToastMessage("Gold sent for manufacturing successfully");
        setShowToast(true);
        setForm({
          companyName: "",
          productType: "",
          goldGivenType: "MUDHA",
          goldGivenGrams: "",
          makingCharge: "",
          dateGiven: new Date().toISOString().split("T")[0],
          notes: ""
        });
        await fetchJobWorks(true); // Force refresh cache
      }
    } catch {
      setToastMessage("Failed to record job work");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <DashboardSidebar />

        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gold/10 px-8 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">Manufacturing Vault</h1>
              <p className="text-sm text-slate-500 italic flex items-center gap-2">
                <Clock className="w-3 h-3 text-gold" /> Track gold processing & job work
              </p>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => fetchJobWorks(true)}
              className="h-11 w-11 rounded-xl border-gold/20 text-gold"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </Button>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row p-8 gap-8 overflow-hidden">
            
            {/* LEFT: JOB WORK REGISTRY */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-serif font-bold text-slate-800">Recent Assignments</h2>
              </div>

              <LuxuryCard className="flex-1 overflow-hidden flex flex-col p-0 border-gold/5 shadow-none">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <JobWorkSkeleton key={i} />)
                  ) : jobWorks.length > 0 ? (
                    jobWorks.map((job) => (
                      <div key={job.id} className="group p-5 border border-gold/10 rounded-2xl bg-white hover:border-gold/30 hover:shadow-md transition-all flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gold/5 flex items-center justify-center text-gold">
                            <Factory className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-serif font-bold text-slate-800 uppercase tracking-tight">{job.companyName}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" /> {new Date(job.dateGiven).toLocaleDateString("en-GB")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{job.goldGivenGrams}g <span className="text-[10px] text-gold uppercase">{job.goldGivenType}</span></p>
                          <Badge variant="outline" className="text-[9px] uppercase border-emerald-100 text-emerald-600 bg-emerald-50">In Progress</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 italic">
                      <Hammer className="w-12 h-12 mb-2" />
                      <p>No manufacturing records found</p>
                    </div>
                  )}
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT: ENTRY FORM */}
            <div className="w-full lg:w-[450px] shrink-0">
              <LuxuryCard className="p-8 border-amber-500/20 shadow-2xl shadow-amber-900/5 bg-white">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gold/10 rounded-xl">
                    <Hammer className="w-6 h-6 text-gold" />
                  </div>
                  <h2 className="text-xl font-serif font-bold text-slate-900">Dispatch Gold</h2>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Manufacturing Partner</label>
                    <div className="relative">
                      <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/50" />
                      <Input
                        placeholder="Company Name"
                        className="pl-10 h-12 border-gold/10 focus:border-gold"
                        value={form.companyName}
                        onChange={(e) => handleChange("companyName", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Item Type</label>
                      <Input
                        placeholder="e.g. Ring"
                        className="h-12 border-gold/10"
                        value={form.productType}
                        onChange={(e) => handleChange("productType", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Gold Format</label>
                      <select
                        className="w-full h-12 rounded-md border border-gold/10 bg-white px-3 text-sm focus:ring-1 focus:ring-gold outline-none"
                        value={form.goldGivenType}
                        onChange={(e) => handleChange("goldGivenType", e.target.value)}
                      >
                        <option value="MUDHA">Mudha</option>
                        <option value="BISCUIT">Biscuit</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Weight (Grams)</label>
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/50" />
                        <Input
                          type="number"
                          placeholder="0.000"
                          className="pl-10 h-12 border-gold/10"
                          value={form.goldGivenGrams}
                          onChange={(e) => handleChange("goldGivenGrams", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Making Charge</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/50" />
                        <Input
                          type="number"
                          placeholder="₹ 0.00"
                          className="pl-10 h-12 border-gold/10 font-bold"
                          value={form.makingCharge}
                          onChange={(e) => handleChange("makingCharge", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Date Sent</label>
                    <Input
                      type="date"
                      className="h-12 border-gold/10"
                      value={form.dateGiven}
                      onChange={(e) => handleChange("dateGiven", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Special Instructions</label>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 w-4 h-4 text-gold/50" />
                      <textarea
                        className="w-full min-h-[100px] border border-gold/10 rounded-xl p-3 pl-10 text-sm focus:ring-1 focus:ring-gold outline-none"
                        placeholder="Add notes..."
                        value={form.notes}
                        onChange={(e) => handleChange("notes", e.target.value)}
                      />
                    </div>
                  </div>

                  <GoldDivider />

                  <Button
                    type="submit"
                    variant="gold"
                    className="w-full h-14 text-lg font-serif font-bold shadow-xl hover:scale-[1.01] transition-transform"
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin w-5 h-5" /> Processing...
                      </span>
                    ) : (
                      "Confirm Dispatch"
                    )}
                  </Button>
                </form>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </SidebarProvider>
  );
}

// Utility component for status badge
function Badge({ children, className, variant }: { children: React.ReactNode, className?: string, variant?: string }) {
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full font-bold text-[10px]", className)}>
      {children}
    </span>
  )
}