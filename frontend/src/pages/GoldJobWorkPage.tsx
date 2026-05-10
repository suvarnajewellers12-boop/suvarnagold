"use client";

import { useState, useEffect, useMemo } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { format } from "date-fns";

import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { 
  Hammer, Loader2, Calendar, Factory, Scale, 
  RefreshCw, Clock, CheckCircle2, IndianRupee,
  X, PackageCheck, User, Coins, ClipboardList, Tag, Printer, Download, Hash, Lock
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function GoldJobWorkPage() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ---------------------------------------------------------------------------
  // 1. STATES
  // ---------------------------------------------------------------------------
  const [jobWorks, setJobWorks] = useState<any[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    workerName: "",
    productType: "",
    makingCharge: "",
    advancePaid: "",
    dateGiven: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const [completionData, setCompletionData] = useState({
    returnedGoldGrams: "",
    wastageGrams: "",
    compNotes: ""
  });

  // ---------------------------------------------------------------------------
  // 2. RECEIPT GENERATOR (Dual Mode)
  // ---------------------------------------------------------------------------
  const handleJobReceipt = async (job: any, mode: "download" | "print", type: "ASSIGNMENT" | "SETTLEMENT" = "ASSIGNMENT") => {
    try {
      const [templateBytes, fontBytes] = await Promise.all([
        fetch("/receipt-template.pdf").then((res) => res.arrayBuffer()),
        fetch("/fonts/NotoSans-VariableFont_wdth,wght.ttf").then((res) => res.arrayBuffer()),
      ]);

      const pdfDoc = await PDFDocument.load(templateBytes);
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPages()[0];
      const { height } = page.getSize();

      const goldColor = rgb(0.72, 0.52, 0.04);
      const grey = rgb(0.45, 0.45, 0.45);
      const black = rgb(0, 0, 0);

      const draw = (text: string, x: number, yOffset: number, size = 10, color = black) => {
        page.drawText(String(text || ""), { x, y: height - yOffset, size, font: customFont, color });
      };

      const drawRight = (text: string, rightX: number, yOffset: number, size = 10, color = black) => {
        const textWidth = customFont.widthOfTextAtSize(String(text || ""), size);
        page.drawText(String(text || ""), { x: rightX - textWidth, y: height - yOffset, size, font: customFont, color });
      };

      // Header UI
      const topY = 165;
      draw("SUVARNA JEWELLERS", 40, topY, 16, goldColor);
      draw(type === "ASSIGNMENT" ? "JOB WORK DISPATCH SLIP" : "JOB WORK SETTLEMENT INVOICE", 40, topY + 18, 10, grey);
      drawRight(`JOB ID: ${job.id.substring(0, 8).toUpperCase()}`, 555, topY, 12, black);
      drawRight(`Date: ${format(new Date(type === "ASSIGNMENT" ? job.dateGiven : (job.dateReceived || new Date())), "dd-MM-yyyy")}`, 555, topY + 15, 10, grey);

      // Info Section
      draw("WORKER INFORMATION", 40, topY + 50, 9, goldColor);
      draw(`Worker: ${job.workerName}`, 40, topY + 65, 12, black);
      draw(`Product: ${job.productType}`, 40, topY + 80, 11, grey);

      // Orders Table
      const tableY = 320;
      draw("ORDER ID", 40, tableY, 10, grey);
      draw("ITEM NAME", 160, tableY, 10, grey);
      draw("CUSTOMER", 320, tableY, 10, grey);
      drawRight("NET WT SENT", 555, tableY, 10, grey);

      let currentY = tableY + 30;
      job.assignedOrders?.forEach((order: any) => {
        draw(order.orderId, 40, currentY, 10, black);
        draw(order.itemName, 160, currentY, 10, black);
        draw(order.customerName, 320, currentY, 10, black);
        drawRight(`${order.netWeight}g`, 555, currentY, 10, black);
        currentY += 20;
      });

      // Footer Accounting
      const payY = height - 160;
      draw("GOLD & LABOR ACCOUNTING", 40, payY, 9, goldColor);
      draw(`Gold Sent: ${Number(job.totalGrams).toFixed(3)}g`, 40, payY + 20, 10, black);
      
      if (type === "SETTLEMENT") {
        draw(`Returned: ${Number(job.returnedGoldGrams).toFixed(3)}g`, 40, payY + 35, 10, black);
        draw(`Wastage: ${Number(job.wastageGrams).toFixed(3)}g`, 40, payY + 50, 10, rgb(0.8, 0, 0));
      }

      const balance = (Number(job.makingCharge) || 0) - (Number(job.advancePaid) || 0);
      drawRight(`Making Charge: ₹${job.makingCharge?.toLocaleString()}`, 555, payY + 20, 11, black);
      drawRight(`Advance Paid: ₹${job.advancePaid?.toLocaleString()}`, 555, payY + 38, 11, rgb(0, 0.4, 0));
      drawRight(`${type === "SETTLEMENT" ? "FINAL SETTLED" : "BALANCE ON RETURN"}: ₹${balance.toLocaleString()}`, 555, payY + 65, 15, goldColor);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `JobWork_${job.workerName}_${type}.pdf`;
        link.click();
      } else {
        const printWindow = window.open(pdfUrl);
        if (printWindow) printWindow.print();
      }
    } catch (err) { console.error(err); }
  };

  // ---------------------------------------------------------------------------
  // 3. API ACTIONS
  // ---------------------------------------------------------------------------
  const fetchJobWorks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/jobwork/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setJobWorks(data.jobworks);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const fetchUnassignedOrders = async () => {
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/order/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const pending = data.orders.filter((o: any) => o.status === "NOT ASSIGNED");
      setUnassignedOrders(pending);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchJobWorks();
    fetchUnassignedOrders();
  }, []);

  const totalWeightPreview = useMemo(() => {
    return unassignedOrders
      .filter(o => selectedOrderIds.includes(o.orderId))
      .reduce((sum, o) => sum + (Number(o.netWeight) || 0), 0);
  }, [selectedOrderIds, unassignedOrders]);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) return alert("Select at least one order");
    setIsSubmitting(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/jobwork", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, orderIds: selectedOrderIds })
      });
      if (res.ok) {
        setToastMessage("Job Dispatched Successfully!"); setShowToast(true);
        setForm({ workerName: "", productType: "", makingCharge: "", advancePaid: "", dateGiven: new Date().toISOString().split("T")[0], notes: "" });
        setSelectedOrderIds([]); fetchJobWorks(); fetchUnassignedOrders();
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleCompleteJob = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/jobwork/completed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: selectedJob.id, ...completionData })
      });
      if (res.ok) {
        setToastMessage("Manufacturing Completed & Inventory Synced!");
        setShowToast(true); setSelectedJob(null); fetchJobWorks();
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  // ---------------------------------------------------------------------------
  // 4. MAIN UI RENDER
  // ---------------------------------------------------------------------------
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <DashboardSidebar />

        <main className="flex-1 flex flex-col h-screen overflow-hidden text-left">
          <header className="bg-white border-b border-gold/10 px-10 py-8 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">Manufacturing Vault</h1>
              <p className="text-sm text-slate-500 italic mt-1">Track factory processing & worker settlements</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => { fetchJobWorks(); fetchUnassignedOrders(); }} className="h-14 w-14 rounded-2xl border-gold/20 text-gold">
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </Button>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row p-10 gap-10 overflow-hidden">
            {/* LEFT: JOB REGISTRY */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-6">
               <div className="flex items-center gap-3">
                  <ClipboardList className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-serif font-bold text-slate-800">Assignments Ledger</h2>
               </div>
               <LuxuryCard className="flex-1 overflow-hidden flex flex-col p-0 border-gold/5 bg-white shadow-xl rounded-[2.5rem]">
                  <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                    {jobWorks.map((job) => (
                      <div key={job.id} onClick={() => setSelectedJob(job)} className="group p-6 border border-gold/10 rounded-[2rem] bg-white hover:border-gold/40 hover:shadow-lg transition-all flex justify-between items-center cursor-pointer">
                        <div className="flex items-center gap-5">
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all", job.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                            {job.status === "COMPLETED" ? <CheckCircle2 className="w-7 h-7" /> : <Hammer className="w-7 h-7" />}
                          </div>
                          <div>
                            <p className="font-serif font-bold text-slate-800 text-lg uppercase tracking-tight">{job.workerName}</p>
                            <div className="flex gap-3 mt-1">
                               <span className="text-[10px] font-bold text-gold uppercase bg-gold/5 px-2 py-0.5 rounded">{job.productType}</span>
                               <span className="text-[10px] font-bold text-slate-400">• {job.assignedOrders?.length || 0} Orders Linked</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900 font-serif">{Number(job.totalGrams).toFixed(3)}g</p>
                          <span className={cn("inline-block px-3 py-1 rounded-full font-bold text-[9px] uppercase mt-2 border", job.status === "COMPLETED" ? "border-emerald-100 text-emerald-600 bg-emerald-50" : "border-amber-100 text-amber-600 bg-amber-50")}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
               </LuxuryCard>
            </div>

            {/* RIGHT: DISPATCH FORM */}
            <div className="w-full lg:w-[480px] shrink-0 h-full pb-6">
              <LuxuryCard className="h-full flex flex-col border-gold/10 shadow-2xl bg-white p-0 overflow-hidden rounded-[2.5rem]">
                <div className="p-10 pb-6 text-left">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="p-3 bg-slate-900 rounded-2xl shadow-xl"><Factory className="w-7 h-7 text-gold" /></div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">New Assignment</h2>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Dispatch Gold into Production</p>
                </div>
                <GoldDivider />
                <form onSubmit={handleDispatch} className="flex-1 flex flex-col overflow-hidden">
                   <div className="flex-1 overflow-y-auto px-10 py-6 space-y-6 custom-scrollbar text-left">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gold ml-1">Allocate Linked Orders</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gold/10 rounded-2xl p-4 bg-slate-50/50">
                          {unassignedOrders.map(order => (
                            <label key={order.id} className="flex items-center gap-4 p-3 bg-white rounded-xl cursor-pointer hover:border-gold/40 border border-transparent transition-all shadow-sm">
                              <input type="checkbox" className="accent-gold h-5 w-5" checked={selectedOrderIds.includes(order.orderId)} onChange={(e) => e.target.checked ? setSelectedOrderIds(p => [...p, order.orderId]) : setSelectedOrderIds(p => p.filter(id => id !== order.orderId))} />
                              <div className="flex-1">
                                <p className="text-xs font-bold text-slate-800">{order.orderId} • {order.itemName}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">{order.customerName} • {order.netWeight}g</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-slate-400">Worker Name</label><Input placeholder="Full Legal Name" className="h-12 rounded-xl" value={form.workerName} onChange={(e) => setForm(p => ({...p, workerName: e.target.value}))} required /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-slate-400">Product Category</label><Input placeholder="e.g. Earrings" className="h-12 rounded-xl" value={form.productType} onChange={(e) => setForm(p => ({...p, productType: e.target.value}))} /></div>
                        <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-slate-400">Dispatch Date</label><Input type="date" className="h-12 rounded-xl" value={form.dateGiven} onChange={(e) => setForm(p => ({...p, dateGiven: e.target.value}))} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-slate-400">Labor Charge (₹)</label><Input type="number" placeholder="₹ Total" className="h-12 rounded-xl" value={form.makingCharge} onChange={(e) => setForm(p => ({...p, makingCharge: e.target.value}))} /></div>
                        <div className="space-y-2"><label className="text-[11px] font-bold uppercase text-slate-400">Advance Paid (₹)</label><Input type="number" placeholder="₹ 0.00" className="h-12 rounded-xl" value={form.advancePaid} onChange={(e) => setForm(p => ({...p, advancePaid: e.target.value}))} /></div>
                      </div>
                      <div className="p-6 bg-slate-900 rounded-[2rem] flex justify-between items-center shadow-2xl">
                         <div className="text-left"><p className="text-[10px] uppercase text-gold font-bold tracking-widest">Total Weight Sent</p><p className="text-xs text-slate-400 mt-1 italic">{selectedOrderIds.length} Linked Items</p></div>
                         <p className="text-3xl font-serif font-bold text-white tracking-tighter">{totalWeightPreview.toFixed(3)}g</p>
                      </div>
                   </div>
                   <div className="p-10 pt-4 bg-slate-50/50 border-t border-gold/5"><Button type="submit" disabled={isSubmitting || selectedOrderIds.length === 0} className="w-full h-16 bg-slate-900 text-gold text-xl font-serif font-bold rounded-[1.5rem] hover:bg-black transition-all shadow-2xl">{isSubmitting ? <Loader2 className="animate-spin" /> : "Authorize Dispatch"}</Button></div>
                </form>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      {/* VIEW & SETTLE DIALOG */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-gold/20 shadow-2xl bg-white text-left">
          <DialogHeader className="p-10 bg-slate-900 text-white flex flex-row justify-between items-center">
             <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 rounded-2xl shadow-xl"><Hammer className="w-9 h-9 text-gold" /></div>
                <div><DialogTitle className="text-3xl font-serif font-bold text-gold tracking-tight">{selectedJob?.workerName}</DialogTitle><p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">Assignment Ref: {selectedJob?.id.substring(0,8)}</p></div>
             </div>
             <div className="flex gap-4">
                <Button onClick={() => handleJobReceipt(selectedJob, "print", "ASSIGNMENT")} variant="outline" className="border-white/20 text-white h-12 rounded-xl transition-all"><Printer className="w-4 h-4 mr-2" /> Dispatch Slip</Button>
                {selectedJob?.status === "COMPLETED" && (<Button onClick={() => handleJobReceipt(selectedJob, "print", "SETTLEMENT")} className="bg-gold text-slate-900 h-12 rounded-xl font-bold transition-all"><Download className="w-4 h-4 mr-2" /> Final Settlement</Button>)}
             </div>
          </DialogHeader>

          <div className="p-12 space-y-10 bg-white">
            <section className="grid grid-cols-4 gap-8">
               <div className="space-y-1.5"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weight Sent</p><p className="text-2xl font-bold font-serif">{Number(selectedJob?.totalGrams).toFixed(3)}g</p></div>
               <div className="space-y-1.5 border-x border-slate-100 px-8"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Labor Cost</p><p className="text-2xl font-bold font-serif text-slate-900">₹{selectedJob?.makingCharge?.toLocaleString()}</p></div>
               <div className="space-y-1.5 border-r border-slate-100 pr-8"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Returned Gold</p><p className="text-2xl font-bold font-serif text-emerald-600">{selectedJob?.returnedGoldGrams ? `${Number(selectedJob.returnedGoldGrams).toFixed(3)}g` : "Pending"}</p></div>
               <div className="space-y-1.5"><p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Wastage</p><p className="text-2xl font-bold font-serif text-rose-500">{selectedJob?.wastageGrams ? `${Number(selectedJob.wastageGrams).toFixed(3)}g` : "Pending"}</p></div>
            </section>

            <section className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-gold/10">
               <p className="text-[11px] font-bold uppercase text-gold mb-5 tracking-widest flex items-center gap-2"><PackageCheck className="w-4 h-4"/> Production Manifest</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {selectedJob?.assignedOrders?.map((o: any) => (
                    <div key={o.id} className="p-5 bg-white border border-slate-100 rounded-[1.5rem] flex justify-between items-center shadow-sm">
                       <div><p className="text-sm font-bold text-slate-900">{o.orderId}</p><p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{o.customerName} • {o.itemName}</p></div>
                       <div className="text-right"><p className="text-sm font-serif font-bold text-gold">{o.netWeight}g</p><span className="text-[8px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">{o.purity}K</span></div>
                    </div>
                  ))}
               </div>
            </section>

            {selectedJob?.status === "PENDING" ? (
              <div className="pt-10 border-t border-gold/10 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                 <h3 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-500"/> Material Return Verification</h3>
                 <div className="grid grid-cols-2 gap-8 text-left">
                    <div className="space-y-2.5"><label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Actual Weight Received (g)</label><Input type="number" placeholder="Precision 0.000" className="h-14 rounded-2xl border-gold/10 text-lg font-bold" value={completionData.returnedGoldGrams} onChange={(e) => setCompletionData(d => ({...d, returnedGoldGrams: e.target.value}))}/></div>
                    <div className="space-y-2.5"><label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Process Wastage (g)</label><Input type="number" placeholder="Precision 0.000" className="h-14 rounded-2xl border-gold/10 text-lg font-bold" value={completionData.wastageGrams} onChange={(e) => setCompletionData(d => ({...d, wastageGrams: e.target.value}))}/></div>
                 </div>
                 <Button onClick={handleCompleteJob} disabled={isSubmitting} className="w-full h-20 bg-slate-900 text-gold text-xl font-serif font-bold rounded-[2rem] shadow-2xl hover:bg-black transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin w-8 h-8" /> : "Verify Return & Close Manufacturing Job"}</Button>
              </div>
            ) : (
              <div className="p-10 bg-emerald-50 border-2 border-emerald-100 rounded-[3rem] flex items-center gap-8 text-emerald-700 shadow-inner">
                 <div className="p-5 bg-white rounded-3xl shadow-xl animate-bounce"><CheckCircle2 className="w-12 h-12"/></div>
                 <div className="text-left"><p className="font-serif font-bold text-3xl leading-tight">Job Finalized</p><p className="text-xs font-bold uppercase tracking-widest opacity-60 mt-2">Accounting Complete • Stock Received • Orders Synced</p></div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
}