"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import{AdminSidebar} from "@/components/AdminSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Plus, Search, RefreshCcw, Trash2, 
  Landmark, Calendar, Loader2, ScrollText, Package, Printer
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// PDF Libraries
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const CreditNotes = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  
  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form States
  const [overallCost, setOverallCost] = useState("");
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
      if (data.success) setCreditNotes(data.data);
    } catch (error) {
      console.error(error);
      setToastMessage("Failed to sync registry");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCreditNotes(); }, []);

  // --- PDF GENERATION LOGIC ---
  const generateCreditReceipt = async (note: any) => {
    try {
      const [templateBytes, fontBytes] = await Promise.all([
        fetch("/receipt-template3.pdf").then((res) => res.arrayBuffer()),
        fetch("/fonts/Inter_18pt-Regular.ttf").then((res) => res.arrayBuffer()),
      ]);

      const pdfDoc = await PDFDocument.load(templateBytes);
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();

      const gold = rgb(0.72, 0.52, 0.04);
      const grey = rgb(0.45, 0.45, 0.45);
      const lightGrey = rgb(0.85, 0.85, 0.85); // Slightly darker for visibility
      const black = rgb(0, 0, 0);

      const draw = (text: string, x: number, yOffset: number, size = 10, color = black) => {
        page.drawText(String(text || ""), { x, y: height - yOffset, size, font: customFont, color });
      };

      const drawRight = (text: string, rightX: number, yOffset: number, size = 10, color = black) => {
        const textWidth = customFont.widthOfTextAtSize(String(text || ""), size);
        page.drawText(String(text || ""), { x: rightX - textWidth, y: height - yOffset, size, font: customFont, color });
      };

      // --- HEADER ---
      const headerTopY = 175;
      draw("SUVARNA JEWELLERS", 40, headerTopY, 14, gold);
      draw("CREDIT VOUCHER / RETURN RECEIPT", 40, headerTopY + 18, 9, black);
      
      draw(`Invoice No: ${note.invoice}`, 350, headerTopY, 11, black);
      draw(`Date: ${format(new Date(note.date), "dd-MM-yyyy")}`, 350, headerTopY + 15, 9, grey);
      
      draw("COUPON CODE:", 350, headerTopY + 40, 9, grey);
      draw(note.couponCode, 350, headerTopY + 55, 16, gold);

      // --- TABLE CONFIGURATION ---
      const startX = 40;
      const endX = width - 40;
      const tableWidth = endX - startX+20;
      const headY = 300;
      const rowHeight = 25;
      
      // Column X-Positions
      const col1 = startX + 5;   // Returned Item
      const col2 = startX + 220; // Purity
      const col3 = startX + 350; // Weight
      const col4 = startX + 480; // Stone Wt

      // 1. Draw Header Background
      page.drawRectangle({
        x: startX,
        y: height - headY - 15,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.97, 0.97, 0.97),
      });

      // 2. Draw Header Text
      const textPaddingY = headY + 2; 
      draw("RETURNED ITEM", col1, textPaddingY, 8, grey);
      draw("PURITY", col2, textPaddingY, 8, grey);
      draw("WEIGHT", col3, textPaddingY, 8, grey);
      draw("STONE WT", col4, textPaddingY, 8, grey);

      // --- LINE ITEMS ---
      let currentY = headY + 10;

      note.products.forEach((p: any, index: number) => {
        currentY += rowHeight;

        // Row Separator Line (Top of row)
        page.drawLine({
          start: { x: startX, y: height - currentY + 15 },
          end: { x: endX, y: height - currentY + 15 },
          thickness: 0.5,
          color: lightGrey,
        });

        // Data
        draw(p.name.toUpperCase(), col1, currentY, 9, black);
        draw(p.carats, col2, currentY, 9, black);
        draw(`${p.grams}g`, col3, currentY, 9, black);
        draw(p.stoneWeight > 0 ? `${p.stoneWeight}g` : "-", col4, currentY, 9, black);
      });

      // --- TABLE BORDERS (Gird) ---
      const tableBottomY = currentY + 10;
      
      // Outer Border
      page.drawRectangle({
        x: startX,
        y: height - tableBottomY,
        width: tableWidth,
        height: tableBottomY - headY + 15,
        borderColor: lightGrey,
        borderWidth: 1,
      });

      // Vertical Dividers
      const verticalLines = [col2 - 10, col3 - 10, col4 - 10];
      verticalLines.forEach((xPos) => {
        page.drawLine({
          start: { x: xPos, y: height - headY + 10 },
          end: { x: xPos, y: height - tableBottomY },
          thickness: 0.5,
          color: lightGrey,
        });
      });

      // --- TOTAL VALUE BOX ---
      let totalY = tableBottomY + 30;
      const boxWidth = 240;
      const boxX = width - boxWidth - 40;
      
      page.drawRectangle({
        x: boxX,
        y: height - totalY - 50,
        width: boxWidth,
        height: 60,
        color: rgb(1, 1, 1),
        borderColor: gold,
        borderWidth: 1.5,
      });

      draw("TOTAL CREDIT VALUE", boxX + 15, totalY + 15, 8, grey);
      drawRight(`₹${note.overallPrice.toLocaleString()}`, endX - 15, totalY + 45, 20, gold);

      // Footer
      draw("* This voucher is valid for one-time use only against a new purchase.", 40, height - 60, 8, grey);
      draw("* Please present this voucher at the billing counter.", 40, height - 50, 8, grey);

      const pdfBytes = await pdfDoc.save();
      const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
      window.open(pdfUrl)?.print();

    } catch (error) {
      console.error("Receipt Error:", error);
      setToastMessage("Could not generate PDF");
      setShowToast(true);
    }
  };
  const handleAddProductRow = () => {
    setProducts([...products, { name: "", grams: "", carats: "22k", stoneWeight: "" }]);
  };

  const handleRemoveProductRow = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProductField = (index: number, field: string, value: string) => {
    const updated = [...products];
    (updated[index] as any)[field] = value;
    setProducts(updated);
  };

  const handleSubmit = async () => {
    if (!overallCost || products.some(p => !p.name)) {
      setToastMessage("Please fill in overall cost and product names");
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
          products: products.map(p => ({
            name: p.name,
            grams: Number(p.grams || 0),
            carats: p.carats,
            stoneWeight: Number(p.stoneWeight || 0),
            cost: Number(overallCost)
          }))
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToastMessage(`Credit Note Created: ${data.couponCode}`);
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
    setProducts([{ name: "", grams: "", carats: "22k", stoneWeight: "" }]);
  };

  const filteredNotes = useMemo(() => {
    return creditNotes.filter(n => 
      n.couponCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, creditNotes]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="sticky top-0 z-20 bg-background border-b px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-serif font-bold italic tracking-tight text-primary">Credit Ledger</h1>
                <p className="text-sm text-muted-foreground tracking-widest uppercase">Internal Return Registry</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Coupon Code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-secondary/20 border-primary/10 rounded-full"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => fetchCreditNotes()}>
                  <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
                <Button variant="gold" onClick={() => setIsAddModalOpen(true)} className="font-bold shadow-lg">
                  <Plus className="w-4 h-4 mr-2" /> Issue Credit Note
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <LuxuryCard className="p-0 overflow-hidden border-primary/20 shadow-xl bg-white">
              <div className="p-6 border-b bg-primary/5 flex justify-between items-center">
                <h3 className="font-serif font-bold text-xl flex items-center gap-2 text-primary">
                  <Landmark className="w-5 h-5" /> Issued Credit Notes
                </h3>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold tracking-widest uppercase">
                  {filteredNotes.length} Vouchers
                </span>
              </div>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Invoice / ID</TableHead>
                    <TableHead className="font-bold">Coupon Code</TableHead>
                    <TableHead className="font-bold">Inventory Breakdown</TableHead>
                    <TableHead className="font-bold text-right">Action & Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotes.map((note) => (
                    <TableRow key={note.couponId} className="hover:bg-primary/[0.02] transition-colors group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <div className="bg-amber-100 text-amber-700 p-2 rounded-lg group-hover:bg-amber-200 transition-colors">
                              <ScrollText className="w-4 h-4" />
                           </div>
                           <div>
                              <div className="font-mono font-bold text-gray-800 tracking-tighter">{note.invoice}</div>
                              <div className="text-[9px] text-muted-foreground uppercase flex items-center gap-1 font-bold">
                                <Calendar className="w-2.5 h-2.5" /> {format(new Date(note.date), "dd MMM yyyy")}
                              </div>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono font-black text-primary text-lg tracking-wider border-b-2 border-primary/20 w-fit">{note.couponCode}</div>
                        <span className={cn(
                          "text-[8px] font-black px-2 py-0.5 rounded border mt-1 inline-block uppercase",
                          note.isUsed ? "border-red-200 bg-red-50 text-red-600" : "border-green-200 bg-green-50 text-green-600"
                        )}>
                          {note.isUsed ? "Claimed" : "Active"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5 py-2">
                          {note.products.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 bg-secondary/10 p-2 rounded-md border border-primary/5">
                               <Package className="w-3 h-3 text-primary/40" />
                               <div className="grid grid-cols-4 w-full text-[10px]">
                                  <span className="font-bold text-gray-700 truncate">{p.name}</span>
                                  <span className="text-muted-foreground font-mono">{p.grams}g</span>
                                  <span className="text-muted-foreground font-mono">{p.carats}</span>
                                  <span className="text-primary font-bold text-right">
                                    {p.stoneWeight > 0 ? `SW: ${p.stoneWeight}g` : "Plain"}
                                  </span>
                               </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-serif font-black text-2xl text-amber-700 italic drop-shadow-sm">
                            ₹{note.overallPrice.toLocaleString()}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => generateCreditReceipt(note)}
                            className="h-7 text-[9px] font-bold border-primary/20 hover:bg-primary hover:text-white"
                          >
                            <Printer className="w-3 h-3 mr-1" /> Print Voucher
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

      {/* ISSUE CREDIT NOTE DIALOG */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <div className="bg-primary p-10 text-white relative">
            <Landmark className="absolute top-10 right-10 w-20 h-20 opacity-10" />
            <h2 className="text-3xl font-serif font-bold italic tracking-tight">Generate Credit Voucher</h2>
            <p className="text-xs uppercase tracking-widest opacity-70 mt-1">Direct physical intake into return repository</p>
          </div>

          <div className="p-8 space-y-8 bg-white max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div className="bg-secondary/20 p-6 rounded-2xl border-2 border-dashed border-primary/10">
               <div className="flex flex-col items-center gap-2">
                  <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Total Credit Value</label>
                  <div className="relative w-64">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-serif font-bold text-primary">₹</span>
                     <Input 
                        value={overallCost} 
                        onChange={e => setOverallCost(e.target.value)} 
                        type="number" 
                        min="0"
                        placeholder="0.00" 
                        className="h-16 rounded-2xl font-serif font-bold text-3xl text-center pl-10 text-primary border-primary/20 shadow-inner focus-visible:ring-primary" 
                     />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2 text-primary">
                   <Package className="w-4 h-4" />
                   <label className="text-[10px] font-black uppercase tracking-widest">Inventory Manifest</label>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddProductRow} className="h-8 rounded-full text-[10px] font-bold border-primary/20 hover:bg-primary hover:text-white transition-all">
                  <Plus className="w-3 h-3 mr-1" /> Add Another Item
                </Button>
              </div>

              <div className="space-y-3">
                {products.map((p, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 p-5 bg-white rounded-2xl border-2 border-secondary/50 shadow-sm hover:border-primary/20 transition-all group relative">
                    <div className="col-span-4 space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Item Description</label>
                      <Input value={p.name} onChange={e => updateProductField(index, "name", e.target.value)} placeholder="e.g. Broken Gold Chain" className="h-10 text-xs rounded-xl focus:ring-primary" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Weight (g)</label>
                      <Input value={p.grams} onChange={e => updateProductField(index, "grams", e.target.value)} type="number" min="0" placeholder="0.00" className="h-10 text-xs rounded-xl" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Carats</label>
                      <Input value={p.carats} onChange={e => updateProductField(index, "carats", e.target.value)} placeholder="22k" className="h-10 text-xs rounded-xl" />
                    </div>
                    <div className="col-span-3 space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Stone Wt (opt)</label>
                      <Input value={p.stoneWeight} onChange={e => updateProductField(index, "stoneWeight", e.target.value)} type="number" min="0" placeholder="0.0" className="h-10 text-xs rounded-xl" />
                    </div>
                    <div className="col-span-1 flex items-end justify-center pb-2">
                      <button onClick={() => handleRemoveProductRow(index)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 flex gap-4">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest text-muted-foreground">Discard</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isProcessing}
                className="flex-[2] h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 transition-all active:scale-95" 
                variant="gold"
              >
                {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : "Authorize Credit Release"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default CreditNotes;