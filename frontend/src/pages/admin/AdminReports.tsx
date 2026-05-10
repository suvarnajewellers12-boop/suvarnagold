"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Download, Phone, RefreshCcw, Printer,
  BadgePercent, Landmark, FileSpreadsheet,
  Banknote, CreditCard, Smartphone, ScrollText,
  MapPin, Mail, Calendar, Filter, Search, X, ShoppingBag
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// PDF & QR Printing Imports
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

let reportsCache: any[] | null = null;

const Reports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<string[]>(["cash", "upi", "card", "cheque"]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const [storeInfo, setStoreInfo] = useState({
    name: "Suvarna Jewellers",
    email: "suvarnajewellers12@gmail.com",
    address: "D.No. 13-1-12, Main Road, New Gajuwaka, Visakhapatnam",
  });

  useEffect(() => {
    const fetchAdminDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:3000/api/admin/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.admins && data.admins.length > 0) {
          const admin = data.admins[0];
          setStoreInfo({
            name: "Suvarna Jewellers",
            email: admin.email || admin.gmail || "suvarnajewellers12@gmail.com",
            address: admin.address || "D.No. 13-1-12, Main Road, New Gajuwaka",
          });
        }
      } catch (err) {
        console.error("Store Info Fetch Error:", err);
      }
    };
    fetchAdminDetails();
  }, []);

  useEffect(() => {
    QRCode.toDataURL("https://suvarnajewellers.in", {
      margin: 2, width: 200, color: { dark: "#78350f", light: "#ffffff" },
    }).then(setQrCodeUrl).catch(console.error);
  }, []);

  const fetchReports = async (forceRefresh = false) => {
    if (!forceRefresh && reportsCache !== null) {
      console.log("DEBUG: Loading from cache", reportsCache);
      setPurchases(reportsCache);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/admin/reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      console.log("DEBUG: Raw API Response Received", data);

      if (!data.purchases || data.purchases.length === 0) {
        console.warn("DEBUG: No purchases found in API response.");
      }
      const grouped = (data.purchases || []).reduce((acc: any[], p: any) => {
        const existing = acc.find((x: any) => x.id === p.id);

        // Logic for the individual item
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
          sku: p.sku,
        };

        if (existing) {
          existing.items.push(itemObj);
        } else {
          // FIX: Access numbers directly as they appear in your raw API log
          acc.push({
            id: p.id,
            customer: p.customerName,
            phone: p.phoneNumber,
            email: p.emailid,
            address: p.Address,
            date: p.purchasedAt,
            paymentId: p.paymentId,
            paymentStatus: p.paymentStatus,
            // Accessing correct keys from your raw log
            subtotal: Number(p.subtotal || 0),
            cgst: Number(p.cgst || 0),
            sgst: Number(p.sgst || 0),
            discount: Number(p.discount || 0),
            couponDiscount: Number(p.couponDiscount || 0),
            exchangeDiscount: Number(p.exchangeDiscount || 0),
            grandTotal: Number(p.grandTotal || 0),
            invoice: p.invoice,
            // FIX: Mapping the nested payments object correctly
            payments: {
              cash: Number(p.payments?.cash || 0),
              upi: Number(p.payments?.upi || 0),
              card: Number(p.payments?.card || 0),
              cheque: Number(p.payments?.cheque || 0),
            },
            items: [itemObj],
          });
        }
        return acc;
      }, []);

      console.log("DEBUG: Data successfully grouped into invoices", grouped);
      setPurchases(grouped);
      reportsCache = grouped;
    } catch (error) {
      console.error("DEBUG: Fetch Error", error);
      setToastMessage("Failed to sync analytics");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const filteredData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    console.log("DEBUG: Filtering for Date (Local ISO):", todayStr);

    const result = ALL_PURCHASES.filter((item) => {
      // Logic for Date Filtering
      const itemDateStr = new Date(item.date).toISOString().split('T')[0];
      const isToday = itemDateStr === todayStr;

      if (!isToday) {
        console.log(`DEBUG: Excluded ${item.invoice} - Date mismatch (${itemDateStr} vs ${todayStr})`);
        return false;
      }

      // Logic for Search
      const matchesSearch = searchQuery === "" ||
        item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.phone.includes(searchQuery) ||
        item.invoice.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) {
        console.log(`DEBUG: Excluded ${item.invoice} - Search query mismatch`);
        return false;
      }

      // Logic for Payment Filters
      const hasSelectedPayment = selectedPayments.some(
        type => item.payments[type as keyof typeof item.payments] > 0
      );

      if (!hasSelectedPayment) {
        console.log(`DEBUG: Excluded ${item.invoice} - Payment type not selected`);
        return false;
      }

      console.log(`DEBUG: Included ${item.invoice}`);
      return true;
    });

    console.log("DEBUG: Final Filtered Array Count:", result.length);
    return result;
  }, [searchQuery, selectedPayments, ALL_PURCHASES]);

  const financialSummary = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
      acc.totalCash += curr.payments.cash;
      acc.totalUpi += curr.payments.upi;
      acc.totalCard += curr.payments.card;
      acc.totalCheque += curr.payments.cheque;
      acc.grandTotal += curr.grandTotal;
      return acc;
    }, { totalCash: 0, totalUpi: 0, totalCard: 0, totalCheque: 0, grandTotal: 0 });
  }, [filteredData]);

  // ... (Keep handleReceiptAction, exportToExcel, togglePaymentFilter as they were)
  const togglePaymentFilter = (type: string) => {
    setSelectedPayments(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

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
      const { width, height } = page.getSize();
      const qrImage = await pdfDoc.embedPng(qrCodeUrl);

      const gold = rgb(0.72, 0.52, 0.04);
      const grey = rgb(0.45, 0.45, 0.45);
      const black = rgb(0, 0, 0);
      const red = rgb(0.8, 0, 0);
      const tableBorderColor = rgb(0.85, 0.85, 0.85);

      const wrapText = (text: string, maxWidth: number, fontSize: number) => {
        const words = String(text || "").split(' ');
        let lines = [];
        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const w = customFont.widthOfTextAtSize(currentLine + " " + word, fontSize);
          if (w < maxWidth) { currentLine += " " + word; }
          else { lines.push(currentLine); currentLine = word; }
        }
        lines.push(currentLine);
        return lines;
      };

      const draw = (text: string, x: number, yOffset: number, size = 10, color = black) => {
        page.drawText(String(text || ""), { x, y: height - yOffset, size, font: customFont, color });
      };

      const drawRight = (text: string, rightX: number, yOffset: number, size = 10, color = black) => {
        const textWidth = customFont.widthOfTextAtSize(String(text || ""), size);
        page.drawText(String(text || ""), { x: rightX - textWidth, y: height - yOffset, size, font: customFont, color });
      };

      const storeTopY = 175;
      draw(storeInfo.name.toUpperCase(), 40, storeTopY, 14, gold);
      const storeAddrLines = wrapText(storeInfo.address, 160, 13);
      storeAddrLines.forEach((line, i) => draw(line, 40, storeTopY + 18 + (i * 10), 13, grey));
      draw(`Email: ${storeInfo.email}`, 40, storeTopY + 18 + (storeAddrLines.length * 10), 13, grey);

      const rightColX = 350;
      draw(`INVOICE: ${purchase.invoice}`, rightColX, storeTopY, 11, black);
      draw(`Date: ${format(new Date(purchase.date), "dd-MM-yyyy")}`, rightColX, storeTopY + 15, 9, grey);
      draw(`Customer: ${purchase.customer}`, rightColX, storeTopY + 35, 11, black);
      draw(`Phone: ${purchase.phone}`, rightColX, storeTopY + 50, 9, grey);
      const custAddrLines = wrapText(`Address: ${purchase.address || "N/A"}`, width - rightColX - 40, 9);
      custAddrLines.forEach((line, i) => draw(line, rightColX, storeTopY + 65 + (i * 11), 9, grey));

      const headY = 320;
      const tableLeft = 35;
      const tableRight = width - 35;
      const colX = { name: 40, purity: 180, gross: 250, net: 320, va: 380, price: 555 };

      page.drawRectangle({
        x: tableLeft,
        y: height - headY - 15,
        width: tableRight - tableLeft,
        height: 20,
        color: rgb(0.98, 0.97, 0.95),
      });

      draw("ITEM DETAILS", colX.name, headY, 9, grey);
      draw("PURITY", colX.purity, headY, 9, grey);
      draw("GROSS", colX.gross, headY, 9, grey);
      draw("NET", colX.net, headY, 9, grey);
      draw("VA%", colX.va, headY, 9, grey);
      drawRight("PRICE", colX.price, headY, 9, grey);

      page.drawLine({
        start: { x: tableLeft, y: height - (headY + 10) },
        end: { x: tableRight, y: height - (headY + 10) },
        thickness: 1,
        color: tableBorderColor,
      });

      let currentY = headY + 30;

      purchase.items.forEach((item: any) => {
        draw(item.productName.toUpperCase(), colX.name, currentY, 10, black);
        draw(item.purity, colX.purity, currentY, 10, black);
        draw(`${item.grossWt}g`, colX.gross, currentY, 10, black);
        draw(`${item.netWt}g`, colX.net, currentY, 10, black);
        draw(`${item.va}%`, colX.va, currentY, 10, black);
        drawRight(`₹${item.itemCost.toLocaleString()}`, colX.price, currentY, 10, black);

        currentY += 14;
        draw(`SKU: ${item.sku || "N/A"} | HUID: ${item.huid || "N/A"}`, colX.name, currentY, 8, grey);

        page.drawLine({
          start: { x: tableLeft, y: height - (currentY + 10) },
          end: { x: tableRight, y: height - (currentY + 10) },
          thickness: 0.5,
          color: tableBorderColor,
        });

        currentY += 26;
      });

      const tableBottom = currentY - 16;
      const vLines = [tableLeft, colX.purity - 5, colX.gross - 5, colX.net - 5, colX.va - 5, colX.price - 75, tableRight];
      vLines.forEach(x => {
        page.drawLine({
          start: { x, y: height - (headY - 15) },
          end: { x, y: height - tableBottom },
          thickness: 0.5,
          color: tableBorderColor,
        });
      });

      page.drawLine({ start: { x: tableLeft, y: height - (headY - 15) }, end: { x: tableRight, y: height - (headY - 15) }, thickness: 1, color: grey });
      page.drawLine({ start: { x: tableLeft, y: height - tableBottom }, end: { x: tableRight, y: height - tableBottom }, thickness: 1, color: grey });

      let totalY = tableBottom + 30;
      drawRight(`Subtotal: ₹${purchase.subtotal.toLocaleString()}`, colX.price, totalY, 10);
      totalY += 18;
      drawRight(`GST (3%): ₹${(purchase.cgst + purchase.sgst).toLocaleString()}`, colX.price, totalY, 10);

      if (purchase.exchangeDiscount > 0) {
        totalY += 18;
        drawRight(`Exchange Value: -₹${purchase.exchangeDiscount.toLocaleString()}`, colX.price, totalY, 10, red);
      }
      if (purchase.couponDiscount > 0) {
        totalY += 18;
        drawRight(`Coupon Discount: -₹${purchase.couponDiscount.toLocaleString()}`, colX.price, totalY, 10, red);
      }
      if (purchase.discount > 0) {
        totalY += 18;
        drawRight(`Manager Waiver: -₹${purchase.discount.toLocaleString()}`, colX.price, totalY, 10, red);
      }

      totalY += 25;
      drawRight(`GRAND TOTAL: ₹${purchase.grandTotal.toLocaleString()}`, colX.price, totalY, 16, gold);

      page.drawImage(qrImage, { x: (width - 60) / 2, y: 80, width: 60, height: 60 });

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `Invoice_${purchase.invoice}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const printWindow = window.open(pdfUrl, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };
        }
      }
    } catch (error) {
      console.error("PDF Error:", error);
    }
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) return;
    const flattenedData = filteredData.flatMap(p => p.items.map((item: any) => ({
      "Date": format(new Date(p.date), "dd-MM-yyyy"),
      "Invoice": p.invoice,
      "Customer": p.customer,
      "Phone": p.phone,
      "Product": item.productName,
      "SKU": item.sku || "N/A",
      "Gross Wt": item.grossWt,
      "Subtotal": p.subtotal,
      "Coupon": p.couponDiscount,
      "Exchange": p.exchangeDiscount,
      "Waiver": p.discount,
      "CGsT": p.cgst,
      "SGST": p.sgst,
      "Grand Total": p.grandTotal,
    })));
    const worksheet = XLSX.utils.json_to_sheet(flattenedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Today_Sales");
    XLSX.writeFile(workbook, `Suvarna_Today_${format(new Date(), "ddMMyy")}.xlsx`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="sticky top-0 z-20 bg-white border-b-2 border-gold/10 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-serif font-bold italic tracking-tight text-primary">Daily Sales Intelligence</h1>
                <p className="text-sm text-muted-foreground tracking-widest uppercase">Today: {format(new Date(), "do MMMM yyyy")}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-slate-50 border-primary/10 rounded-full" />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
                </div>
                <Button variant="outline" size="icon" onClick={() => fetchReports(true)} className="rounded-full border-gold/20"><RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} /></Button>
                <Button variant="gold" onClick={exportToExcel} className="font-bold rounded-full shadow-lg"><FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel</Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <LuxuryCard className="p-6 bg-white border-gold/10 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Filter className="w-3 h-3" /> Settlement Filters</span>
                <div className="flex gap-6 items-center bg-slate-50 px-6 py-3 rounded-2xl border-2 border-gold/5">
                  {["cash", "upi", "card", "cheque"].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer group">
                      <Checkbox checked={selectedPayments.includes(type)} onCheckedChange={() => togglePaymentFilter(type)} className="border-gold/30 data-[state=checked]:bg-gold data-[state=checked]:border-gold" />
                      <span className="text-xs font-black uppercase text-slate-600 group-hover:text-gold transition-colors">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="text-right hidden md:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analytics Window</p>
                <p className="text-sm font-serif font-bold text-primary italic">Live registry for {format(new Date(), "PPP")}</p>
              </div>
            </LuxuryCard>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                { label: "CASH", val: financialSummary.totalCash, color: "border-emerald-500", icon: <Banknote className="w-5 h-5 text-emerald-600" /> },
                { label: "UPI", val: financialSummary.totalUpi, color: "border-blue-500", icon: <Smartphone className="w-5 h-5 text-blue-600" /> },
                { label: "CARD", val: financialSummary.totalCard, color: "border-indigo-500", icon: <CreditCard className="w-5 h-5 text-indigo-600" /> },
                { label: "CHEQUE", val: financialSummary.totalCheque, color: "border-amber-500", icon: <ScrollText className="w-5 h-5 text-amber-600" /> }
              ].map((card, i) => (
                <LuxuryCard key={i} className={cn("p-6 border-t-4 bg-white shadow-md transition-transform hover:scale-[1.02]", card.color)}>
                  <div className="flex items-center gap-2 mb-3">{card.icon} <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</span></div>
                  <div className="text-2xl font-serif font-black text-slate-800 italic">₹{card.val.toLocaleString()}</div>
                </LuxuryCard>
              ))}
              <LuxuryCard className="p-6 bg-slate-900 text-gold border-t-4 border-gold shadow-xl flex flex-col justify-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">GROSS REVENUE</div>
                <div className="text-3xl font-serif font-black italic tracking-tighter">₹{financialSummary.grandTotal.toLocaleString()}</div>
              </LuxuryCard>
            </div>

            <LuxuryCard className="p-0 overflow-hidden border-primary/20 shadow-xl bg-white">
              <div className="p-6 border-b bg-primary/5 flex justify-between items-center">
                <h3 className="font-serif font-bold text-xl flex items-center gap-2 text-primary">
                  <Landmark className="w-5 h-5" /> Transaction Registry
                </h3>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold tracking-[0.2em]">
                  {isLoading ? "SYNCING..." : `${filteredData.length} RECORDS`}
                </span>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold">Invoice</TableHead>
                      <TableHead className="font-bold">Customer</TableHead>
                      <TableHead className="font-bold">Settlement Method</TableHead>
                      <TableHead className="text-right font-bold w-[160px]">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`} className="animate-pulse">
                          <TableCell><div className="h-4 w-24 bg-muted rounded mb-2" /><div className="h-3 w-16 bg-muted/40 rounded" /></TableCell>
                          <TableCell><div className="h-4 w-32 bg-muted rounded mb-2" /><div className="h-3 w-20 bg-muted/40 rounded" /></TableCell>
                          <TableCell><div className="flex gap-1"><div className="h-4 w-10 bg-muted rounded" /><div className="h-4 w-10 bg-muted rounded" /></div></TableCell>
                          <TableCell className="w-[160px]"><div className="h-6 w-24 bg-muted rounded ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <TableRow
                          key={row.id}
                          onClick={() => setSelectedCustomer(row)}
                          className="group cursor-pointer hover:bg-primary/[0.03] transition-colors"
                        >
                          <TableCell>
                            <div className="font-mono font-bold text-primary">{row.invoice}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">
                              {row.date ? format(new Date(row.date), "PPP") : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-gray-800 uppercase text-xs tracking-tight">{row.customer}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />{row.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.payments.cash > 0 && <span className="text-[8px] bg-emerald-50 text-emerald-700 font-black px-1.5 py-0.5 rounded border border-emerald-200 uppercase">Cash</span>}
                              {row.payments.upi > 0 && <span className="text-[8px] bg-blue-50 text-blue-700 font-black px-1.5 py-0.5 rounded border border-blue-200 uppercase">UPI</span>}
                              {row.payments.card > 0 && <span className="text-[8px] bg-indigo-50 text-indigo-700 font-black px-1.5 py-0.5 rounded border border-indigo-200 uppercase">Card</span>}
                              {row.payments.cheque > 0 && <span className="text-[8px] bg-amber-50 text-amber-700 font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase">CHQ</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-serif font-black text-lg text-slate-900 italic w-[160px]">
                            ₹{row.grandTotal?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-48 text-center bg-slate-50/50">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <ShoppingBag className="w-8 h-8 text-slate-200" />
                            <p className="text-sm font-serif italic text-muted-foreground">No luxury transactions recorded for today.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </LuxuryCard>
          </div>
        </main>
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem]">
          {selectedCustomer && (
            <div className="flex flex-col bg-white">
              <div className="bg-slate-900 p-10 text-gold relative overflow-hidden">
                <BadgePercent className="absolute -right-5 -bottom-5 w-40 h-40 opacity-5 rotate-12" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h2 className="text-4xl font-serif font-black italic tracking-tighter">{selectedCustomer.customer}</h2>
                    <div className="flex items-center gap-6 mt-4">
                      <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-gold/10 px-3 py-1.5 rounded-full border border-gold/20"><Phone size={12} /> {selectedCustomer.phone}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-gold/10 px-3 py-1.5 rounded-full border border-gold/20"><Calendar size={12} /> {format(new Date(selectedCustomer.date), "PPP")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Authorization Invoice</div>
                    <div className="text-2xl font-mono font-black border-b-2 border-gold/30 pb-1">{selectedCustomer.invoice}</div>
                  </div>
                </div>
              </div>
              <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2"><MapPin size={14} /> Registered Address</span>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase">{selectedCustomer.address || "Walk-in Customer"}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2"><Mail size={14} /> Contact Email</span>
                    <p className="text-xs font-bold text-slate-600 lowercase">{selectedCustomer.email || "N/A"}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 border-b-2 border-gold/5 pb-2">Inventory Summary</h4>
                  {selectedCustomer.items.map((item: any, i: number) => (
                    <div key={i} className="p-5 rounded-3xl bg-slate-50 border-2 border-gold/5 hover:border-gold/20 transition-colors group">
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-black text-slate-800 uppercase text-sm tracking-tight">{item.productName}</p>
                        <p className="font-black text-primary italic text-lg tracking-tighter">₹{item.itemCost.toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Purity</span><span className="text-[10px] font-black text-slate-600 uppercase">{item.purity}</span></div>
                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Net Wt</span><span className="text-[10px] font-black text-slate-600 uppercase">{item.netWt}g</span></div>
                        <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">VA Off</span><span className="text-[10px] font-black text-slate-600 uppercase">{item.va}%</span></div>
                        <div className="flex flex-col items-end"><span className="text-[8px] font-black text-slate-400 uppercase">SKU ID</span><span className="text-[10px] font-black text-gold uppercase tracking-tighter">{item.sku}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-8 rounded-[2rem] bg-[#FDFCF9] border-2 border-gold/10 space-y-5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gold border-b border-gold/10 pb-3">Payment Settlement</h4>
                  <div className="space-y-3">
                    {selectedCustomer.exchangeDiscount > 0 && <div className="flex justify-between text-xs font-bold text-amber-600 uppercase tracking-tighter"><span>Old Gold Exchange ({selectedCustomer.exchangeName})</span><span>-₹{selectedCustomer.exchangeDiscount.toLocaleString()}</span></div>}
                    {selectedCustomer.couponDiscount > 0 && <div className="flex justify-between text-xs font-bold text-blue-600 uppercase tracking-tighter"><span>Rewards Voucher Benefit</span><span>-₹{selectedCustomer.couponDiscount.toLocaleString()}</span></div>}
                    {selectedCustomer.discount > 0 && <div className="flex justify-between text-xs font-bold text-emerald-600 uppercase tracking-tighter"><span>Manager Loyalty Waiver</span><span>-₹{selectedCustomer.discount.toLocaleString()}</span></div>}
                    <div className="pt-4 border-t-2 border-gold/10 flex justify-between items-end">
                      <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Amount Due</span><span className="text-4xl font-serif font-black text-slate-900 italic tracking-tighter">₹{selectedCustomer.grandTotal.toLocaleString()}</span></div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-14 px-8 rounded-2xl border-gold/20 font-black uppercase text-[10px] tracking-widest hover:bg-gold hover:text-white transition-all" onClick={() => handleReceiptAction(selectedCustomer, "print")}><Printer size={18} className="mr-2" /> Print</Button>
                        <Button variant="gold" className="h-14 px-10 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl" onClick={() => handleReceiptAction(selectedCustomer, "download")}><Download size={18} className="mr-2" /> Archive PDF</Button>
                      </div>
                    </div>
                  </div>
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

