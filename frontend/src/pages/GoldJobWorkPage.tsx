"use client";

import { useState, useEffect, useMemo } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

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
  const { token, isAuthChecking } = useAuth();

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
    totalAmount: "", 
    dateGiven: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const [completionData, setCompletionData] = useState({
    returnedGoldGrams: "",
    wastageGrams: "",
    compNotes: ""
  });

  // Calculate Balance for dispatch form
  const jobTotals = useMemo(() => {
    const total = Math.max(0, Number(form.totalAmount) || 0);
    const advance = Math.max(0, Number(form.advancePaid) || 0);
    const balance = Math.max(0, total - advance);
    const weight = unassignedOrders
      .filter(o => selectedOrderIds.includes(o.orderId))
      .reduce((sum, o) => sum + (Number(o.netWeight) || 0), 0);
    return { total, advance, balance, weight };
  }, [form, selectedOrderIds, unassignedOrders]);

  const handleJobReceipt = async (job: any, mode: "download" | "print", type: "ASSIGNMENT" | "SETTLEMENT" = "ASSIGNMENT") => {
    try {
      const fontBytes = await fetch("/fonts/NotoSans-VariableFont_wdth,wght.ttf").then((res) => res.arrayBuffer());

      const A5_W = 419.53;
      const A5_H = 595.28;
      const SAFE_TOP = 80;
      const SAFE_BOTTOM = 544;
      const MARGIN_L = 30;
      const MARGIN_R = A5_W - 30;

      const gold = rgb(0.72, 0.52, 0.04);
      const grey = rgb(0.45, 0.45, 0.45);
      const black = rgb(0, 0, 0);
      const lightGrey = rgb(0.85, 0.85, 0.85);
      const emerald = rgb(0.06, 0.47, 0.23);

      // Use template for download, blank sheet for print
      let pdfDoc: any;
      if (mode === "download") {
        const templateBytes = await fetch("/receipt.pdf").then((res) => res.arrayBuffer());
        pdfDoc = await PDFDocument.load(templateBytes);
        const page = pdfDoc.getPages()[0];
        page.setSize(A5_W, A5_H);
      } else {
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([A5_W, A5_H]);
      }

      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPages()[0];

      const makePen = (page: any) => {
        const draw = (text: string, x: number, yFromTop: number, size = 9, color = black) =>
          page.drawText(String(text ?? ""), { x, y: A5_H - yFromTop, size, font: customFont, color });

        const drawR = (text: string, rightX: number, yFromTop: number, size = 9, color = black) => {
          const w = customFont.widthOfTextAtSize(String(text ?? ""), size);
          page.drawText(String(text ?? ""), { x: rightX - w, y: A5_H - yFromTop, size, font: customFont, color });
        };

        const hLine = (yFromTop: number, lineColor = lightGrey, thickness = 0.4) =>
          page.drawLine({
            start: { x: MARGIN_L, y: A5_H - yFromTop },
            end: { x: MARGIN_R, y: A5_H - yFromTop },
            thickness,
            color: lineColor,
          });

        return { draw, drawR, hLine };
      };

      const { draw, drawR, hLine } = makePen(page);

      // ── CALCULATIONS ──────────────────────────────────────────
      const totalLabor = Number(job.totalAmount) || 0;
      const advancePaid = Number(job.advancePaid) || 0;
      const balance = totalLabor - advancePaid;
      const totalGrams = job.assignedOrders?.reduce((sum: number, o: any) => sum + (Number(o.netWeight) || 0), 0) || 0;

      // ── HEADER ──────────────────────────────────────────────────
      const HDR_Y = SAFE_TOP + 10;
      const typeLabel = type === "SETTLEMENT" ? "SETTLEMENT SLIP" : "DISPATCH SLIP";
      draw(typeLabel, MARGIN_L, HDR_Y, 9.5, black);
      drawR(`JOB: ${job.id.substring(0, 8).toUpperCase()}`, MARGIN_R, HDR_Y, 8, grey);
      drawR(`Date: ${format(new Date(), "dd-MM-yyyy")}`, MARGIN_R, HDR_Y + 12, 7.5, grey);
      hLine(HDR_Y + 26);

      // ── WORKER DETAILS ───────────────────────────────────────
      const WORKER_Y = HDR_Y + 38;
      draw("WORKER", MARGIN_L, WORKER_Y, 7.5, grey);
      draw(job.workerName, MARGIN_L, WORKER_Y + 11, 8.5, black);
      draw(`Product: ${job.productType}`, MARGIN_L, WORKER_Y + 22, 7.5, grey);
      draw(`Making Charge: ₹${Number(job.makingCharge || 0).toLocaleString()}`, MARGIN_L, WORKER_Y + 32, 7.5, grey);
      hLine(WORKER_Y + 42);

      // ── ASSIGNED ORDERS TABLE ────────────────────────────────
      const TBL_Y = WORKER_Y + 58;
      const col = { ordId: MARGIN_L, item: MARGIN_L + 80, weight: MARGIN_R };

      draw("ORDER", col.ordId, TBL_Y, 6.5, grey);
      draw("ITEM", col.item, TBL_Y, 6.5, grey);
      drawR("NET (g)", col.weight, TBL_Y, 6.5, grey);
      hLine(TBL_Y + 9);

      let rowY = TBL_Y + 18;
      if (job.assignedOrders && Array.isArray(job.assignedOrders)) {
        job.assignedOrders.forEach((order: any) => {
          if (rowY > SAFE_BOTTOM - 130) return;
          draw(order.orderId || "N/A", col.ordId, rowY, 7, black);
          draw(order.itemName || "Item", col.item, rowY, 7, black);
          drawR(`${order.netWeight || 0}`, col.weight, rowY, 7, black);
          rowY += 12;
        });
      }
      hLine(rowY + 5);

      // ── GOLD ACCOUNTING ──────────────────────────────────────
      const ACC_Y = rowY + 20;
      draw("ACCOUNTING", MARGIN_L, ACC_Y, 7.5, grey);
      draw(`Sent: ${totalGrams.toFixed(3)}g`, MARGIN_L, ACC_Y + 11, 7.5, black);

      if (type === "SETTLEMENT") {
        draw(`Returned: ${Number(job.returnedGoldGrams || 0).toFixed(3)}g`, MARGIN_L, ACC_Y + 21, 7.5, emerald);
        draw(`Wastage: ${Number(job.wastageGrams || 0).toFixed(3)}g`, MARGIN_L, ACC_Y + 31, 7.5, grey);
      }

      // ── FINANCIAL BOX ────────────────────────────────────────
      const FIN_Y = ACC_Y + 50;
      const finBoxW = 160;
      const finBoxH = type === "SETTLEMENT" ? 65 : 50;
      const finBoxX = MARGIN_R - finBoxW;
      const finBoxBottomY = A5_H - FIN_Y - finBoxH;

      page.drawRectangle({
        x: finBoxX,
        y: finBoxBottomY,
        width: finBoxW,
        height: finBoxH,
        color: rgb(0.98, 0.95, 0.88),
        borderColor: gold,
        borderWidth: 1.2,
      });

      page.drawText("SUMMARY", {
        x: finBoxX + 10,
        y: finBoxBottomY + (finBoxH - 12),
        size: 6.5,
        font: customFont,
        color: grey,
      });

      page.drawText(`Total: ₹${totalLabor.toLocaleString()}`, {
        x: finBoxX + 10,
        y: finBoxBottomY + (finBoxH - 26),
        size: 7,
        font: customFont,
        color: black,
      });

      page.drawText(`Advance: ₹${advancePaid.toLocaleString()}`, {
        x: finBoxX + 10,
        y: finBoxBottomY + (finBoxH - 38),
        size: 7,
        font: customFont,
        color: grey,
      });

      if (type === "SETTLEMENT") {
        page.drawText(`Settled `, {
          x: finBoxX + 10,
          y: finBoxBottomY + 8,
          size: 7,
          font: customFont,
          color: emerald,
        });
      } else {
        page.drawText(`Balance: ₹${balance.toLocaleString()}`, {
          x: finBoxX + 10,
          y: finBoxBottomY + 5,
          size: 7,
          font: customFont,
          color: gold,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `JobWork_${job.workerName}_${type}_${format(new Date(), "ddMMyy")}.pdf`;
        link.click();
      } else {
        const printWindow = window.open(pdfUrl);
        if (printWindow) {
          printWindow.addEventListener("load", () => printWindow.print());
        }
      }
    } catch (err) {
      console.error("Job PDF Error:", err);
      setToastMessage("Failed to generate job receipt");
      setShowToast(true);
    }
  };

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

  useEffect(() => { fetchJobWorks(); fetchUnassignedOrders(); }, []);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) return alert("Select Orders");
    setIsSubmitting(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/gold/jobwork", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          ...form, 
          orderIds: selectedOrderIds,
          totalAmount: jobTotals.total,
          balanceAmount: jobTotals.balance 
        })
      });
      if (res.ok) {
        setToastMessage("Job Dispatched!"); setShowToast(true);
        setForm({ workerName: "", productType: "", makingCharge: "", advancePaid: "", totalAmount: "", dateGiven: new Date().toISOString().split("T")[0], notes: "" });
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
        body: JSON.stringify({ 
          id: selectedJob.id, 
          ...completionData,
          balanceAmount: 0,
          totalPaid: selectedJob.totalAmount
        })
      });
      if (res.ok) {
        setToastMessage("Job Completed & Balance Settled!"); setShowToast(true);
        setSelectedJob(null); fetchJobWorks();
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  // Show loading screen while checking authentication
  
  

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden text-left">
          <header className="bg-white border-b border-gold/10 px-10 py-8 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">Manufacturing Vault</h1>
            </div>
            <Button variant="outline" size="icon" onClick={() => { fetchJobWorks(); fetchUnassignedOrders(); }} className="h-14 w-14 rounded-2xl border-gold/20 text-gold">
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </Button>
          </header>

          <div className="flex-1 flex flex-col lg:flex-row p-10 gap-10 overflow-hidden">
            {/* LEFT: JOB REGISTRY */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-6">
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
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{job.assignedOrders?.length || 0} Orders Linked</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900 font-serif">{Number(job.totalGrams).toFixed(3)}g</p>
                          <span className={cn("inline-block px-3 py-1 rounded-full font-bold text-[9px] uppercase mt-2 border", job.status === "COMPLETED" ? "border-emerald-100 text-emerald-600 bg-emerald-50" : "border-amber-100 text-amber-600 bg-amber-50")}>{job.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
               </LuxuryCard>
            </div>

            {/* RIGHT: DISPATCH FORM */}
            <div className="w-full lg:w-[480px] shrink-0 h-full pb-6">
              <LuxuryCard className="h-full flex flex-col border-gold/10 shadow-2xl bg-white p-0 overflow-hidden rounded-[2.5rem]">
                <GoldDivider />
                <form onSubmit={handleDispatch} className="flex-1 flex flex-col overflow-hidden">
                   <div className="flex-1 overflow-y-auto px-10 py-6 space-y-6 custom-scrollbar text-left">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gold ml-1">Allocate Articles</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gold/10 rounded-2xl p-4 bg-slate-50/50">
                          {unassignedOrders.map(order => (
                            <label key={order.id} className="flex items-center gap-4 p-3 bg-white rounded-xl cursor-pointer hover:border-gold/40 border border-transparent transition-all shadow-sm">
                              <input type="checkbox" className="accent-gold h-5 w-5" checked={selectedOrderIds.includes(order.orderId)} onChange={(e) => e.target.checked ? setSelectedOrderIds(p => [...p, order.orderId]) : setSelectedOrderIds(p => p.filter(id => id !== order.orderId))} />
                              <div className="flex-1"><p className="text-xs font-bold text-slate-800">{order.orderId} • {order.itemName}</p><p className="text-[10px] text-slate-400 uppercase font-bold">{order.customerName} • {order.netWeight}g</p></div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <Input placeholder="Worker Name" className="h-12 rounded-xl" value={form.workerName} onChange={(e) => setForm(p => ({...p, workerName: e.target.value}))} required />
                      <div className="grid grid-cols-2 gap-4">
                        <Input type="number" min="0" placeholder="Total Labor (₹)" className="h-12 rounded-xl font-bold" value={form.totalAmount} onChange={(e) => setForm(p => ({...p, totalAmount: e.target.value}))} />
                        <Input type="number" min="0" placeholder="Advance Paid (₹)" className="h-12 rounded-xl font-bold border-emerald-100 text-emerald-600" value={form.advancePaid} onChange={(e) => setForm(p => ({...p, advancePaid: e.target.value}))} />
                      </div>
                      <div className="p-6 bg-slate-900 rounded-[2rem] flex justify-between items-center shadow-2xl">
                         <div className="text-left"><p className="text-[10px] uppercase text-gold font-bold tracking-[0.2em]">Balance to Pay</p><p className="text-3xl font-serif font-bold text-white tracking-tighter">₹{jobTotals.balance.toLocaleString()}</p></div>
                      </div>
                   </div>
                   <div className="p-10 pt-4"><Button type="submit" disabled={isSubmitting || selectedOrderIds.length === 0} className="w-full h-18 bg-gold text-slate-900 text-xl font-serif font-bold rounded-[1.5rem] hover:bg-white transition-all shadow-2xl">Authorize Dispatch</Button></div>
                </form>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      {/* VIEW & SETTLE DIALOG */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-4xl rounded-[3rem] p-0 border-gold/20 shadow-2xl bg-white text-left outline-none">
          <DialogHeader className="p-12 bg-slate-900 text-white flex flex-row justify-between items-center relative">
             <div className="flex items-center gap-5 relative z-10 text-left">
                <div><DialogTitle className="text-4xl font-serif font-bold text-gold tracking-tight">{selectedJob?.workerName}</DialogTitle></div>
             </div>
             <div className="flex gap-2 relative z-10">
                <Button onClick={() => handleJobReceipt(selectedJob, "print", "ASSIGNMENT")} variant="outline" className="border-white/20 text-white h-10 px-3 rounded-lg text-sm transition-all"><Printer className="w-4 h-4 mr-1" />Print</Button>
                <Button onClick={() => handleJobReceipt(selectedJob, "download", "ASSIGNMENT")} variant="outline" className="border-white/20 text-white h-10 px-3 rounded-lg text-sm transition-all"><Download className="w-4 h-4 mr-1" />Save</Button>
                {/* Fixed the button visibility condition here */}
                {selectedJob?.status === "COMPLETED" && (
                  <>
                    <Button onClick={() => handleJobReceipt(selectedJob, "print", "SETTLEMENT")} className="bg-emerald-600 text-white h-10 px-3 rounded-lg text-sm font-bold transition-all shadow-lg"><Printer className="w-4 h-4 mr-1" />Print</Button>
                    <Button onClick={() => handleJobReceipt(selectedJob, "download", "SETTLEMENT")} className="bg-emerald-600 text-white h-10 px-3 rounded-lg text-sm font-bold transition-all shadow-lg"><Download className="w-4 h-4 mr-1" />Save</Button>
                  </>
                )}
             </div>
          </DialogHeader>

          <div className="p-12 space-y-12 bg-white">
            <section className="grid grid-cols-4 gap-8">
               <div className="space-y-1.5"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weight Sent</p><p className="text-2xl font-bold font-serif">{Number(selectedJob?.totalGrams).toFixed(3)}g</p></div>
               <div className="space-y-1.5 border-x border-slate-100 px-8"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Labor</p><p className="text-2xl font-bold font-serif text-slate-900">₹{selectedJob?.totalAmount?.toLocaleString()}</p></div>
               <div className="space-y-1.5 border-r border-slate-100 pr-8"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Returned Metal</p><p className="text-2xl font-bold font-serif text-emerald-600">{selectedJob?.returnedGoldGrams ? `${Number(selectedJob.returnedGoldGrams).toFixed(3)}g` : "Pending"}</p></div>
               <div className="space-y-1.5"><p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Process Waste</p><p className="text-2xl font-bold font-serif text-rose-500">{selectedJob?.wastageGrams ? `${Number(selectedJob.wastageGrams).toFixed(3)}g` : "Pending"}</p></div>
            </section>

            {selectedJob?.status === "PENDING" ? (
              <div className="pt-10 border-t border-gold/10 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                 <div className="grid grid-cols-2 gap-8 text-left">
                    <div className="space-y-2.5"><label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Actual Weight Received (g)</label><Input type="number" min="0" placeholder="0.000" className="h-14 rounded-2xl border-gold/10 text-lg font-bold" value={completionData.returnedGoldGrams} onChange={(e) => setCompletionData(d => ({...d, returnedGoldGrams: e.target.value}))}/></div>
                    <div className="space-y-2.5"><label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Verified Wastage (g)</label><Input type="number" min="0" placeholder="0.000" className="h-14 rounded-2xl border-gold/10 text-lg font-bold" value={completionData.wastageGrams} onChange={(e) => setCompletionData(d => ({...d, wastageGrams: e.target.value}))}/></div>
                 </div>
                 <Button onClick={handleCompleteJob} disabled={isSubmitting} className="w-full h-24 bg-slate-900 text-gold text-2xl font-serif font-bold rounded-[2.5rem] shadow-2xl hover:bg-black transition-all active:scale-95">Verify Return & Settle Account</Button>
              </div>
            ) : (
              <div className="p-12 bg-emerald-50 border-2 border-emerald-100 rounded-[3.5rem] flex items-center gap-10 text-emerald-700 shadow-inner">
                 <div className="p-6 bg-white rounded-[2rem] shadow-xl"><CheckCircle2 className="w-14 h-14"/></div>
                 <div className="text-left"><p className="font-serif font-bold text-4xl leading-tight tracking-tight">Financials Audited</p><p className="text-sm font-bold uppercase tracking-[0.3em] opacity-60 mt-3">Balance Settled • Stock Received • Records Closed</p></div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
}