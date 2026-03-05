"use client";

import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { 
  Hammer, Loader2, Calendar, Factory, Scale, 
  Info, RefreshCw, Clock, CheckCircle2, IndianRupee,
  X, ChevronRight, MapPin, ClipboardList
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    productType: "",
    goldGivenType: "MUDHA",
    goldGivenGrams: "",
    makingCharge: "",
    dateGiven: new Date().toISOString().split("T")[0],
    notes: ""
  });

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
      const fetchedData = data.jobworks || []; 
      setJobWorks(fetchedData);
      jobWorkCache = fetchedData; 
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchJobWorks(); }, []);

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
        await fetchJobWorks(true); 
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
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gold/10 px-8 py-6 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900 text-left">Manufacturing Vault</h1>
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
                <h2 className="text-xl font-serif font-bold text-slate-800 text-left">Recent Assignments</h2>
              </div>

              <LuxuryCard className="flex-1 overflow-hidden flex flex-col p-0 border-gold/5 shadow-none bg-white">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <JobWorkSkeleton key={i} />)
                  ) : jobWorks.length > 0 ? (
                    jobWorks.map((job) => (
                      <div 
                        key={job.id} 
                        onClick={() => setSelectedJob(job)}
                        className="group p-5 border border-gold/10 rounded-2xl bg-white hover:border-gold/30 hover:shadow-md transition-all flex justify-between items-center cursor-pointer"
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                            job.status === "DELIVERED" ? "bg-blue-50 text-blue-600" : "bg-gold/5 text-gold"
                          )}>
                            {job.status === "DELIVERED" ? <CheckCircle2 className="w-6 h-6" /> : <Factory className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className="font-serif font-bold text-slate-800 uppercase tracking-tight">{job.companyName}</p>
                            <p className="text-[10px] font-bold text-gold uppercase mb-1">{job.productType}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" /> {new Date(job.dateGiven).toLocaleDateString("en-GB")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{job.goldGivenGrams}g <span className="text-[10px] text-slate-400 uppercase font-medium">{job.goldGivenType}</span></p>
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase mt-2 border",
                            job.status === "DELIVERED" 
                                ? "border-blue-100 text-blue-600 bg-blue-50" 
                                : "border-amber-100 text-amber-600 bg-amber-50"
                          )}>
                             {job.status === "DELIVERED" ? "Delivered" : "Pending"}
                          </span>
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
            <div className="w-full lg:w-[450px] shrink-0 h-full pb-4">
              <LuxuryCard className="h-full flex flex-col border-amber-500/20 shadow-2xl bg-white p-0 overflow-hidden">
                <div className="p-8 pb-4 shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gold/10 rounded-xl">
                      <Hammer className="w-6 h-6 text-gold" />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-slate-900 text-left">Dispatch Gold</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest ml-1 text-left">New Manufacturing Entry</p>
                </div>

                <GoldDivider />
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-8 py-4 space-y-5 custom-scrollbar">
                    {/* Form fields same as before... */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Manufacturing Partner</label>
                      <div className="relative">
                        <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/50" />
                        <Input
                          placeholder="Company Name"
                          className="pl-10 h-11 border-gold/10 focus:border-gold"
                          value={form.companyName}
                          onChange={(e) => handleChange("companyName", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Item Type</label>
                        <Input
                          placeholder="e.g. Ring"
                          className="h-11 border-gold/10"
                          value={form.productType}
                          onChange={(e) => handleChange("productType", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Gold Format</label>
                        <select
                          className="w-full h-11 rounded-md border border-gold/10 bg-white px-3 text-sm focus:ring-1 focus:ring-gold outline-none"
                          value={form.goldGivenType}
                          onChange={(e) => handleChange("goldGivenType", e.target.value)}
                        >
                          <option value="MUDHA">Mudha</option>
                          <option value="BISCUIT">Biscuit</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Weight (Grams)</label>
                        <div className="relative">
                          <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/50" />
                          <Input
                            type="number"
                            placeholder="0.000"
                            className="pl-10 h-11 border-gold/10"
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
                            className="pl-10 h-11 border-gold/10 font-bold"
                            value={form.makingCharge}
                            onChange={(e) => handleChange("makingCharge", e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 block">Date Sent</label>
                      <Input
                        type="date"
                        className="h-11 border-gold/10"
                        value={form.dateGiven}
                        onChange={(e) => handleChange("dateGiven", e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5 text-left pb-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 block">Notes</label>
                      <div className="relative">
                        <Info className="absolute left-3 top-3 w-4 h-4 text-gold/50" />
                        <textarea
                          className="w-full min-h-[80px] border border-gold/10 rounded-xl p-3 pl-10 text-sm focus:ring-1 focus:ring-gold outline-none"
                          placeholder="Add notes..."
                          value={form.notes}
                          onChange={(e) => handleChange("notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-8 pt-4 border-t border-gold/5 shrink-0 bg-slate-50/50">
                    <Button
                      type="submit"
                      variant="gold"
                      className="w-full h-14 text-lg font-serif font-bold shadow-xl hover:scale-[1.01] transition-transform"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin w-5 h-5" /> Processing...
                        </span>
                      ) : (
                        "Confirm Dispatch"
                      )}
                    </Button>
                  </div>
                </form>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      {/* ================= DETAILS DIALOG ================= */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-gold/20 shadow-2xl">
          <DialogHeader className="p-8 bg-gradient-to-r from-amber-800 to-amber-600 text-white flex flex-row justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white/10 rounded-2xl">
                 <Factory className="w-8 h-8 text-amber-100" />
               </div>
               <div>
                  <DialogTitle className="text-2xl font-serif font-bold">{selectedJob?.companyName}</DialogTitle>
                  <p className="text-amber-100 text-xs uppercase tracking-widest font-bold">Ref ID: {selectedJob?.id.split('-')[0]}...</p>
               </div>
            </div>
            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
          </DialogHeader>

          <div className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Product Type</p>
                <p className="font-bold text-slate-900">{selectedJob?.productType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Gold Format</p>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">{selectedJob?.goldGivenType}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Status</p>
                <Badge className={selectedJob?.status === "DELIVERED" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"}>
                  {selectedJob?.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Date Given</p>
                <p className="font-bold text-slate-900">{new Date(selectedJob?.dateGiven).toLocaleDateString("en-GB")}</p>
              </div>
            </div>

            <GoldDivider />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Grams Sent</p>
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-gold" />
                    <p className="text-xl font-bold text-slate-900">{selectedJob?.goldGivenGrams}g</p>
                  </div>
               </div>
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Making Charge</p>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-gold" />
                    <p className="text-xl font-bold text-slate-900">₹{selectedJob?.makingCharge.toLocaleString()}</p>
                  </div>
               </div>
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Created By</p>
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-gold" />
                    <p className="text-xs font-bold text-slate-900 truncate">System Admin</p>
                  </div>
               </div>
            </div>

            {selectedJob?.notes && (
              <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-bold uppercase text-amber-700 mb-2 flex items-center gap-2">
                  <ClipboardList className="w-3 h-3" /> Manufacturing Notes
                </p>
                <p className="text-sm text-slate-600 italic leading-relaxed">{selectedJob.notes}</p>
              </div>
            )}

            <Button variant="gold" className="w-full h-12 rounded-2xl" onClick={() => setSelectedJob(null)}>Dismiss Details</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </SidebarProvider>
  );
}

// Utility components
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border", className)}>
      {children}
    </span>
  )
}

function UserCircle({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  )
}