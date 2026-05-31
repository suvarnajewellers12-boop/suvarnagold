"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Search, RefreshCcw, Trash2,
  Landmark, Calendar, Loader2, ScrollText, Package, Printer, FileClock
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// PDF Libraries
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const CreditNotes = () => {
  const { isAuthChecking, isAuthenticated } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [creditNotes, setCreditNotes] = useState<any[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [overallCost, setOverallCost] = useState("");
  const [pastInvoice, setPastInvoice] = useState("");
  const [products, setProducts] = useState([
    { name: "", grams: "", carats: "22k", stoneWeight: "" }
  ]);

  const fetchCreditNotes = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/reports/credit-note/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Ensure the state update explicitly handles the pastInvoice field from backend
      if (data.success) setCreditNotes(data.data);
    } catch (error) {
      setToastMessage("Failed to sync registry");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCreditNotes(); }, []);

  const generateCreditReceipt = async (note: any, mode: "download" | "print" = "print") => {
    try {
      const [fontBytes] = await Promise.all([
        fetch("/fonts/NotoSans-VariableFont_wdth,wght.ttf").then((res) => res.arrayBuffer()),
      ]);

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
      const purple = rgb(0.6, 0.4, 0.8);

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.addPage([A5_W, A5_H]);

      const makePen = (page: any) => {
        const draw = (text: string, x: number, yFromTop: number, size = 9, color = black) =>
          page.drawText(String(text ?? ""), {
            x,
            y: A5_H - yFromTop,
            size,
            font: customFont,
            color,
          });

        const drawR = (text: string, rightX: number, yFromTop: number, size = 9, color = black) => {
          const w = customFont.widthOfTextAtSize(String(text ?? ""), size);
          page.drawText(String(text ?? ""), {
            x: rightX - w,
            y: A5_H - yFromTop,
            size,
            font: customFont,
            color,
          });
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

      // ── HEADER ──────────────────────────────────────────────────
      const HDR_Y = SAFE_TOP + 10;
      draw("SUVARNA JEWELLERS", MARGIN_L, HDR_Y, 11, gold);
      draw("CREDIT VOUCHER / RETURN RECEIPT", MARGIN_L, HDR_Y + 14, 8.5, black);
      drawR(`Credit ID: ${note.invoice}`, MARGIN_R, HDR_Y, 9, black);
      drawR(`Date: ${format(new Date(note.createdAt || new Date()), "dd-MM-yyyy")}`, MARGIN_R, HDR_Y + 12, 8, grey);
      hLine(HDR_Y + 28);

      // ── COUPON CODE DISPLAY ──────────────────────────────────────
      const COUPON_Y = HDR_Y + 50;
      draw("COUPON CODE:", MARGIN_L, COUPON_Y, 8, grey);
      
      const couponBoxW = MARGIN_R - MARGIN_L - 10;
      const couponBoxH = 30;
      page.drawRectangle({
        x: MARGIN_L,
        y: A5_H - COUPON_Y - 25,
        width: couponBoxW,
        height: couponBoxH,
        color: rgb(0.98, 0.95, 0.88),
        borderColor: purple,
        borderWidth: 1.5,
      });

      const codeText = note.code || note.couponCode || "N/A";
      const codeW = customFont.widthOfTextAtSize(codeText, 14);
      page.drawText(codeText, {
        x: MARGIN_L + (couponBoxW - codeW) / 2,
        y: A5_H - COUPON_Y - 10,
        size: 14,
        font: customFont,
        color: purple,
      });

      hLine(COUPON_Y + 50);

      // ── RETURNED ITEMS ──────────────────────────────────────────
      const TBL_Y = COUPON_Y + 70;
      draw("ITEM NAME", MARGIN_L, TBL_Y, 7.5, grey);
      draw("PURITY", MARGIN_L + 150, TBL_Y, 7.5, grey);
      draw("WEIGHT", MARGIN_L + 220, TBL_Y, 7.5, grey);
      draw("S.WT", MARGIN_L + 300, TBL_Y, 7.5, grey);
      hLine(TBL_Y + 10);

      let rowY = TBL_Y + 20;
      if (note.creditNotes && Array.isArray(note.creditNotes)) {
        note.creditNotes.forEach((item: any) => {
          if (rowY > SAFE_BOTTOM - 80) return;
          draw(item.productName || "Item", MARGIN_L, rowY, 8, black);
          draw(item.carats || "22K", MARGIN_L + 150, rowY, 8, black);
          draw(`${item.grams || 0}g`, MARGIN_L + 220, rowY, 8, black);
          draw(`${item.stoneWeight || 0}g`, MARGIN_L + 300, rowY, 8, black);
          rowY += 15;
        });
      }

      hLine(rowY + 5);

      // ── PAST INVOICE REFERENCE ──────────────────────────────────
      const REF_Y = rowY + 25;
      draw("ORIGINAL INVOICE:", MARGIN_L, REF_Y, 8, grey);
      draw(note.pastInvoice || note.pastinvoice || "N/A", MARGIN_L, REF_Y + 12, 9, black);

      // ── CREDIT VALUE BOX ────────────────────────────────────────
      const VAL_Y = REF_Y + 40;
      const valBoxW = 180;
      const valBoxH = 45;
      const valBoxX = MARGIN_R - valBoxW;
      const valBoxBottomY = A5_H - VAL_Y - valBoxH;

      page.drawRectangle({
        x: valBoxX,
        y: valBoxBottomY,
        width: valBoxW,
        height: valBoxH,
        color: rgb(0.98, 0.95, 0.88),
        borderColor: gold,
        borderWidth: 1.2,
      });

      page.drawText("CREDIT VALUE", {
        x: valBoxX + 10,
        y: valBoxBottomY + 25,
        size: 8,
        font: customFont,
        color: grey,
      });

      const creditText = `₹${(note.cashAmount || 0).toLocaleString()}`;
      const creditW = customFont.widthOfTextAtSize(creditText, 13);
      page.drawText(creditText, {
        x: valBoxX + (valBoxW - creditW) / 2,
        y: valBoxBottomY + 8,
        size: 13,
        font: customFont,
        color: gold,
      });

      // ── FOOTER ──────────────────────────────────────────────────
      const FTR_Y = SAFE_BOTTOM - 30;
      draw("✓ Valid for one-time use only against new purchase", MARGIN_L, FTR_Y, 7, grey);
      draw("✓ Non-transferable and non-refundable", MARGIN_L, FTR_Y + 12, 7, grey);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `CreditNote_${note.code || note.invoice}_${format(new Date(), "ddMMyy")}.pdf`;
        link.click();
      } else {
        const printWindow = window.open(pdfUrl);
        if (printWindow) {
          printWindow.addEventListener("load", () => printWindow.print());
        }
      }
    } catch (error) {
      console.error("Credit Receipt Error:", error);
      setToastMessage("Could not generate PDF");
      setShowToast(true);
    }
  };


  const handleSubmit = async () => {
    // 1. Check for empty fields
    const isProductsValid = products.every(p => p.name.trim() !== "" && p.grams !== "" && p.carats.trim() !== "");

    if (!overallCost || !pastInvoice || !isProductsValid) {
      setToastMessage("Missing Information: Please fill all fields.");
      setShowToast(true);
      return;
    }

    // 2. Avoid negative values
    if (Number(overallCost) < 0) {
      setToastMessage("Error: Total Credit Value cannot be negative.");
      setShowToast(true);
      return;
    }

    const hasNegativeWeights = products.some(p => Number(p.grams) < 0 || Number(p.stoneWeight) < 0);
    if (hasNegativeWeights) {
      setToastMessage("Error: Weights cannot be negative.");
      setShowToast(true);
      return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/reports/credit-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          overallCost: Number(overallCost),
          pastInvoice: pastInvoice,
          products: products.map(p => ({
            ...p,
            grams: Number(p.grams),
            stoneWeight: Number(p.stoneWeight || 0),
            cost: Number(overallCost)
          }))
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMessage(`Voucher Generated: ${data.couponCode}`);
        setShowToast(true);
        setIsAddModalOpen(false);
        resetForm();
        fetchCreditNotes();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setToastMessage(error.message);
      setShowToast(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setOverallCost("");
    setPastInvoice("");
    setProducts([{ name: "", grams: "", carats: "22k", stoneWeight: "" }]);
  };

  const filteredNotes = useMemo(() => {
  return creditNotes.filter(n => {
    const search = searchQuery.toLowerCase();
    return (
      n.couponCode?.toLowerCase().includes(search) ||
      n.invoice?.toLowerCase().includes(search) ||
      (n.pastinvoice && String(n.pastinvoice).toLowerCase().includes(search))
    );
  });
}, [searchQuery, creditNotes]);

  // Show loading screen while checking authentication
  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden font-sans">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="sticky top-0 z-20 bg-background border-b px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold italic tracking-tight text-primary">Credit Ledger</h1>
                <p className="text-sm text-muted-foreground uppercase">Internal Return Registry</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Coupon or Ref..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-full"
                  />
                </div>
                <Button variant="gold" onClick={() => setIsAddModalOpen(true)} className="font-bold shadow-lg">
                  <Plus className="w-4 h-4 mr-2" /> Issue Credit Note
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <LuxuryCard className="p-0 border-primary/20 shadow-xl bg-white">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Entry ID</TableHead>
                    {/* New Column for Past Invoice Details */}
                    <TableHead className="font-bold">Original Ref</TableHead>
                    <TableHead className="font-bold">Coupon Code</TableHead>
                    <TableHead className="font-bold">Breakdown</TableHead>
                    <TableHead className="font-bold text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotes.map((note) => (
                    <TableRow key={note.couponId} className="group hover:bg-primary/[0.02]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 text-amber-700 p-2 rounded-lg">
                            <ScrollText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-mono font-bold text-gray-800">{note.invoice}</div>
                            <div className="text-[9px] text-muted-foreground mt-1">
                              {format(new Date(note.date), "dd MMM yyyy")}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* --- New TableCell for Past Invoice Details --- */}
                      <TableCell>
                        {note.pastinvoice ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 w-fit">
                              <FileClock className="w-3.5 h-3.5" />
                              {note.pastinvoice}
                            </div>
                            <span className="text-[9px] text-muted-foreground pl-1 italic">
                              Linked Source Invoice
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic pl-1">No reference</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="font-mono font-black text-primary text-lg">{note.couponCode}</div>
                        <span className={cn(
                          "text-[8px] font-black px-2 py-0.5 rounded border uppercase mt-1 inline-block",
                          note.isUsed ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"
                        )}>
                          {note.isUsed ? "Claimed" : "Active"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1 py-1">
                          {note.products.map((p: any, i: number) => (
                            <div key={i} className="text-[10px] flex gap-2 text-muted-foreground">
                              <span className="font-bold text-gray-700">{p.name}</span>
                              <span>({p.grams}g | {p.carats}| {p.stoneWeight}g)</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-black text-xl text-amber-700 italic">
                            ₹{note.overallPrice.toLocaleString()}
                          </span>
                          <Button variant="outline" size="sm" onClick={() => generateCreditReceipt(note)} className="h-6 text-[8px] font-bold">
                            <Printer className="w-3 h-3 mr-1" /> Print
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </LuxuryCard>
          </div>
        </main>
      </div>

      {/* FIXED DIALOG WITH SCROLLABLE CONTENT AND FIXED FOOTER */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl flex flex-col h-[85vh]">
          {/* Header (Fixed) */}
          <div className="bg-primary p-8 text-white shrink-0 relative">
            <Landmark className="absolute top-6 right-8 w-16 h-16 opacity-10" />
            <h2 className="text-3xl font-bold italic tracking-tight">Generate Credit Voucher</h2>
            <p className="text-xs uppercase opacity-70">Physical Item Intake Registry</p>
          </div>

          {/* Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/10 p-6 rounded-2xl border-2 border-dashed border-primary/20">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase">Total Credit Value</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-primary">₹</span>
                  <Input
                    type="number"
                    min="0"
                    value={overallCost}
                    onChange={e => setOverallCost(e.target.value)}
                    className="h-14 pl-10 text-xl font-bold rounded-xl"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-primary uppercase">Original Invoice #</label>
                <Input
                  value={pastInvoice}
                  onChange={e => setPastInvoice(e.target.value)}
                  className="h-14 text-lg font-mono rounded-xl"
                  placeholder="SJ-2024-XXX"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Package className="w-4 h-4" /> Item Manifest
                </label>
                <Button variant="outline" size="sm" onClick={() => setProducts([...products, { name: "", grams: "", carats: "22k", stoneWeight: "" }])} className="rounded-full text-[10px] font-bold h-8">
                  <Plus className="w-3 h-3 mr-1" /> Add Another Item
                </Button>
              </div>

              <div className="space-y-3">
                {products.map((p, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 p-4 bg-white rounded-xl border border-primary/10 shadow-sm relative group">
                    <div className="col-span-12 md:col-span-5">
                      <Input placeholder="Item Name" value={p.name} onChange={e => {
                        const up = [...products]; up[index].name = e.target.value; setProducts(up);
                      }} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input type="number" min="0" placeholder="Grams" value={p.grams} onChange={e => {
                        const up = [...products]; up[index].grams = e.target.value; setProducts(up);
                      }} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input placeholder="Purity" value={p.carats} onChange={e => {
                        const up = [...products]; up[index].carats = e.target.value; setProducts(up);
                      }} />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <Input type="number" min="0" placeholder="Stone Wt" value={p.stoneWeight} onChange={e => {
                        const up = [...products]; up[index].stoneWeight = e.target.value; setProducts(up);
                      }} />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      {products.length > 1 && (
                        <Trash2 className="w-4 h-4 text-red-400 cursor-pointer hover:text-red-600" onClick={() => setProducts(products.filter((_, i) => i !== index))} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer (Fixed) */}
          <div className="p-6 border-t bg-white shrink-0 flex gap-4">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="flex-1 h-14 font-bold uppercase text-muted-foreground">Discard</Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="flex-[2] h-14 font-bold text-lg"
              variant="gold"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : "Authorize Credit Release"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default CreditNotes;