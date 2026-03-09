"use client";

import { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Calendar, User, Info, Phone, Receipt, Hash, Scale, IndianRupee, RefreshCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// ================= CACHE CONFIGURATION =================
// Declared outside to persist during the entire browser session until reload
let reportsCache: any[] | null = null;

const Reports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "quarter" | "half-year" | "year">("month");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ================= FETCH WITH CACHE LOGIC =================
  const fetchReports = async (forceRefresh = false) => {
    // 1. Check if we have valid cached data and aren't forcing a refresh
    if (!forceRefresh && reportsCache !== null) {
      setPurchases(reportsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Updated to your Vercel URL for consistency with other modules
      const res = await fetch("http://localhost:3000/api/reports/purchases", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      const formatted = (data.purchases || []).map((p: any) => ({
        ...p,
        date: new Date(p.date),
        grams: p.grams ? Number(p.grams) : 0
      }));

      // 2. Update state AND global memory cache
      setPurchases(formatted);
      reportsCache = formatted;
    } catch (error) {
      console.error("Reports fetch error:", error);
      setToastMessage("Failed to sync analytics");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // 🔹 USEMEMO: FILTERED DATA
  const filteredData = useMemo(() => {
    const now = new Date();
    return ALL_PURCHASES.filter((item) => {
      const itemDate = item.date;
      if (timeRange === "day") return itemDate.toDateString() === now.toDateString();
      if (timeRange === "week") return itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (timeRange === "month") return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      if (timeRange === "quarter") return itemDate >= new Date(new Date().setMonth(now.getMonth() - 3));
      if (timeRange === "half-year") return itemDate >= new Date(new Date().setMonth(now.getMonth() - 6));
      if (timeRange === "year") return itemDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [timeRange, ALL_PURCHASES]);

  // 🔹 USEMEMO: CHART DATA
  const chartData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const groups: Record<string, number> = {};
    
    sorted.forEach((curr) => {
      const label = curr.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      groups[label] = (groups[label] || 0) + curr.total;
    });

    return Object.keys(groups).map((key) => ({ 
      label: key, 
      sales: groups[key] 
    }));
  }, [filteredData]);

  const tableData = useMemo(() => {
    return [...filteredData].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredData]);

  // 🔹 EXPORTS
  const exportToExcel = () => {
    const excelData = filteredData.map((d) => ({
      "Transaction ID": d.id,
      Customer: d.customer,
      Product: d.product,
      Grams: d.grams,
      Category: d.category,
      Date: d.date.toLocaleDateString(),
      Total: d.total,
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `Suvarna_Analytics_${timeRange}.xlsx`);
    setToastMessage("Excel Export Successful!");
    setShowToast(true);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Suvarna Jewellery Report - ${timeRange.toUpperCase()}`, 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["ID", "Customer", "Product", "Grams", "Total", "Date"]],
      body: tableData.map((d) => [
        d.id.substring(0, 8),
        d.customer,
        d.product,
        `${d.grams}g`,
        `₹${d.total.toLocaleString()}`,
        d.date.toLocaleDateString(),
      ]),
      headStyles: { fillColor: [184, 134, 11] },
    });
    doc.save(`Suvarna_Report_${timeRange}.pdf`);
    setToastMessage("PDF Export Successful!");
    setShowToast(true);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden text-left">
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-serif font-bold tracking-tight">Sales Intelligence</h1>
                <p className="text-sm text-muted-foreground font-medium flex items-center gap-2 mt-1">
                   Suvarna Jewellers Global Analytics
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => fetchReports(true)}
                    className="h-11 w-11 rounded-xl border-gold/20 text-gold"
                >
                    <RefreshCcw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                </Button>
                <Button variant="gold-outline" className="rounded-xl h-11 px-6 border-gold/30 text-gold" onClick={exportToExcel}><Download className="w-4 h-4 mr-2" /> Excel</Button>
                <Button variant="gold" className="rounded-xl h-11 px-6 shadow-lg" onClick={exportToPDF}><FileText className="w-4 h-4 mr-2" /> PDF</Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-2 rounded-2xl border border-border/50 w-fit">
              <Calendar className="w-4 h-4 text-primary ml-2 mr-1" />
              {(["day", "week", "month", "quarter", "half-year", "year"] as const).map((range) => (
                <Button 
                  key={range} 
                  variant={timeRange === range ? "gold" : "ghost"} 
                  size="sm" 
                  className={cn("capitalize rounded-xl px-5 h-8 font-bold text-[10px] tracking-widest", timeRange === range ? "shadow-md" : "")}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>

            <GoldDivider />

            {/* PURCHASE REGISTRY TABLE */}
            <LuxuryCard className="p-0 border-gold/5 shadow-none overflow-hidden bg-white">
              <div className="flex justify-between items-center p-8 bg-slate-50/50 border-b border-gold/5">
                <h3 className="font-serif font-bold text-xl">Purchase Registry</h3>
                <div className="text-[10px] font-bold bg-primary/10 text-primary px-4 py-1.5 rounded-full uppercase tracking-widest border border-primary/20">
                  {filteredData.length} Records In Scope
                </div>
              </div>

              <div className="max-h-[450px] overflow-auto px-4 pb-4 custom-scrollbar">
                <Table>
                  <TableHeader className="bg-transparent sticky top-0 bg-white z-10">
                    <TableRow className="border-b-2 border-gold/10 hover:bg-transparent">
                      <TableHead className="uppercase text-[10px] font-black tracking-widest">Transaction</TableHead>
                      <TableHead className="uppercase text-[10px] font-black tracking-widest">Customer Profile</TableHead>
                      <TableHead className="uppercase text-[10px] font-black tracking-widest">Category</TableHead>
                      <TableHead className="text-right uppercase text-[10px] font-black tracking-widest">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                         Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i} className="animate-pulse">
                                <TableCell><div className="h-4 w-16 bg-slate-100 rounded" /></TableCell>
                                <TableCell><div className="h-4 w-32 bg-slate-100 rounded" /></TableCell>
                                <TableCell><div className="h-4 w-20 bg-slate-100 rounded" /></TableCell>
                                <TableCell><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></TableCell>
                            </TableRow>
                         ))
                    ) : tableData.map((row, idx) => (
                      <TableRow
                        key={`${row.id}-${idx}`}
                        onClick={() => setSelectedCustomer(row)}
                        className="cursor-pointer hover:bg-primary/[0.03] transition-all group border-gold/5"
                      >
                        <TableCell className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">
                          #{row.id.slice(-8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-sm text-slate-800">{row.customer}</div>
                          <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {row.phone}</div>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-bold uppercase border",
                            row.category === 'gold' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-700'
                          )}>
                            {row.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-serif font-black text-amber-700 text-base">
                          ₹{row.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </LuxuryCard>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
              <LuxuryCard title="Revenue Stream" className="p-8">
                <div className="h-72 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(212, 175, 55, 0.05)' }} 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #d4af37', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                      />
                      <Bar dataKey="sales" fill="#d4af37" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>
              
              <LuxuryCard title="Sales Velocity" className="p-8">
                <div className="h-72 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #d4af37' }} />
                      <Line 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#d4af37" 
                        strokeWidth={4} 
                        dot={{ fill: '#d4af37', r: 5, strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 8, strokeWidth: 0 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      {/* DETAIL MODAL */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-md border-gold/30 bg-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 text-amber-400 mb-2">
              <Receipt className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Procurement Record</span>
            </div>
            <DialogTitle className="font-serif text-3xl font-bold">Transaction Details</DialogTitle>
            <DialogDescription className="font-mono text-[10px] text-slate-400 truncate opacity-70">TXID: {selectedCustomer?.id}</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="p-8 space-y-8 text-left">
              <div className="bg-slate-50 p-6 rounded-2xl border border-gold/10 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</label>
                    <p className="font-serif font-black text-xl text-slate-900 mt-1 uppercase tracking-tight">{selectedCustomer.customer}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-bold"><Phone className="w-3.5 h-3.5 text-gold" /> {selectedCustomer.phone}</p>
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processed On</label>
                    <p className="text-xs font-bold text-slate-900 mt-1">{selectedCustomer.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{selectedCustomer.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase flex items-center gap-3 text-gold">
                  <div className="h-[1px] flex-1 bg-gold/10" /> Asset Valuation <div className="h-[1px] flex-1 bg-gold/10" />
                </h4>
                <div className="bg-white rounded-2xl border border-gold/10 overflow-hidden shadow-sm">
                  <div className="p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                        <Scale className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-base uppercase text-slate-900 leading-tight">{selectedCustomer.product}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{selectedCustomer.category} Collection</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-700 leading-tight">{selectedCustomer.grams}g</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Net Weight</p>
                    </div>
                  </div>
                  <div className="bg-amber-600 p-5 flex justify-between items-center">
                    <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.1em]">Settlement Amount</span>
                    <span className="font-serif font-black text-2xl text-white">₹{selectedCustomer.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full bg-slate-900 text-white hover:bg-black h-14 rounded-2xl font-black tracking-[0.2em] text-xs uppercase shadow-xl" onClick={() => setSelectedCustomer(null)}>
                  Secure Registry
                </Button>
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