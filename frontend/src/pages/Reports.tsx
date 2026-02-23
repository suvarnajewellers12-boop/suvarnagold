import { useState, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar"; // SuperAdmin Sidebar
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Calendar, TrendingUp, BarChart3, PieChart, User, Info, Phone, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// --- DUMMY DATA GENERATOR (SuperAdmin Context) ---
const generateSuperAdminPurchases = () => {
  const categories = ["Gold", "Silver", "Platinum"];
  const names = ["Aravind Sharma", "Priya Patel", "Rahul Verma", "Sneha Reddy", "Vikram Singh", "Ananya Iyer", "Karan Malhotra", "Meera Joshi"];
  const products = ["Traditional Necklace", "Engagement Ring", "Diamond Studs", "Gold Bangle", "Silver Anklet", "Platinum Band"];
  const purchases = [];
  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const date = new Date();
    date.setDate(now.getDate() - Math.floor(Math.random() * 60));
    const subtotal = Math.floor(Math.random() * 80000) + 10000;
    const discount = Math.floor(subtotal * 0.1);
    const gst = Math.floor((subtotal - discount) * 0.03);

    purchases.push({
      id: `TXN-${7000 + i}`,
      date: date,
      product: products[Math.floor(Math.random() * products.length)],
      subtotal: subtotal,
      discount: discount,
      gst: gst,
      total: subtotal - discount + gst,
      category: categories[Math.floor(Math.random() * categories.length)],
      customer: names[Math.floor(Math.random() * names.length)],
      phone: `+91 98${Math.floor(Math.random() * 89999999 + 10000000)}`
    });
  }
  return purchases;
};

const ALL_PURCHASES = generateSuperAdminPurchases();

