"use client";

import { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, Phone, RefreshCcw, Printer, Calendar, Hash, BadgePercent, Landmark, FileSpreadsheet, FileText, Repeat } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// PDF & QR Printing Imports
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

let reportsCache: any[] | null = null;

// ================= STORE INFO =================
const STORE_INFO = {
  name: "Suvarna Jewellers",
  line1: "D.No. 13-1-12, Main Road,",
  line2: "Near YSR Statue, New Gajuwaka,",
  line3: "Visakhapatnam - 530026,",
  line4: "Andhra Pradesh",
  phone: "Cell: 94943 34040",
};

const Reports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL("https://suvarnajewellers.in", {
      margin: 2,
      width: 200,
      color: { dark: "#78350f", light: "#ffffff" },
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, []);

  const fetchReports = async (forceRefresh = false) => {
    if (!forceRefresh && reportsCache !== null) {
      setPurchases(reportsCache);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/reports/purchases", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const grouped = (data.purchases || []).reduce((acc: any[], p: any) => {
        const existing = acc.find((x: any) => x.id === p.id);
        const itemObj = {
          productName: p.productName,
          category: p.category,
          purity: p.purity,
          grossWt: p.grossWt,
          netWt: p.netWt,
          va: p.va,
          huid: p.huid,
          itemCost: p.itemCost,
          grams: p.grams,
        };

        if (existing) {
          existing.items.push(itemObj);
        } else {
          acc.push({
            id: p.id,
            customer: p.customerName,
            phone: p.phoneNumber,
            email: p.emailid,
            address: p.Address,
            date: new Date(p.purchasedAt),
            paymentId: p.paymentId,
            paymentStatus: p.paymentStatus,
            subtotal: Number(p.totalAmount),
            cgst: Number(p.cgstAmount),
            sgst: Number(p.sgstAmount),
            discount: Number(p.discountAmount),
            // Exchange Fields
            exchangeDiscount: Number(p.jewelleryexchangediscount || 0),
            exchangeName: p.excahngejewellryname,
            exchangeGrams: p.excahngejewellrygrams,
            grandTotal: Number(p.finalAmount),
            items: [itemObj],
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

  const exportToExcel = () => {
    try {
      const dataToExport = filteredData.flatMap((p) =>
        p.items.map((item: any) => ({
          Date: p.date.toLocaleDateString(),
          Invoice: `#SVRN-${p.id.slice(-6).toUpperCase()}`,
          Customer: p.customer,
          Phone: p.phone,
          Email: p.email,
          Address: p.address,
          Product: item.productName,
          Purity: item.purity,
          "Gross Wt": item.grossWt,
          "Net Wt": item.netWt,
          "VA %": item.va,
          HUID: item.huid,
          "Item Value": item.itemCost,
          Subtotal: p.subtotal,
          CGST: p.cgst,
          SGST: p.sgst,
          "Exchange Discount": p.exchangeDiscount,
          "Other Discount": p.discount,
          Grand_Total: p.grandTotal,
          Status: p.paymentStatus,
        }))
      );
      
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Report");
      XLSX.writeFile(workbook, `Suvarna_Report_${timeRange}_${new Date().toLocaleDateString()}.xlsx`);
      setToastMessage("Excel report downloaded");
      setShowToast(true);
    } catch (err) { console.error(err); }
  };

  const exportToPDF = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const { height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText(`Suvarna Jewellery Sales Report - ${timeRange.toUpperCase()}`, {
        x: 50, y: height - 50, size: 18, font: boldFont, color: rgb(0.72, 0.52, 0.04),
      });
      page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
        x: 50, y: height - 70, size: 10, font,
      });

      const headers = ["Date", "Invoice", "Customer", "Items", "Grand Total"];
      const colX = [50, 120, 200, 350, 480];
      let currentY = height - 110;

      headers.forEach((h, i) => { page.drawText(h, { x: colX[i], y: currentY, size: 10, font: boldFont }); });
      page.drawLine({ start: { x: 50, y: currentY - 5 }, end: { x: 550, y: currentY - 5 }, thickness: 1, color: rgb(0, 0, 0) });
      currentY -= 25;

      filteredData.forEach((p) => {
        if (currentY < 50) return;
        page.drawText(p.date.toLocaleDateString(), { x: colX[0], y: currentY, size: 9, font });
        page.drawText(`#${p.id.slice(-6).toUpperCase()}`, { x: colX[1], y: currentY, size: 9, font });
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
    } catch (error) { console.error(error); }
  };

  const handleReceiptAction = async (purchase: any, mode: "download" | "print") => {
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

      const qrImage = await pdfDoc.embedPng(qrCodeUrl);
      const qrDims = qrImage.scale(0.2);

      const gold = rgb(0.72, 0.52, 0.04);
      const grey = rgb(0.45, 0.45, 0.45);
      const black = rgb(0, 0, 0);
      const red = rgb(0.8, 0.1, 0.1); // Strong red for discounts
      const lightGold = rgb(0.8, 0.7, 0.5);

      const draw = (text: string, x: number, topOffset: number, size = 11, color = black) => {
        page.drawText(String(text || ""), { x, y: height - topOffset, size, font: customFont, color });
      };

      const drawRight = (text: string, rightX: number, topOffset: number, size = 11, color = black) => {
        const textWidth = customFont.widthOfTextAtSize(String(text || ""), size);
        page.drawText(String(text || ""), { x: rightX - textWidth, y: height - topOffset, size, font: customFont, color });
      };

      const wrapText = (text: string, maxWidth: number, size: number): string[] => {
        const words = String(text || "").split(" ");
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (customFont.widthOfTextAtSize(test, size) <= maxWidth) { current = test; } 
          else { if (current) lines.push(current); current = word; }
        }
        if (current) lines.push(current);
        return lines;
      };

      const drawWrapped = (text: string, x: number, startTopOffset: number, maxWidth: number, size = 10, color = grey, lineHeight = 14): number => {
        const lines = wrapText(text, maxWidth, size);
        let y = startTopOffset;
        for (const line of lines) { draw(line, x, y, size, color); y += lineHeight; }
        return y;
      };

      const marginL = 40;
      const marginR = 555;
      const pageCenter = width / 2;
      const colWidth = pageCenter - marginL - 16;
      const addrTopY = 175;

      // Store address
      draw("SUVARNA JEWELLERS", marginL, addrTopY, 12, gold);
      let storeY = addrTopY + 17;
      const storeLines = [STORE_INFO.line1, STORE_INFO.line2, STORE_INFO.line3, STORE_INFO.line4, STORE_INFO.phone];
      for (const line of storeLines) { storeY = drawWrapped(line, marginL, storeY, colWidth, 10, grey, 14); }

      // Bill To
      const rightColX = pageCenter + 12;
      const rightColWidth = marginR - rightColX;
      draw("BILL TO", rightColX, addrTopY, 12, gold);
      let custY = addrTopY + 17;
      draw(purchase.customer.toUpperCase(), rightColX, custY, 11, black);
      custY += 15;
      draw(`Ph: ${purchase.phone}`, rightColX, custY, 10, grey);
      custY += 14;
      draw(`Email: ${purchase.email || ""}`, rightColX, custY, 10, grey);
      custY += 14;
      custY = drawWrapped(purchase.address || "", rightColX, custY, rightColWidth, 10, grey, 14);

      // GOLD LINE DIVIDER
      const dividerBottom = Math.max(storeY, custY) + 6;
      page.drawLine({ start: { x: pageCenter, y: height - (addrTopY - 6) }, end: { x: pageCenter, y: height - dividerBottom }, thickness: 0.8, color: lightGold });
      page.drawLine({ start: { x: marginL, y: height - (dividerBottom + 4) }, end: { x: marginR, y: height - (dividerBottom + 4) }, thickness: 1, color: lightGold });

      // Invoice Meta
      const metaY = dividerBottom + 25;
      draw(`Invoice: #SVRN-${purchase.id.slice(-6).toUpperCase()}`, marginL, metaY, 10, grey);
      drawRight(`Date: ${purchase.date.toLocaleDateString()}`, marginR, metaY, 10, grey);

      // TABLE HEADER (WITH GOLD LINE)
      const col = { desc: marginL, purity: 185, gross: 255, net: 322, va: 390, value: marginR };
      const headY = metaY + 24;
      const headColor = rgb(0.35, 0.35, 0.35);
      draw("ITEM DESCRIPTION", col.desc, headY, 10, headColor);
      draw("PURITY", col.purity, headY, 10, headColor);
      draw("GROSS WT", col.gross, headY, 10, headColor);
      draw("NET WT", col.net, headY, 10, headColor);
      draw("VA (%)", col.va, headY, 10, headColor);
      drawRight("VALUE", col.value, headY, 10, headColor);

      // THE GOLD LINE IN PRINT VIEW HEADER
      page.drawLine({ start: { x: marginL, y: height - (headY + 10) }, end: { x: marginR, y: height - (headY + 10) }, thickness: 0.8, color: lightGold });

      // ITEMS
      let currentY = headY + 26;
      purchase.items.forEach((item: any) => {
        draw(item.productName, col.desc, currentY, 11);
        draw(item.purity, col.purity, currentY, 11);
        draw(`${item.grossWt}g`, col.gross, currentY, 11);
        draw(`${item.netWt}g`, col.net, currentY, 11);
        draw(`${item.va}%`, col.va, currentY, 11);
        drawRight(`₹${item.itemCost.toLocaleString()}`, col.value, currentY, 11);
        if (item.huid && item.huid !== "N/A") {
          draw(`HUID: ${item.huid}`, col.desc, currentY + 15, 9, rgb(0.5, 0.5, 0.5));
          currentY += 36;
        } else { currentY += 26; }
      });

      // Bottom Gold Line
      page.drawLine({ start: { x: marginL, y: height - (currentY - 8) }, end: { x: marginR, y: height - (currentY - 8) }, thickness: 0.8, color: lightGold });

      // SUMMARY
      const labelX = 365;
      let summaryY = currentY + 18;
      draw("Subtotal", labelX, summaryY, 11);
      drawRight(`₹${purchase.subtotal.toLocaleString()}`, marginR, summaryY, 11);

      summaryY += 20;
      draw("CGST (1.5%)", labelX, summaryY, 11);
      drawRight(`₹${purchase.cgst.toLocaleString()}`, marginR, summaryY, 11);

      summaryY += 20;
      draw("SGST (1.5%)", labelX, summaryY, 11);
      drawRight(`₹${purchase.sgst.toLocaleString()}`, marginR, summaryY, 11);

      // Differentiated Discounts
      const managerDiscount = purchase.discount;
      console.log("Manager Discount:", managerDiscount);
      if (managerDiscount > 0) {
        summaryY += 20;
        draw("Manager Discount", labelX, summaryY, 11, red);
        drawRight(`- ₹${managerDiscount.toLocaleString()}`, marginR, summaryY, 11, red);
      }

      // RED JEWELLERY EXCHANGE DISCOUNT
      if (purchase.exchangeDiscount > 0) {
        summaryY += 22;
        const exchangeLabel = purchase.exchangeName ? "Jewellery Exchange" : "Jewellery Exchange";
        draw(exchangeLabel, labelX - 2, summaryY, 11, red);
        drawRight(`- ₹${purchase.exchangeDiscount.toLocaleString()}`, marginR, summaryY, 11, red);
      }

      const totalY = summaryY + 36;
      draw("GRAND TOTAL", labelX, totalY, 13, gold);
      const totalText = `₹${purchase.grandTotal.toLocaleString()}`;
      const totalWidth = customFont.widthOfTextAtSize(totalText, 16);
      page.drawText(totalText, { x: marginR - totalWidth, y: height - totalY, size: 16, font: customFont, color: gold });

      // QR
      page.drawImage(qrImage, { x: (width - qrDims.width) / 2, y: 60, width: qrDims.width, height: qrDims.height });
      draw("Scan for Digital Catalog", (width - customFont.widthOfTextAtSize("Scan for Digital Catalog", 9)) / 2, height - 50, 9, grey);

      const pdfBytes = await pdfDoc.save();
      const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl; link.download = `SVRN_Invoice_${purchase.customer}.pdf`;
        link.click();
      } else {
        const printWindow = window.open(pdfUrl);
        if (printWindow) printWindow.addEventListener("load", () => { printWindow.print(); });
      }
    } catch (error) { console.error(error); }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="sticky top-0 z-20 bg-background border-b px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-serif font-bold italic tracking-tight text-primary">Sales Intelligence</h1>
                <p className="text-sm text-muted-foreground tracking-widest uppercase">Suvarna Reports</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="icon" onClick={() => fetchReports(true)}>
                  <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
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
                        <div className="font-mono font-bold text-primary">#SVRN-{row.id.slice(-6).toUpperCase()}</div>
                        <div className="text-[10px] text-muted-foreground">{row.date.toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">{row.customer}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{row.phone}</div>
                        {row.exchangeDiscount > 0 && (
                          <div className="text-[9px] text-red-600 font-bold flex items-center gap-1 mt-1">
                            <Repeat className="w-2.5 h-2.5" /> EXCHANGE APPLIED
                          </div>
                        )}
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
            <div className="flex flex-col bg-white">
              <div className="bg-primary p-8 text-primary-foreground relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <BadgePercent className="w-10 h-10 mb-4 opacity-20" />
                    <h2 className="text-3xl font-serif font-bold italic tracking-tight">{selectedCustomer.customer}</h2>
                    <p className="text-sm opacity-80 mt-1">{selectedCustomer.phone}</p>
                    {selectedCustomer.email && <p className="text-xs opacity-70 mt-0.5">{selectedCustomer.email}</p>}
                    <p className="text-xs opacity-60 mt-1 italic">{selectedCustomer.date.toLocaleDateString()}</p>
                  </div>
                  <div className="text-right font-mono text-xl font-bold">#SVRN-{selectedCustomer.id.slice(-6).toUpperCase()}</div>
                </div>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {selectedCustomer.address && (
                  <div className="text-xs text-muted-foreground bg-secondary/20 rounded-lg p-3 border border-primary/5">
                    <span className="font-bold text-primary uppercase tracking-widest text-[9px]">Delivery Address</span>
                    <p className="mt-1">{selectedCustomer.address}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Hash className="w-4 h-4" /> Items</h4>
                  {selectedCustomer.items.map((item: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-secondary/20 border border-primary/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-sm">{item.productName}</p>
                        <p className="font-bold text-primary italic">₹{item.itemCost.toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-3 text-[10px] uppercase text-muted-foreground gap-2">
                        <span>Purity: {item.purity}</span>
                        <span>Gross: {item.grossWt}g</span>
                        <span>Net: {item.netWt}g</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-dashed">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{selectedCustomer.subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-xs text-primary "><span>Taxes (3%)</span><span>₹{(selectedCustomer.cgst + selectedCustomer.sgst).toLocaleString()}</span></div>
                    {selectedCustomer.discount - selectedCustomer.exchangeDiscount > 0 && (
                      <div className="flex justify-between text-xs text-red-600 font-bold"><span>Other Discount</span><span>- ₹{(selectedCustomer.discount - selectedCustomer.exchangeDiscount).toLocaleString()}</span></div>
                    )}
                    {selectedCustomer.exchangeDiscount > 0 && (
                      <div className="flex justify-between text-xs text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100">
                        <span className="flex items-center gap-1"><Repeat className="w-3 h-3"/> Exchange Discount</span>
                        <span>- ₹{selectedCustomer.exchangeDiscount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-primary/5 p-4 rounded-2xl flex flex-col justify-center items-end border border-primary/10">
                    <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Grand Total</span>
                    <span className="text-4xl font-serif font-bold text-primary italic">₹{selectedCustomer.grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-3 sticky bottom-0 bg-white pt-4">
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