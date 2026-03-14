"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Download, User, Phone, Receipt, 
  RefreshCcw, Info, ShoppingBag, Percent, IndianRupee 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line 
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// Global cache to persist data across tab switches
let adminReportsCache: any[] | null = null;

const AdminReports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year">("month");
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ================= 1. FETCH & GROUP DATA CORRECTLY =================
  const fetchReports = async (forceRefresh = false) => {
    if (!forceRefresh && adminReportsCache !== null) {
      setPurchases(adminReportsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/reports/purchases", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      // Ensure we sum up all items belonging to the same Transaction ID (id)
      const grouped = (data.purchases || []).reduce((acc: any[], p: any) => {
        const existing = acc.find((x) => x.id === p.id);
        
        // Use individual item cost if provided, else fallback to row total (carefully)
        const itemPrice = Number(p.itemCost || p.cost || p.total); 

        if (existing) {
          existing.items.push({
            product: p.product,
            grams: Number(p.grams),
            cost: itemPrice
          });
          // Update the cumulative subtotal for this transaction
          existing.calculatedSubtotal += itemPrice;
        } else {
          acc.push({
            id: p.id,
            customer: p.customer,
            phone: p.phone,
            date: new Date(p.date),
            // Financials from database
            apiGst: Number(p.gstAmount || 0),
            apiDiscount: Number(p.discountAmount || 0),
            apiTotal: Number(p.finalAmount || p.total),
            calculatedSubtotal: itemPrice,
            items: [{
              product: p.product,
              grams: Number(p.grams),
              cost: itemPrice
            }]
          });
        }
        return acc;
      }, []);

      setPurchases(grouped);
      adminReportsCache = grouped;
    } catch (error) {
      console.error(error);
      setToastMessage("Failed to sync analytics");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // ================= 2. DYNAMIC CALCULATION ENGINE =================
  const invoiceTotals = useMemo(() => {
    if (!selectedPurchase) return { subtotal: 0, gst: 0, discount: 0, total: 0 };

    const subtotal = selectedPurchase.calculatedSubtotal;
    const gst = selectedPurchase.apiGst || 0;
    const discount = selectedPurchase.apiDiscount || 0;
    
    // The total is Subtotal + GST - Discount. 
    // If apiTotal is recorded, we use it as the anchor, else calculate.
    const total = selectedPurchase.apiTotal || (subtotal + gst - discount);

    return { subtotal, gst, discount, total };
  }, [selectedPurchase]);

  // ================= 3. FILTERING & CHARTS =================
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

  const chartData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const groups: Record<string, number> = {};
    sorted.forEach((curr) => {
      const label = curr.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      groups[label] = (groups[label] || 0) + curr.apiTotal;
    });
    return Object.keys(groups).map((key) => ({ label: key, sales: groups[key] }));
  }, [filteredData]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] overflow-hidden text-slate-900">
        <AdminSidebar />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* HEADER */}
          <header className="sticky top-0 z-20 bg-white border-b-2 border-gold/10 px-8 py-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-serif font-bold tracking-tight">Store Intelligence</h1>
                <p className="text-[10px] text-gold font-bold uppercase tracking-[0.3em]">Purchase Analytics & Records</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="icon" onClick={() => fetchReports(true)}>
                  <RefreshCcw className={cn("w-5 h-5 text-gold", isLoading && "animate-spin")} />
                </Button>
                <Button variant="gold" className="px-6 shadow-lg shadow-gold/20" onClick={() => {}}> 
                   <Download className="w-4 h-4 mr-2" /> Export
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {/* Range Toggle */}
            <div className="flex gap-2 bg-slate-100 p-1.5 w-fit rounded-2xl border border-gold/10">
              {["day", "week", "month", "year"].map((range) => (
                <Button key={range} variant={timeRange === range ? "gold" : "ghost"} size="sm" className="rounded-xl px-6" onClick={() => setTimeRange(range as any)}>
                  {range.toUpperCase()}
                </Button>
              ))}
            </div>

            {/* ANALYTICS CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LuxuryCard title="Revenue Distribution">
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="sales" fill="#d4af37" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>
              <LuxuryCard title="Growth Trajectory">
                <div className="h-64 mt-4">
                   <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="sales" stroke="#d4af37" strokeWidth={3} dot={{ r: 4, fill: '#d4af37' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>
            </div>

            {/* TABLE SECTION */}
            <LuxuryCard className="p-0 overflow-hidden border-gold/10 bg-white">
              <div className="px-8 py-5 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9]">
                <h2 className="text-lg font-serif font-bold italic text-slate-800 flex items-center gap-2">
                  <Receipt className="text-gold" size={20} /> Purchase Registry
                </h2>
                <Badge className="bg-slate-900 text-gold border border-gold/20 font-bold px-4 py-1">{filteredData.length} TXNS</Badge>
              </div>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="font-bold text-slate-400 text-[10px] uppercase">Ref ID</TableHead>
                      <TableHead className="font-bold text-slate-400 text-[10px] uppercase">Customer</TableHead>
                      <TableHead className="text-right font-bold text-slate-400 text-[10px] uppercase">Final Settlement</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((row) => (
                      <TableRow key={row.id} className="hover:bg-gold/5 transition-colors border-b-gold/5">
                        <TableCell className="font-mono text-[10px] text-slate-400 uppercase">#{row.id.slice(-8)}</TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-800">{row.customer}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{row.phone}</div>
                        </TableCell>
                        <TableCell className="text-right font-serif font-bold text-amber-700 text-lg italic">₹{row.apiTotal.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedPurchase(row)}>
                             <Info className="text-gold/40 hover:text-gold" size={18} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </LuxuryCard>
          </div>
        </main>
      </div>

      {/* FIXED INVOICE DETAILS DIALOG */}
      <Dialog open={!!selectedPurchase} onOpenChange={() => setSelectedPurchase(null)}>
        <DialogContent className="max-w-md border-gold/20 rounded-[2.5rem] p-8 bg-[#FFFEFA] shadow-2xl">
          <DialogHeader className="border-b-2 border-gold/5 pb-4 mb-6">
            <DialogTitle className="font-serif text-3xl italic text-slate-800 flex items-center gap-3">
              <ShoppingBag className="text-gold" size={28} /> Invoice Details
            </DialogTitle>
          </DialogHeader>

          {selectedPurchase && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="flex items-center gap-5 p-5 bg-gold/5 rounded-3xl border border-gold/10">
                <div className="h-14 w-14 rounded-full bg-gold flex items-center justify-center text-white font-serif text-2xl shadow-md border-2 border-white">
                  {selectedPurchase.customer.charAt(0)}
                </div>
                <div>
                  <h4 className="font-serif font-bold text-xl text-slate-800 leading-none">{selectedPurchase.customer}</h4>
                  <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">{selectedPurchase.phone}</p>
                </div>
              </div>

              {/* Dynamic Items List */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-2 px-1">Purchased Designs</p>
                {selectedPurchase.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gold/5 shadow-sm">
                    <div>
                      <p className="font-bold text-slate-800 uppercase text-xs tracking-tight">{item.product}</p>
                      <p className="text-[10px] text-gold font-bold uppercase mt-1 tracking-widest">{item.grams} Grams</p>
                    </div>
                    <p className="font-serif font-bold text-slate-900 italic">₹{item.cost.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* CALCULATED FINANCIAL BREAKDOWN */}
              <div className="space-y-3 border-t-2 border-gold/5 pt-5 mt-4">
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  <span>Subtotal Sum</span>
                  <span className="text-slate-900 font-serif font-bold">₹{invoiceTotals.subtotal.toLocaleString()}</span>
                </div>
                
                {invoiceTotals.discount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-emerald-600 italic px-1 flex items-center gap-1">
                    <span className="flex items-center gap-1"><Percent size={12} /> Savings Applied</span>
                    <span>-₹{invoiceTotals.discount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs font-bold text-slate-600 px-1">
                  <span>GST (Tax)</span>
                  <span className="text-slate-900 font-serif">+₹{invoiceTotals.gst.toLocaleString()}</span>
                </div>
              </div>

              {/* FINAL SETTLEMENT BOX */}
              <div className="flex justify-between items-center p-6 bg-[#FDFCF9] rounded-[2.2rem] border-2 border-gold/20 mt-6 shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gold"></div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold/10 rounded-lg"><Receipt className="text-gold" size={20} /></div>
                  <span className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">Total Paid</span>
                </div>
                <div className="text-right">
                   <span className="text-3xl font-serif font-bold text-amber-700 italic block">
                    ₹{invoiceTotals.total.toLocaleString()}
                  </span>
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

export default AdminReports