const Reports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "quarter" | "half-year" | "year">("month");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // 1. DYNAMIC FILTERING
  const filteredData = useMemo(() => {
    const now = new Date();
    return ALL_PURCHASES.filter((item) => {
      const itemDate = new Date(item.date);
      if (timeRange === "day") return itemDate.toDateString() === now.toDateString();
      if (timeRange === "week") return itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (timeRange === "month") return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      if (timeRange === "quarter") return itemDate >= new Date(now.setMonth(now.getMonth() - 3));
      if (timeRange === "half-year") return itemDate >= new Date(now.setMonth(now.getMonth() - 6));
      if (timeRange === "year") return itemDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [timeRange]);

  // 2. CHRONOLOGICAL CHART DATA
  const chartData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const groups = sorted.reduce((acc: any, curr) => {
      const label = curr.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acc[label] = (acc[label] || 0) + curr.total;
      return acc;
    }, {});
    return Object.keys(groups).map(key => ({ label: key, sales: groups[key] }));
  }, [filteredData]);

  const tableData = useMemo(() => {
    return [...filteredData].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredData]);

  // --- EXPORT FUNCTIONS ---
  const exportToExcel = () => {
    const excelData = filteredData.map(d => ({
      "Transaction ID": d.id,
      "Customer": d.customer,
      "Product": d.product,
      "Category": d.category,
      "Date": d.date.toLocaleDateString(),
      "Total Amount": d.total
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SuperAdmin_Report");
    XLSX.writeFile(workbook, `SuperAdmin_Report_${timeRange}.xlsx`);
    setToastMessage("Excel Export Successful!");
    setShowToast(true);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`SuperAdmin Intelligence Report - ${timeRange.toUpperCase()}`, 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["ID", "Customer", "Product", "Total", "Date"]],
      body: tableData.map(d => [d.id, d.customer, d.product, `Rs.${d.total.toLocaleString()}`, d.date.toLocaleDateString()]),
      headStyles: { fillColor: [184, 134, 11] }
    });
    doc.save(`SuperAdmin_Report_${timeRange}.pdf`);
    setToastMessage("PDF Export Successful!");
    setShowToast(true);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <DashboardSidebar />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* STICKY HEADER */}
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground tracking-tight">SuperAdmin Intelligence</h1>
                <p className="text-sm text-muted-foreground">High-level oversight and global performance metrics</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="gold-outline" onClick={exportToExcel}>
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button variant="gold" onClick={exportToPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </header>

          {/* SCROLLABLE AREA */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-muted/20 p-3 rounded-xl border border-border/50">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-2">Timeframe:</span>
              {(["day", "week", "month", "quarter", "half-year", "year"] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "gold" : "ghost"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className={`capitalize text-xs font-bold ${timeRange === range ? "shadow-md" : ""}`}
                >
                  {range.replace("-", " ")}
                </Button>
              ))}
            </div>

            <GoldDivider />

            {/* CUSTOMER LEDGER (SuperAdmin View) */}
            <LuxuryCard>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <User className="text-primary w-5 h-5" />
                  <h3 className="font-serif font-bold text-xl tracking-tight">Purchase Registry</h3>
                </div>
                <div className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full uppercase">
                   {filteredData.length} Entries
                </div>
              </div>
              <div className="border rounded-2xl overflow-hidden bg-card/50">
                <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow className="border-b border-border/50">
                        <TableHead className="font-bold text-xs">TXN ID</TableHead>
                        <TableHead className="font-bold text-xs">Customer</TableHead>
                        <TableHead className="font-bold text-xs">Category</TableHead>
                        <TableHead className="font-bold text-xs text-right">Revenue</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.map((row) => (
                        <TableRow 
                          key={row.id} 
                          className="cursor-pointer hover:bg-primary/5 group border-b border-border/30 last:border-0"
                          onClick={() => setSelectedCustomer(row)}
                        >
                          <TableCell className="font-mono text-[10px] text-muted-foreground">{row.id}</TableCell>
                          <TableCell>
                            <div className="font-bold text-sm group-hover:text-primary transition-colors">{row.customer}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">{row.phone}</div>
                          </TableCell>
                          <TableCell>
                            <span className="text-[9px] px-2 py-0.5 rounded-md border border-primary/20 font-black uppercase tracking-widest bg-primary/5">
                              {row.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-black text-foreground">₹{row.total.toLocaleString()}</TableCell>
                          <TableCell><Info className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-opacity" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </LuxuryCard>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
              <LuxuryCard>
                <div className="flex items-center gap-3 mb-6">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  <h3 className="font-serif font-bold text-xl">Revenue Flow</h3>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickFormatter={(v) => `₹${v/1000}k`} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                        formatter={(v: any) => [`₹${v.toLocaleString()}`, "Revenue"]} 
                      />
                      <Bar dataKey="sales" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} barSize={35} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>

              <LuxuryCard>
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <h3 className="font-serif font-bold text-xl">Operational Trend</h3>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickFormatter={(v) => `₹${v/1000}k`} tickLine={false} axisLine={false} />
                      <Tooltip 
                         contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                      />
                      <Line type="monotone" dataKey="sales" stroke="hsl(38, 92%, 50%)" strokeWidth={3} dot={{ fill: "hsl(38, 92%, 50%)", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>
            </div>
          </div>
        </main>

        {/* CUSTOMER DETAIL MODAL */}
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="sm:max-w-[425px] border-gold bg-card backdrop-blur-xl">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="font-serif text-2xl tracking-tight">SuperAdmin View: Ledger Entry</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-black tracking-[0.2em] text-primary pt-1">
                TRANSACTION REF: {selectedCustomer?.id}
              </DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-6 pt-6">
                <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <div className="p-3 bg-card rounded-full shadow-sm ring-1 ring-primary/20"><User className="w-5 h-5 text-primary" /></div>
                  <div>
                    <h4 className="font-black text-foreground">{selectedCustomer.customer}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {selectedCustomer.phone}</p>
                  </div>
                </div>

                <div className="space-y-3 px-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground font-medium">Product Group</span><span className="font-bold">{selectedCustomer.product}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground font-medium">Subtotal</span><span className="font-bold">₹{selectedCustomer.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm text-red-500 font-medium"><span>Global Discount</span><span>-₹{selectedCustomer.discount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm text-green-600 font-medium"><span>Tax (GST)</span><span>+₹{selectedCustomer.gst.toLocaleString()}</span></div>
                </div>

                <div className="flex justify-between items-center p-5 bg-primary text-white rounded-2xl shadow-lg ring-4 ring-primary/10">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-6 h-6" />
                    <span className="font-black uppercase tracking-wider text-[10px]">Net Settlement</span>
                  </div>
                  <span className="text-3xl font-serif font-black">₹{selectedCustomer.total.toLocaleString()}</span>
                </div>
                
                <Button className="w-full h-12 bg-muted text-foreground hover:bg-muted/80 rounded-xl font-bold transition-all" onClick={() => setSelectedCustomer(null)}>
                  Dismiss Entry
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default Reports;