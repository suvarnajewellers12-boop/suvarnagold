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
  ShieldCheck,
  Scale,
  Download,
  FileText,
  Table as TableIcon,
  Ticket
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // 1. Change this import
import * as XLSX from "xlsx";

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
    category: "Category-A",
    durationMonths: "",
    monthlyAmount: "",
    maturityMonths: "", 
  });

  // Data States
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [liveGoldRate, setLiveGoldRate] = useState<string | null>(null);
  
  // UI States
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showCreateBox, setShowCreateBox] = useState(false);
  
  // Dialog States
  const [selectedScheme, setSelectedScheme] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);

  // ================= FETCH LOGIC =================
  const fetchLiveRate = async () => {
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
      const data = await res.json();
      if (res.ok && data.gold24) {
        setLiveGoldRate(data.gold24.replace(/[^\d.]/g, ''));
      }
    } catch (err) { console.error("Rate fetch error", err); }
  };

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
        setSchemes(data.schemes || []);
        schemesCache = data.schemes;
      }
    } catch (error) { console.error("Fetch error", error); }
    finally { setIsInitialLoading(false); }
  };

  useEffect(() => {
    fetchSchemes();
    fetchLiveRate();
  }, []);

  // ================= EXPORT LOGIC =================
 const exportToExcel = () => {
  const exportData = schemes.flatMap(scheme => 
    scheme.enrollments.map((en: any) => ({
      "Scheme Name": scheme.name,
      "Category": scheme.isWeightBased ? "Weight Based (Cat-B)" : "Value Based (Cat-A)",
      "Customer Name": en.customer.name,
      "Monthly Installment": scheme.monthlyAmount,
      "Bonus Months": scheme.isWeightBased ? "N/A" : (scheme.maturityMonths || 0),
      "Installments Paid": en.installmentsPaid,
      "Installments Left": en.installmentsLeft,
      "Total Paid (INR)": en.totalPaid,
      "Remaining Balance": en.remainingAmount,
      "Gold Accumulated (g)": en.accumulatedGrams.toFixed(3),
      "Coupon Code": en.coupon?.code || "N/A",
      "Status": en.isCompleted ? "Completed" : "Active"
    }))
  );

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Suvarna_Registry");
  XLSX.writeFile(wb, `Suvarna_Financial_Report_${new Date().toLocaleDateString()}.xlsx`);
};

