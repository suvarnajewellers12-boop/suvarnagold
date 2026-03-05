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
  Coins, Landmark, Loader2, Calendar, 
  Receipt, Scale, RefreshCw, History, 
  Wallet, FileText, BadgeIndianRupee,
  X, ChevronRight, Hash, CreditCard
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ================= CACHE CONFIGURATION =================
let purchaseCache: any[] | null = null;

const PurchaseSkeleton = () => (
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

export default function GoldPurchasePage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // States
  const [purchases, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    goldType: "BISCUIT",
    grams: "",
    pricePerGram: "",
    totalAmount: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    invoiceNumber: "",
    paymentMode: "BANK_TRANSFER",
    notes: "",
  });

  const fetchPurchases = async (forceRefresh = false) => {
    if (!forceRefresh && purchaseCache !== null) {
      setPurchases(purchaseCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/purchase/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const fetchedData = data.purchases || data.goldPurchases || [];
      setPurchases(fetchedData);
      purchaseCache = fetchedData; 
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPurchases(); }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          grams: Number(form.grams),
          pricePerGram: Number(form.pricePerGram),
          totalAmount: Number(form.totalAmount)
        })
      });

      if (res.ok) {
        setToastMessage("Procurement data secured");
        setShowToast(true);
        setForm({
          companyName: "",
          goldType: "BISCUIT",
          grams: "",
          pricePerGram: "",
          totalAmount: "",
          purchaseDate: new Date().toISOString().split("T")[0],
          invoiceNumber: "",
          paymentMode: "BANK_TRANSFER",
          notes: "",
        });
        await fetchPurchases(true); 
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <DashboardSidebar />

        <main className="flex-1 flex flex-col h-screen overflow-hidden text-left">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gold/10 px-8 py-6 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">Procurement Center</h1>
              <p className="text-sm text-slate-500 italic flex items-center gap-2">
                <Landmark className="w-3 h-3 text-gold" /> Inward gold supply management
              </p>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => fetchPurchases(true)}
              className="h-11 w-11 rounded-xl border-gold/20 text-gold"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </Button>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row p-8 gap-8 overflow-hidden">
            
            <div className="flex-1 flex flex-col overflow-hidden space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <History className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-serif font-bold text-slate-800 text-left">Recent Records</h2>
              </div>

              <LuxuryCard className="flex-1 overflow-hidden flex flex-col p-0 border-gold/5 shadow-none bg-white">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <PurchaseSkeleton key={i} />)
                  ) : purchases.length > 0 ? (
                    purchases.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => setSelectedPurchase(item)}
                        className="group p-5 border border-gold/10 rounded-2xl bg-white hover:border-gold/30 hover:shadow-md transition-all flex justify-between items-center cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gold/5 flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-white transition-colors">
                            <Receipt className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <p className="font-serif font-bold text-slate-800 uppercase tracking-tight">{item.companyName}</p>
                            <div className="flex gap-2 items-center mt-1">
                               <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase">{item.goldType}</span>
                               <p className="text-xs text-muted-foreground flex items-center gap-1">
                                 <Calendar className="w-3 h-3" /> {new Date(item.purchaseDate).toLocaleDateString("en-GB")}
                               </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div>
                            <p className="text-sm font-bold text-slate-900">₹{item.totalAmount.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{item.grams}g Procurement</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gold opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 italic">
                      <Coins className="w-12 h-12 mb-2 text-slate-300" />
                      <p>No procurement records found</p>
                    </div>
                  )}
                </div>
              </LuxuryCard>
            </div>

            <div className="w-full lg:w-[450px] shrink-0 h-full pb-4">
              <LuxuryCard className="h-full flex flex-col border-amber-500/20 shadow-2xl bg-white p-0 overflow-hidden">
                <div className="p-8 pb-4 shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gold/10 rounded-xl">
                      <Coins className="w-6 h-6 text-gold" />
                    </div>
                    <h2 className="text-xl font-serif font-bold text-slate-900">Record Inward</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest ml-1">Gold Purchase Entry</p>
                </div>
                <GoldDivider />
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                   {/* Form Body remains same as previous step for speed */}
                   <div className="flex-1 overflow-y-auto px-8 py-4 space-y-5 custom-scrollbar">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Supplier Name</label>
                      <div className="relative">
                        <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/50" />
                        <Input placeholder="Bullion Co." className="pl-10 h-11 border-gold/10" value={form.companyName} onChange={(e) => handleChange("companyName", e.target.value)} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Type</label>
                        <select className="w-full h-11 rounded-md border border-gold/10 bg-white px-3 text-sm focus:ring-1 focus:ring-gold outline-none" value={form.goldType} onChange={(e) => handleChange("goldType", e.target.value)}>
                          <option value="BISCUIT">Biscuit</option><option value="MUDHA">Mudha</option>
                        </select>
                      </div>
                      <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Weight (g)</label>
                        <Input type="number" placeholder="0.00" className="h-11 border-gold/10" value={form.grams} onChange={(e) => handleChange("grams", e.target.value)} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Rate</label>
                        <Input type="number" placeholder="₹ / g" className="h-11 border-gold/10" value={form.pricePerGram} onChange={(e) => handleChange("pricePerGram", e.target.value)} required />
                      </div>
                      <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Total</label>
                        <Input type="number" placeholder="Total ₹" className="h-11 border-gold/10 font-bold" value={form.totalAmount} onChange={(e) => handleChange("totalAmount", e.target.value)} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Date</label>
                        <Input type="date" className="h-11 border-gold/10" value={form.purchaseDate} onChange={(e) => handleChange("purchaseDate", e.target.value)} required />
                      </div>
                      <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Invoice</label>
                        <Input placeholder="INV-#" className="h-11 border-gold/10" value={form.invoiceNumber} onChange={(e) => handleChange("invoiceNumber", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Payment</label>
                        <select className="w-full h-11 rounded-md border border-gold/10 bg-white px-3 text-sm focus:ring-1 focus:ring-gold outline-none" value={form.paymentMode} onChange={(e) => handleChange("paymentMode", e.target.value)}>
                          <option value="BANK_TRANSFER">Bank Transfer</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option>
                        </select>
                    </div>
                    <div className="space-y-1.5 text-left"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 block">Notes</label>
                        <textarea className="w-full min-h-[70px] border border-gold/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-gold outline-none" placeholder="Details..." value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
                    </div>
                  </div>
                  <div className="p-8 pt-4 border-t border-gold/5 shrink-0 bg-slate-50/50">
                    <Button type="submit" variant="gold" className="w-full h-14 text-lg font-serif font-bold shadow-xl" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin" /> : "Authorize Procurement"}
                    </Button>
                  </div>
                </form>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      {/* ================= PURCHASE DETAILS DIALOG ================= */}
      <Dialog open={!!selectedPurchase} onOpenChange={() => setSelectedPurchase(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-gold/20 shadow-2xl">
          <DialogHeader className="p-8 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-row justify-between items-center shrink-0">
             <div className="flex items-center gap-4 text-left">
                <div className="p-3 bg-white/10 rounded-2xl shadow-inner">
                  <Landmark className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                   <DialogTitle className="text-2xl font-serif font-bold">{selectedPurchase?.companyName}</DialogTitle>
                   <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Inward Supply Asset Log</p>
                </div>
             </div>
             <button onClick={() => setSelectedPurchase(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
          </DialogHeader>

          <div className="p-8 space-y-8 bg-white text-left">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="space-y-1">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Invoice No.</p>
                 <div className="flex items-center gap-1.5 text-slate-900 font-bold"><Hash size={12} className="text-gold" /> {selectedPurchase?.invoiceNumber || "N/A"}</div>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Asset Type</p>
                 <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold">{selectedPurchase?.goldType}</span>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Payment</p>
                 <div className="flex items-center gap-1.5 text-slate-900 font-bold"><CreditCard size={12} className="text-gold" /> {selectedPurchase?.paymentMode?.replace('_', ' ')}</div>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Trans. Date</p>
                 <p className="font-bold text-slate-900">{new Date(selectedPurchase?.purchaseDate).toLocaleDateString("en-GB")}</p>
               </div>
            </div>

            <GoldDivider />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Net Weight</p>
                  <div className="flex items-end gap-1">
                    <Scale className="w-4 h-4 text-gold mb-1" />
                    <p className="text-2xl font-bold text-slate-900">{selectedPurchase?.grams}<span className="text-xs ml-1">g</span></p>
                  </div>
               </div>
               <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Rate Applied</p>
                  <div className="flex items-end gap-1">
                    <BadgeIndianRupee className="w-4 h-4 text-gold mb-1" />
                    <p className="text-2xl font-bold text-slate-900">{selectedPurchase?.pricePerGram?.toLocaleString()}</p>
                  </div>
               </div>
               <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-amber-700 mb-2 font-black">Total Valuation</p>
                  <p className="text-2xl font-serif font-black text-amber-700">₹{selectedPurchase?.totalAmount?.toLocaleString()}</p>
               </div>
            </div>

            {selectedPurchase?.notes && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Internal Procurement Notes
                </p>
                <p className="text-sm text-slate-600 italic leading-relaxed">{selectedPurchase.notes}</p>
              </div>
            )}

            <Button variant="gold" className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px]" onClick={() => setSelectedPurchase(null)}>Dismiss Catalog Entry</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
}
