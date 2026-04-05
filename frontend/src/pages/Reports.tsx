"use client";

import { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, Phone, RefreshCcw, Printer, Calendar, Hash, BadgePercent, Landmark, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// PDF Printing Imports
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

let reportsCache: any[] | null = null;

const Reports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ================= FETCH & GROUP REPORTS =================
  const fetchReports = async (forceRefresh = false) => {
    if (!forceRefresh && reportsCache !== null) {
      setPurchases(reportsCache);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/reports/purchases", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const grouped = (data.purchases || []).reduce((acc: any[], p: any) => {
        const existing = acc.find((x: any) => x.id === p.id);
        const itemObj = {
          product: p.productName,
          grams: Number(p.grams),
          cost: Number(p.itemCost),
          category: p.category
        };

        if (existing) {
          existing.items.push(itemObj);
        } else {
          acc.push({
            id: p.id,
            customer: p.customerName,
            phone: p.phoneNumber,
            date: new Date(p.purchasedAt),
            paymentId: p.paymentId,
            paymentStatus: p.paymentStatus,
            subtotal: Number(p.totalAmount),
            gst: Number(p.gstAmount),
            discount: Number(p.discountAmount),
            grandTotal: Number(p.finalAmount),
            items: [itemObj]
          });
        }
        return acc;
      }, []);

      setPurchases(grouped);
      reportsCache = grouped;
    } catch (error) {
      console.error(error);
      setToastMessage("Failed to sync analytics");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // ================= EXCEL EXPORT LOGIC =================
  const exportToExcel = () => {
    try {
      const dataToExport = filteredData.flatMap((p) =>
        p.items.map((item: any) => ({
          Date: p.date.toLocaleDateString(),
          Invoice: `#SVRN-${p.id.slice(-6)}`,
          Customer: p.customer,
          Phone: p.phone,
          Product: item.product,
          Grams: item.grams,
          Item_Cost: item.cost,
          Subtotal: p.subtotal,
          GST: p.gst,
          Discount: p.discount,
          Grand_Total: p.grandTotal,
          Status: p.paymentStatus
        }))
      );

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Report");
      XLSX.writeFile(workbook, `Suvarna_Report_${timeRange}_${new Date().toLocaleDateString()}.xlsx`);
      setToastMessage("Excel report downloaded");
      setShowToast(true);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= FULL REPORT PDF EXPORT (ALL DATA) =================
  const exportToPDF = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const { height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Title
      page.drawText(`Suvarna Jewellery Sales Report - ${timeRange.toUpperCase()}`, { x: 50, y: height - 50, size: 18, font: boldFont, color: rgb(0.72, 0.52, 0.04) });
      page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, { x: 50, y: height - 70, size: 10, font });

      // Table Headers
      const headers = ["Date", "Invoice", "Customer", "Items", "Grand Total"];
      const colX = [50, 120, 200, 350, 480];
      let currentY = height - 110;

      headers.forEach((h, i) => {
        page.drawText(h, { x: colX[i], y: currentY, size: 10, font: boldFont });
      });

      page.drawLine({ start: { x: 50, y: currentY - 5 }, end: { x: 550, y: currentY - 5 }, thickness: 1, color: rgb(0, 0, 0) });

      currentY -= 25;

      // Table Rows
      filteredData.forEach((p) => {
        if (currentY < 50) return; // Basic pagination skip for brevity
        page.drawText(p.date.toLocaleDateString(), { x: colX[0], y: currentY, size: 9, font });
        page.drawText(`#${p.id.slice(-6)}`, { x: colX[1], y: currentY, size: 9, font });
        page.drawText(p.customer.substring(0, 20), { x: colX[2], y: currentY, size: 9, font });
        page.drawText(`${p.items.length} pcs`, { x: colX[3], y: currentY, size: 9, font });
        page.drawText(`INR ${p.grandTotal.toLocaleString()}`, { x: colX[4], y: currentY, size: 9, font: boldFont });
        currentY -= 20;
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Suvarna_Analytics_${timeRange}.pdf`;
      link.click();
      setToastMessage("Full PDF Report Generated");
      setShowToast(true);
    } catch (error) {
      console.error(error);
    }
  };

  // ================= INDIVIDUAL RECEIPT LOGIC =================
  const handleReceiptAction = async (purchase: any, mode: "download" | "print") => {
    try {
      const [templateBytes, fontBytes] = await Promise.all([
        fetch("/receipt-template.pdf").then((res) => res.arrayBuffer()),
        fetch("/fonts/Inter_18pt-Regular.ttf").then((res) => res.arrayBuffer()),
      ]);

      const pdfDoc = await PDFDocument.load(templateBytes);
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPages()[0];
      const { height } = page.getSize();

      const draw = (text: string, x: number, topOffset: number, size = 11, color = rgb(0, 0, 0)) => {
        page.drawText(String(text), { x, y: height - topOffset, size, font: customFont, color });
      };

      const drawRight = (text: string, rightX: number, topOffset: number, size = 11, color = rgb(0, 0, 0)) => {
        const textWidth = customFont.widthOfTextAtSize(String(text), size);
        page.drawText(String(text), { x: rightX - textWidth, y: height - topOffset, size, font: customFont, color });
      };

      const marginL = 70;
      const marginR = 520;
      const weightRightX = 300;
      const weightLabelWidth = customFont.widthOfTextAtSize("WEIGHT", 10);
      const summaryLabelX = weightRightX - weightLabelWidth;

      draw(purchase.customer.toUpperCase(), marginL, 220, 16);
      draw(`Phone: ${purchase.phone}`, marginL, 240, 11);
      drawRight(`Date: ${purchase.date.toLocaleDateString()}`, marginR, 220, 11);
      drawRight(`Invoice: #SVRN-${purchase.id.slice(-6)}`, marginR, 240, 11);

      draw("ITEM DESCRIPTION", marginL, 290, 10);
      drawRight("WEIGHT", weightRightX, 290, 10);
      drawRight("AMOUNT", marginR, 290, 10);

      page.drawLine({ start: { x: marginL, y: height - 298 }, end: { x: marginR, y: height - 298 }, thickness: 1, color: rgb(0.8, 0.7, 0.5) });

      let currentY = 320;
      purchase.items.forEach((item: any) => {
        draw(item.product, marginL, currentY, 11);
        drawRight(`${item.grams}g`, 290, currentY, 11);
        drawRight(`₹${item.cost.toLocaleString()}`, marginR, currentY, 11);
        currentY += 25;
      });

      page.drawLine({ start: { x: marginL, y: height - (currentY - 5) }, end: { x: marginR, y: height - (currentY - 5) }, thickness: 1, color: rgb(0.8, 0.7, 0.5) });

      let summaryY = currentY + 20;
      draw("Subtotal", summaryLabelX, summaryY, 10);
      drawRight(`₹${purchase.subtotal.toLocaleString()}`, marginR, summaryY, 10);
      summaryY += 18;
      draw("GST (3%)", summaryLabelX, summaryY, 10);
      drawRight(`₹${purchase.gst.toLocaleString()}`, marginR, summaryY, 10);

      if (purchase.discount > 0) {
        summaryY += 18;
        draw("Discount", summaryLabelX, summaryY, 10, rgb(0.7, 0, 0));
        drawRight(`- ₹${purchase.discount.toLocaleString()}`, marginR, summaryY, 10, rgb(0.7, 0, 0));
      }

      const totalY = summaryY + 40;
      draw("GRAND TOTAL", summaryLabelX, totalY, 10);
      const totalText = `₹${purchase.grandTotal.toLocaleString()}`;
      const totalSize = 22;
      const totalWidth = customFont.widthOfTextAtSize(totalText, totalSize);
      page.drawText(totalText, { x: marginR - totalWidth, y: height - totalY, size: totalSize, font: customFont, color: rgb(0.72, 0.52, 0.04) });

      const pdfBytes = await pdfDoc.save();
      const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `Receipt_${purchase.customer}.pdf`;
        link.click();
      } else {
        const printWindow = window.open(pdfUrl);
        if (printWindow) printWindow.addEventListener('load', () => { printWindow.print(); });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    return ALL_PURCHASES.filter((item) => {
      const itemDate = item.date;
      if (timeRange === "day") return itemDate.toDateString() === now.toDateString();
      if (timeRange === "week") return itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (timeRange === "month") return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      if (timeRange === "year") return itemDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [timeRange, ALL_PURCHASES]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">          <header className="sticky top-0 z-20 bg-background border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-bold italic tracking-tight text-primary">Sales Intelligence</h1>
              <p className="text-sm text-muted-foreground tracking-widest uppercase">Suvarna Reports</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="icon" onClick={() => fetchReports(true)}>
                <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
              {/* NEW PDF EXPORT BUTTON */}
              <Button variant="gold-outline" onClick={exportToPDF} className="font-bold">
                <FileText className="w-4 h-4 mr-2" /> Export PDF
              </Button>
              <Button variant="gold-outline" onClick={exportToExcel} className="font-bold">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
              </Button>
            </div>
          </div>
        </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 text-foreground">
            <div className="flex gap-2 bg-secondary/50 p-1 rounded-lg w-fit border border-primary/10">
              {(["day", "week", "month", "year"] as const).map((range) => (
                <Button key={range} variant={timeRange === range ? "gold" : "ghost"} size="sm" onClick={() => setTimeRange(range)} className="capitalize px-6">{range}</Button>
              ))}
            </div>

            <LuxuryCard className="p-0 overflow-hidden border-primary/20 shadow-xl">
              <div className="p-6 border-b bg-primary/5 flex justify-between items-center">
                <h3 className="font-serif font-bold text-xl flex items-center gap-2"><Landmark className="w-5 h-5 text-primary" /> Registry ({timeRange})</h3>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold tracking-[0.2em]">{filteredData.length} RECORDS</span>
              </div>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.id} onClick={() => setSelectedCustomer(row)} className="group cursor-pointer hover:bg-primary/[0.03]">
                      <TableCell>
                        <div className="font-mono font-bold text-primary">#SVRN-{row.id.slice(-6)}</div>
                        <div className="text-[10px] text-muted-foreground">{row.date.toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">{row.customer}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{row.phone}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg text-amber-700 italic">₹{row.grandTotal.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </LuxuryCard>
          </div>
        </main>
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedCustomer && (
            <div className="flex flex-col">
              <div className="bg-primary p-8 text-primary-foreground relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <BadgePercent className="w-10 h-10 mb-4 opacity-20" />
                    <h2 className="text-3xl font-serif font-bold italic tracking-tight">{selectedCustomer.customer}</h2>
                    <p className="text-sm opacity-80 mt-1 italic">{selectedCustomer.phone} • {selectedCustomer.date.toLocaleDateString()}</p>
                  </div>
                  <div className="text-right font-mono text-xl font-bold">#SVRN-{selectedCustomer.id.slice(-6)}</div>
                </div>
              </div>

              <div className="p-8 space-y-6 bg-white">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Hash className="w-4 h-4" /> Items</h4>
                  {selectedCustomer.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-secondary/20 border border-primary/5">
                      <div>
                        <p className="font-bold text-sm">{item.product}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{item.category} • {item.grams}g</p>
                      </div>
                      <p className="font-bold text-primary italic">₹{item.cost.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-dashed">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{selectedCustomer.subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs text-primary font-bold"><span>GST (3%)</span><span>₹{selectedCustomer.gst.toLocaleString()}</span></div>
                    {selectedCustomer.discount > 0 && (
                      <div className="flex justify-between text-xs text-red-600 font-bold"><span>Discount</span><span>- ₹{selectedCustomer.discount.toLocaleString()}</span></div>
                    )}
                  </div>
                  <div className="bg-primary/5 p-4 rounded-2xl flex flex-col justify-center items-end border border-primary/10">
                    <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Grand Total</span>
                    <span className="text-4xl font-serif font-bold text-primary italic">₹{selectedCustomer.grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="gold" className="flex-1 h-14 font-bold shadow-xl rounded-xl" onClick={() => handleReceiptAction(selectedCustomer, "download")}>
                    <Download className="w-5 h-5 mr-3" /> Download PDF
                  </Button>
                  <Button variant="outline" className="flex-1 h-14 font-bold border-primary/20 text-primary rounded-xl" onClick={() => handleReceiptAction(selectedCustomer, "print")}>
                    <Printer className="w-5 h-5 mr-3" /> Print Receipt
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default Reports;