const exportToPDF = () => {
  const doc = new jsPDF('landscape'); // Changed to landscape to fit more columns
  doc.setFontSize(16);
  doc.text("Suvarna Gold - Detailed Financial Registry", 14, 15);
  
  const tableBody = schemes.flatMap(scheme => 
    scheme.enrollments.map((en: any) => [
      scheme.name,
      en.customer.name,
      scheme.monthlyAmount,
      scheme.isWeightBased ? "-" : scheme.maturityMonths,
      en.installmentsPaid,
      en.installmentsLeft,
      en.totalPaid,
      en.remainingAmount,
      `${en.accumulatedGrams.toFixed(3)}g`,
      en.isCompleted ? "DONE" : "ACTIVE"
    ])
  );

  autoTable(doc, {
    startY: 25,
    head: [[
      'Scheme', 'Customer', 'Monthly', 'Bonus', 'Paid#', 'Left#', 'Total Paid', 'Remaining', 'Gold', 'Status'
    ]],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 8 }, // Smaller font to accommodate many columns
    headStyles: { fillColor: [184, 134, 11] }
  });

  doc.save(`Suvarna_Finance_Registry_${new Date().toLocaleDateString()}.pdf`);
};  // ================= HANDLERS =================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreateScheme = async () => {
    const isCatB = form.category === "Category-B";
    if (!form.name || !form.durationMonths || !form.monthlyAmount || (!isCatB && !form.maturityMonths)) {
      setToastMessage("All fields are required");
      setShowToast(true);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/schemes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, goldRate24k: isCatB ? liveGoldRate : null }),
      });
      if (res.ok) {
        setToastMessage("Portfolio Created Successfully");
        setShowToast(true);
        setForm({ name: "", category: "Category-A", durationMonths: "", monthlyAmount: "", maturityMonths: "" });
        setShowCreateBox(false);
        fetchSchemes(true);
      }
    } catch (error) { setToastMessage("Creation Failed"); setShowToast(true); }
    finally { setLoading(false); }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#fafaf9] dark:bg-[#0a0a0a] w-full overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          
          <header className="bg-white dark:bg-[#0f0f0f] border-b border-gold/10 px-8 py-4 flex justify-between items-center shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60">Administrative Dashboard</span>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">Scheme Registry</h1>
            </div>

            <div className="flex gap-2">
              <Button onClick={exportToPDF} variant="outline" size="sm" className="rounded-full gap-2 border-red-100 text-red-600 hover:bg-red-50 font-bold px-4">
                <FileText className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button onClick={exportToExcel} variant="outline" size="sm" className="rounded-full gap-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-bold px-4">
                <TableIcon className="w-3.5 h-3.5" /> EXCEL
              </Button>
              <Button onClick={() => setShowCreateBox(!showCreateBox)} variant="gold" className="rounded-full gap-2 font-bold px-6 shadow-lg uppercase text-[11px] tracking-widest">
                {showCreateBox ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showCreateBox ? "Close" : "New Scheme"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full relative">
            <aside className={`h-full transition-all duration-500 shrink-0 z-20 ${showCreateBox ? "w-[400px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}>
              <div className="h-[calc(100vh-120px)] m-4 ml-6 bg-white dark:bg-[#0c0c0c] border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col border-b-4 border-b-gold/20 p-7">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-gold/10 rounded-xl"><FilePlus2 className="w-5 h-5 text-gold" /></div>
                  <h2 className="text-xl font-serif font-bold">New Portfolio</h2>
                </div>

                <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Category</label>
                    <select name="category" value={form.category} onChange={handleChange} className="w-full h-11 rounded-xl bg-slate-50 border border-gold/10 px-3 text-sm font-bold text-gold outline-none">
                      <option value="Category-A">Category-A (Value)</option>
                      <option value="Category-B">Category-B (Weight)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Scheme Name</label>
                    <Input name="name" value={form.name} onChange={handleChange} placeholder="Sovereign Gold" className="h-11 rounded-xl bg-slate-50/50" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Tenure (Mo.)</label>
                      <Input name="durationMonths" type="number" value={form.durationMonths} onChange={handleChange} placeholder="11" className="h-11 rounded-xl bg-slate-50/50" />
                    </div>
                    {form.category === "Category-A" ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Bonus Months</label>
                        <select name="maturityMonths" value={form.maturityMonths} onChange={handleChange} className="w-full h-11 rounded-xl bg-slate-50/50 border border-gold/10 px-3 text-sm">
                          <option value="">Select</option>
                          {Array.from({ length: 25 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} Mo</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-end pb-1.5"><Badge variant="gold" className="h-11 flex justify-center bg-gold/5 text-gold border-gold/20">Weight Locked</Badge></div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Monthly Installment</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                      <Input name="monthlyAmount" type="number" value={form.monthlyAmount} onChange={handleChange} placeholder="5000" className="h-11 pl-10 rounded-xl bg-slate-50/50 font-bold" />
                    </div>
                  </div>

                  {form.category === "Category-B" && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <p className="text-[9px] font-black text-amber-600 uppercase">Current 24K Rate</p>
                      <p className="text-2xl font-serif font-bold text-amber-800">₹{Number(liveGoldRate).toLocaleString()}/g</p>
                    </div>
                  )}
                </div>

                <Button variant="gold" className="w-full h-12 rounded-2xl font-bold mt-6 shadow-lg" onClick={handleCreateScheme} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Authorize Scheme"}
                </Button>
              </div>
            </aside>

            <section className="flex-1 overflow-y-auto px-8 py-6">
              <div className={`grid gap-6 transition-all duration-500 ${showCreateBox ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                {isInitialLoading ? Array.from({ length: 8 }).map((_, i) => <SchemeSkeleton key={i} />) : 
                  schemes.map((scheme) => (
                    <div key={scheme.id} onClick={() => { setSelectedScheme(scheme); setIsDetailsOpen(true); }} className="cursor-pointer group">
                      <LuxuryCard className="h-full hover:border-gold/40 transition-all p-0 overflow-hidden flex flex-col rounded-[22px]">
                        <div className="p-6 flex-1">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h3 className="font-serif font-bold text-sm uppercase group-hover:text-gold transition-colors">{scheme.name}</h3>
                              <Badge variant="gold" className="text-[7px] h-4 mt-1 bg-gold/5 text-gold border-none">{scheme.isWeightBased ? "CAT-B" : "CAT-A"}</Badge>
                            </div>
                            <div className={`p-1.5 rounded-full ${scheme.isWeightBased ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                              {scheme.isWeightBased ? <Scale className="w-3.5 h-3.5 text-amber-600" /> : <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-[8px] font-bold text-muted-foreground">TENURE</p><p className="font-bold text-xs">{scheme.durationMonths} Mo.</p></div>
                            <div><p className="text-[8px] font-bold text-muted-foreground">MEMBERS</p><p className="font-bold text-xs">{scheme.enrollments?.length || 0}</p></div>
                          </div>
                        </div>
                        <div className="bg-gold/[0.04] border-t border-gold/5 px-6 py-3 flex justify-between items-center group-hover:bg-gold/[0.07]">
                          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase italic">Goal</p>
                          <p className="font-serif font-bold text-gold text-xs">{scheme.isWeightBased ? "Gold Vault" : "Cash Bonus"}</p>
                        </div>
                      </LuxuryCard>
                    </div>
                  ))
                }
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ================= MEMBER LIST DIALOG ================= */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-[2.5rem] border-gold/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader className="px-2">
            <div className="flex justify-between items-center w-full pr-4">
              <div>
                <DialogTitle className="text-2xl font-serif font-bold text-gold uppercase tracking-tight">{selectedScheme?.name}</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground">Portfolio Member Registry</DialogDescription>
              </div>
              <Badge variant="gold" className="rounded-full px-4 py-1 border-none bg-gold/10 text-gold font-black">{selectedScheme?.enrollments?.length || 0} Members</Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-6 custom-scrollbar pr-2 pb-6 px-2 space-y-4">
            {selectedScheme?.enrollments?.map((en: any) => (
              <div key={en.id} className="p-6 rounded-[2rem] bg-slate-50 border border-gold/5 flex flex-col lg:flex-row items-center justify-between gap-6 hover:border-gold/20 shadow-sm group">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <div className="h-14 w-14 rounded-[1.2rem] bg-white shadow-sm border border-gold/5 flex items-center justify-center text-gold font-black text-xl">{en.customer?.name?.[0].toUpperCase()}</div>
                  <div>
                    <h4 className="font-bold text-base capitalize">{en.customer?.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[8px] h-5 border-gold/20 text-gold/70">{en.id.slice(0,8)}</Badge>
                      {en.coupon && (
                        <Button 
                          onClick={() => { setSelectedCoupon(en.coupon); setIsCouponDialogOpen(true); }}
                          className="h-5 px-2 bg-gold/10 text-gold hover:bg-gold text-[8px] font-bold gap-1 border-none rounded group-hover:bg-gold group-hover:text-white"
                        >
                          <Ticket className="w-2.5 h-2.5" /> {en.coupon.code}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-left flex-1 lg:pl-10 lg:border-l border-gold/10">
                  <div><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Status</p><p className="text-sm font-bold">{en.installmentsPaid}/{selectedScheme.durationMonths} Paid</p></div>
                  <div><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Contribution</p><p className="text-sm font-bold text-emerald-600">₹{en.totalPaid.toLocaleString()}</p></div>
                  <div><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Accumulation</p><p className="text-sm font-bold text-gold">{en.accumulatedGrams.toFixed(3)} g</p></div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= COUPON DETAILS DIALOG (NESTED) ================= */}
      <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-gold/20 bg-white p-0 overflow-hidden shadow-2xl">
          <div className="bg-gold p-10 text-white text-center relative overflow-hidden">
            <Ticket className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-4xl font-serif font-bold tracking-tighter uppercase">{selectedCoupon?.code}</h3>
            <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-80 mt-2">Suvarna Authenticated</p>
            <div className="absolute -bottom-5 left-0 right-0 flex justify-around">
               {Array.from({length: 10}).map((_, i) => <div key={i} className="w-3 h-3 rounded-full bg-white"/>)}
            </div>
          </div>
          <div className="p-10 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Maturity Cash</p>
                <p className="text-xl font-bold">₹{selectedCoupon?.totalCashValue?.toLocaleString()}</p>
              </div>
              <div className="p-5 rounded-2xl bg-gold/5 border border-gold/10 text-center">
                <p className="text-[9px] font-bold text-gold uppercase mb-1">Locked Grams</p>
                <p className="text-xl font-bold text-gold">{selectedCoupon?.totalWeightGrams?.toFixed(3)}g</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-dashed border-slate-200">
               <div><span className="text-[10px] font-black text-muted-foreground uppercase block mb-1">Redemption</span><Badge className={selectedCoupon?.isActive ? "bg-emerald-500" : "bg-amber-500"}>{selectedCoupon?.isActive ? "READY" : "LOCKED"}</Badge></div>
               <div className="text-right"><span className="text-[10px] font-black text-muted-foreground uppercase block mb-1">Issued</span><p className="text-xs font-bold">{new Date(selectedCoupon?.createdAt).toLocaleDateString()}</p></div>
            </div>
            <Button variant="outline" className="w-full h-12 rounded-2xl border-gold/20 text-gold uppercase font-bold text-[10px] tracking-widest" onClick={() => setIsCouponDialogOpen(false)}>Return to Registry</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default SuperAdminCreateScheme;