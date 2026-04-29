"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
    Download, Phone, RefreshCcw, Printer, Hash,
    BadgePercent, Landmark, FileSpreadsheet, FileText,
    Repeat, Banknote, CreditCard, Smartphone, ScrollText,
    MapPin, Mail, Calendar, Filter, Search, X
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

// PDF & QR Printing Imports
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

let reportsCache: any[] | null = null;

const STORE_INFO = {
    name: "Suvarna Jewellers",
    line1: "D.No. 13-1-12, Main Road,",
    line2: "Near YSR Statue, New Gajuwaka,",
    line3: "Visakhapatnam - 530026,",
    line4: "Andhra Pradesh",
    phone: "Gmail: suvarnajewellers12@gmail.com",
};

const Reports = () => {
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year" | "custom">("month");

    // Start with undefined so it doesn't immediately filter by "Today" on load
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPayments, setSelectedPayments] = useState<string[]>(["cash", "upi", "card", "cheque"]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

    useEffect(() => {
        QRCode.toDataURL("https://suvarnajewellers.in", {
            margin: 2, width: 200, color: { dark: "#78350f", light: "#ffffff" },
        }).then(setQrCodeUrl).catch(console.error);
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
                    sku: p.sku,
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
                        exchangeDiscount: Number(p.jewelleryexchangediscount || 0),
                        exchangeName: p.excahngejewellryname,
                        exchangeGrams: p.excahngejewellrygrams,
                        grandTotal: Number(p.finalAmount),
                        sku: p.sku,
                        payments: {
                            cash: Number(p.cashAmount || 0),
                            upi: Number(p.upiAmount || 0),
                            card: Number(p.cardAmount || 0),
                            cheque: Number(p.chequeAmount || 0),
                        },
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
            // 1. Search Filter (Customer Name or Phone)
            const matchesSearch =
                item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.phone.includes(searchQuery);
            if (!matchesSearch) return false;

            // 2. Time Filtering
            const itemDate = item.date;
            let matchesTime = true;

            if (timeRange === "day") {
                matchesTime = itemDate.toDateString() === now.toDateString();
            } else if (timeRange === "week") {
                matchesTime = itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (timeRange === "month") {
                matchesTime = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            } else if (timeRange === "year") {
                matchesTime = itemDate.getFullYear() === now.getFullYear();
            } else if (timeRange === "custom" && dateRange?.from) {
                const start = startOfDay(dateRange.from);

                if (!dateRange.to) {
                    // SINGLE DATE SELECTED: Match only that specific day
                    matchesTime = itemDate.toDateString() === start.toDateString();
                } else {
                    // DATE RANGE SELECTED: Match between dates
                    const end = endOfDay(dateRange.to);
                    matchesTime = isWithinInterval(itemDate, { start, end });
                }
            }
            console.log("ALL_PURCHASES", ALL_PURCHASES);

            if (!matchesTime) return false;

            // 3. Payment Type Filtering
            if (selectedPayments.length === 0) return false;
            const hasSelectedPayment = selectedPayments.some(type => item.payments[type as keyof typeof item.payments] > 0);

            return hasSelectedPayment;
        });
    }, [timeRange, dateRange, selectedPayments, searchQuery, ALL_PURCHASES]);

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


    const togglePaymentFilter = (type: string) => {
        setSelectedPayments(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const exportToExcel = () => {
        try {
            // Create a flat array where each item is its own row
            const flattenedData: any[] = [];

            filteredData.forEach((p) => {
                p.items.forEach((item: any) => {
                    flattenedData.push({
                        "Date": format(p.date, "dd-MM-yyyy"),
                        "Invoice": `#SVRN-${p.id.slice(-6).toUpperCase()}`,
                        "Customer": p.customer,
                        "Phone": p.phone,
                        "Product Name": item.productName, // Separate Column
                        "Category": item.category,       // Separate Column
                        "SKU": item.sku || "N/A",        // Separate Column
                        "HUID": item.huid || "N/A",      // Separate Column
                        "Purity": item.purity,           // Separate Column
                        "Gross Wt (g)": item.grossWt,    // Separate Column
                        "Net Wt (g)": item.netWt,        // Separate Column
                        "VA (%)": item.va,               // Separate Column
                        "Item Cost": item.itemCost,      // Separate Column
                        "Subtotal": p.subtotal,
                        "CGST": p.cgst,
                        "SGST": p.sgst,
                        "Discount": p.discount,
                        "Exchange Item": p.exchangeName || "None",
                        "Exchange Value": p.exchangeDiscount,
                        "Grand Total": p.grandTotal,
                        "Payment Status": p.paymentStatus,
                    });
                });
            });

            const worksheet = XLSX.utils.json_to_sheet(flattenedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed_Sales");
            XLSX.writeFile(workbook, `Suvarna_Detailed_Export_${format(new Date(), "ddMMyy")}.xlsx`);

            setToastMessage("Excel exported with separate item columns");
            setShowToast(true);
        } catch (err) {
            console.error("Excel Export Error:", err);
        }
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

            const gold = rgb(0.72, 0.52, 0.04);
            const grey = rgb(0.45, 0.45, 0.45);
            const black = rgb(0, 0, 0);

            const draw = (text: string, x: number, yOffset: number, size = 10, color = black) => {
                page.drawText(String(text || ""), { x, y: height - yOffset, size, font: customFont, color });
            };

            const drawRight = (text: string, rightX: number, yOffset: number, size = 10, color = black) => {
                const textWidth = customFont.widthOfTextAtSize(String(text || ""), size);
                page.drawText(String(text || ""), { x: rightX - textWidth, y: height - yOffset, size, font: customFont, color });
            };

            // Header info
            draw("SUVARNA JEWELLERS", 40, 175, 12, gold);
            draw(`Customer: ${purchase.customer}`, 350, 192, 11, black);
            draw(`Phone: ${purchase.phone}`, 350, 207, 9, grey);

            // Metadata Header
            const headY = 285;
            const col = { name: 40, purity: 180, gross: 250, net: 320, va: 380, price: 555 };
            draw("ITEM DETAILS", col.name, headY, 9, grey);
            draw("PURITY", col.purity, headY, 9, grey);
            draw("GROSS", col.gross, headY, 9, grey);
            draw("NET", col.net, headY, 9, grey);
            draw("VA%", col.va, headY, 9, grey);
            drawRight("PRICE", col.price, headY, 9, grey);

            // Rows
            let currentY = headY + 25;
            purchase.items.forEach((item: any) => {
                draw(item.productName, col.name, currentY, 10, black);
                draw(item.purity, col.purity, currentY, 10, black);
                draw(`${item.grossWt}g`, col.gross, currentY, 10, black);
                draw(`${item.netWt}g`, col.net, currentY, 10, black);
                draw(`${item.va}%`, col.va, currentY, 10, black);
                drawRight(`₹${item.itemCost.toLocaleString()}`, col.price, currentY, 10, black);

                currentY += 14;
                // Sub-details in separate "mini-row"
                draw(`SKU: ${item.sku || "N/A"} | HUID: ${item.huid || "N/A"}`, col.name, currentY, 8, grey);
                currentY += 22;
            });

            // Totals
            let totalY = currentY + 20;
            drawRight(`Subtotal: ₹${purchase.subtotal.toLocaleString()}`, col.price, totalY, 10);
            totalY += 18;
            drawRight(`GST: ₹${(purchase.cgst + purchase.sgst).toLocaleString()}`, col.price, totalY, 10);

            if (purchase.discount > 0) {
                totalY += 18;
                drawRight(`Discount: -₹${purchase.discount.toLocaleString()}`, col.price, totalY, 10, rgb(0.8, 0, 0));
            }

            totalY += 25;
            drawRight(`GRAND TOTAL: ₹${purchase.grandTotal.toLocaleString()}`, col.price, totalY, 15, gold);

            // Footer QR
            page.drawImage(qrImage, { x: (width - 40) / 2, y: 50, width: 40, height: 40 });

            const pdfBytes = await pdfDoc.save();
            const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
            if (mode === "download") {
                const link = document.createElement("a");
                link.href = pdfUrl;
                link.download = `Invoice_${purchase.id.slice(-6)}.pdf`;
                link.click();
            } else {
                window.open(pdfUrl)?.print();
            }
        } catch (error) {
            console.error("PDF Error:", error);
        }
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
                                <p className="text-sm text-muted-foreground tracking-widest uppercase">Suvarna Financials</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search customer name or phone..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 bg-secondary/20 border-primary/10 rounded-full focus:ring-primary"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <X className="w-3 h-3 text-muted-foreground hover:text-primary" />
                                        </button>
                                    )}
                                </div>
                                <Button variant="outline" size="icon" onClick={() => fetchReports(true)}>
                                    <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                                </Button>
                                <Button variant="gold-outline" onClick={exportToExcel} className="font-bold">
                                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
                                </Button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {/* FILTER CONTROLS */}
                        <LuxuryCard className="p-4 bg-white shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> Date Filtering</span>
                                <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit border border-primary/10">
                                    {(["day", "week", "month", "year"] as const).map((range) => (
                                        <Button key={range} variant={timeRange === range ? "gold" : "ghost"} size="sm" onClick={() => { setTimeRange(range); setDateRange(undefined); }} className="capitalize px-4 h-8 text-xs">{range}</Button>
                                    ))}

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={timeRange === "custom" ? "gold" : "ghost"} size="sm" className="px-4 h-8 text-xs">
                                                {timeRange === "custom" && dateRange?.from ? (
                                                    dateRange.to ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}` : `Date: ${format(dateRange.from, "MMM d")}`
                                                ) : "Custom Range"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                                initialFocus
                                                mode="range"
                                                defaultMonth={dateRange?.from || new Date()}
                                                selected={dateRange}
                                                onSelect={(range) => {
                                                    setDateRange(range);
                                                    if (range?.from) setTimeRange("custom");
                                                }}
                                                numberOfMonths={2}
                                                // ADD THESE TWO PROPS BELOW
                                                modifiers={{ today: new Date(0) }} // Moves the 'today' logic to a date in 1970
                                                modifiersClassNames={{ today: "after:hidden" }} // Force hides any 'today' indicators
                                            />
                                            {timeRange === "custom" && (
                                                <div className="p-2 border-t bg-muted/50 flex justify-center">
                                                    <Button variant="ghost" size="sm" className="text-[10px] h-6 uppercase font-bold text-red-500" onClick={() => { setDateRange(undefined); setTimeRange("month"); }}>
                                                        Clear Custom Filter
                                                    </Button>
                                                </div>
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Filter className="w-3 h-3" /> Payment Methods</span>
                                <div className="flex gap-4 items-center bg-secondary/30 px-4 py-2 rounded-lg border border-primary/5">
                                    {["cash", "upi", "card", "cheque"].map((type) => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                            <Checkbox
                                                checked={selectedPayments.includes(type)}
                                                onCheckedChange={() => togglePaymentFilter(type)}
                                            />
                                            <span className="text-xs font-bold uppercase text-gray-600 group-hover:text-primary transition-colors">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </LuxuryCard>

                        {/* SUMMARY CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <LuxuryCard className="p-4 border-l-4 border-green-500 bg-white shadow-sm">
                                <div className="flex items-center gap-2 text-green-600 mb-1">
                                    <Banknote className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-wider">CASH</span>
                                </div>
                                <div className="text-2xl font-serif font-bold text-gray-800">₹{financialSummary.totalCash.toLocaleString()}</div>
                            </LuxuryCard>

                            <LuxuryCard className="p-4 border-l-4 border-blue-500 bg-white shadow-sm">
                                <div className="flex items-center gap-2 text-blue-600 mb-1">
                                    <Smartphone className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-wider">UPI</span>
                                </div>
                                <div className="text-2xl font-serif font-bold text-gray-800">₹{financialSummary.totalUpi.toLocaleString()}</div>
                            </LuxuryCard>

                            <LuxuryCard className="p-4 border-l-4 border-purple-500 bg-white shadow-sm">
                                <div className="flex items-center gap-2 text-purple-600 mb-1">
                                    <CreditCard className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-wider">CARD</span>
                                </div>
                                <div className="text-2xl font-serif font-bold text-gray-800">₹{financialSummary.totalCard.toLocaleString()}</div>
                            </LuxuryCard>

                            <LuxuryCard className="p-4 border-l-4 border-orange-500 bg-white shadow-sm">
                                <div className="flex items-center gap-2 text-orange-600 mb-1">
                                    <ScrollText className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-wider">CHEQUE</span>
                                </div>
                                <div className="text-2xl font-serif font-bold text-gray-800">₹{financialSummary.totalCheque.toLocaleString()}</div>
                            </LuxuryCard>

                            <LuxuryCard className="p-4 bg-primary text-primary-foreground shadow-lg">
                                <div className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider">TOTAL REVENUE</div>
                                <div className="text-3xl font-serif font-bold italic">₹{financialSummary.grandTotal.toLocaleString()}</div>
                            </LuxuryCard>
                        </div>

                        {/* REGISTRY TABLE */}
                        <LuxuryCard className="p-0 overflow-hidden border-primary/20 shadow-xl bg-white">
                            <div className="p-6 border-b bg-primary/5 flex justify-between items-center">
                                <h3 className="font-serif font-bold text-xl flex items-center gap-2 text-primary"><Landmark className="w-5 h-5" /> Transaction Registry</h3>
                                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold tracking-[0.2em]">{filteredData.length} RECORDS</span>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-bold">Invoice</TableHead>
                                            <TableHead className="font-bold">Customer</TableHead>
                                            <TableHead className="font-bold">Settlement Method</TableHead>
                                            <TableHead className="text-right font-bold">Grand Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.map((row) => (
                                            <TableRow key={row.id} onClick={() => setSelectedCustomer(row)} className="group cursor-pointer hover:bg-primary/[0.03] transition-colors">
                                                <TableCell>
                                                    <div className="font-mono font-bold text-primary">#SVRN-{row.id.slice(-6).toUpperCase()}</div>
                                                    <div className="text-[10px] text-muted-foreground">{format(row.date, "PPP")}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-gray-800">{row.customer}</div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{row.phone}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.payments.cash > 0 && <span className="text-[8px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded border border-green-200 uppercase">Cash</span>}
                                                        {row.payments.upi > 0 && <span className="text-[8px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 uppercase">UPI</span>}
                                                        {row.payments.card > 0 && <span className="text-[8px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200 uppercase">Card</span>}
                                                        {row.payments.cheque > 0 && <span className="text-[8px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded border border-orange-200 uppercase">CHQ</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-lg text-amber-700 italic">₹{row.grandTotal.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No transactions found matching your selection.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </LuxuryCard>
                    </div>
                </main>
            </div>

            {/* TRANSACTION MODAL */}
            <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                    {selectedCustomer && (
                        <div className="flex flex-col bg-white">
                            <div className="bg-primary p-8 text-primary-foreground relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <BadgePercent className="w-10 h-10 mb-4 opacity-20" />
                                        <h2 className="text-3xl font-serif font-bold italic tracking-tight">{selectedCustomer.customer}</h2>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-xs flex items-center gap-1 opacity-80"><Phone className="w-3 h-3" /> {selectedCustomer.phone}</span>
                                            <span className="text-xs flex items-center gap-1 opacity-80"><Calendar className="w-3 h-3" /> {format(selectedCustomer.date, "PPP")}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs uppercase tracking-widest opacity-60">Invoice No</div>
                                        <div className="text-xl font-mono font-bold">#SVRN-{selectedCustomer.id.slice(-6).toUpperCase()}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-primary uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</span>
                                        <p className="text-xs text-muted-foreground">{selectedCustomer.address || "No address provided"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-primary uppercase flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
                                        <p className="text-xs text-muted-foreground">{selectedCustomer.email || "N/A"}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-1">Line Items</h4>
                                    {selectedCustomer.items.map((item: any, i: number) => (
                                        <div key={i} className="p-4 rounded-xl bg-secondary/20 border border-primary/5 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <p className="font-bold text-sm text-gray-800">{item.productName}</p>
                                                <p className="font-bold text-primary italic">₹{item.itemCost.toLocaleString()}</p>
                                            </div>
                                            <div className="grid grid-cols-4 text-[10px] uppercase text-muted-foreground font-medium">
                                                <span>Purity: {item.purity}</span>
                                                <span>Gross: {item.grossWt}g</span>
                                                <span>Net: {item.netWt}g</span>
                                                <span>VA: {item.va}%</span>
                                                <span>HUID: {item.huid || "N/A"}</span>
                                                <span>SKU: {item.sku || "N/A"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary border-b border-primary/10 pb-1">Settlement Details</h4>
                                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                                        {selectedCustomer.payments.cash > 0 && (
                                            <><span className="text-muted-foreground">Cash Settlement</span><span className="text-right font-bold">₹{selectedCustomer.payments.cash.toLocaleString()}</span></>
                                        )}
                                        {selectedCustomer.payments.upi > 0 && (
                                            <><span className="text-muted-foreground">UPI Digital</span><span className="text-right font-bold">₹{selectedCustomer.payments.upi.toLocaleString()}</span></>
                                        )}
                                        {selectedCustomer.payments.card > 0 && (
                                            <><span className="text-muted-foreground">Card Processing</span><span className="text-right font-bold">₹{selectedCustomer.payments.card.toLocaleString()}</span></>
                                        )}
                                        {selectedCustomer.payments.cheque > 0 && (
                                            <><span className="text-muted-foreground">Cheque / Draft</span><span className="text-right font-bold">₹{selectedCustomer.payments.cheque.toLocaleString()}</span></>
                                        )}
                                    </div>
                                    <div className="pt-3 border-t border-primary/20 flex justify-between items-end">
                                        <span className="text-xs font-bold uppercase text-primary tracking-widest">Total Amount</span>
                                        <span className="text-3xl font-serif font-bold text-primary italic">₹{selectedCustomer.grandTotal.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button variant="gold" className="flex-1 h-12 font-bold shadow-lg rounded-xl transition-all hover:scale-[1.02]" onClick={() => handleReceiptAction(selectedCustomer, "download")}>
                                        <Download className="w-4 h-4 mr-2" /> Save PDF
                                    </Button>
                                    <Button variant="outline" className="flex-1 h-12 font-bold border-primary/20 text-primary rounded-xl transition-all hover:bg-primary/5" onClick={() => handleReceiptAction(selectedCustomer, "print")}>
                                        <Printer className="w-4 h-4 mr-2" /> Print Receipt
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
