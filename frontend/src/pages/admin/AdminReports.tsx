import { useState, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Calendar, TrendingUp, BarChart3, PieChart, User, Phone, Receipt, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// --- DUMMY DATA GENERATOR ---
const generateDummyPurchases = () => {
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
    const gst = Math.floor((subtotal - discount) * 0.03); // 3% GST for jewelry

    purchases.push({
      id: `TXN-${5000 + i}`,
      date: date,
      product: products[Math.floor(Math.random() * products.length)],
      subtotal: subtotal,
      discount: discount,
      gst: gst,
      total: subtotal - discount + gst,
      category: categories[Math.floor(Math.random() * categories.length)],
      customer: names[Math.floor(Math.random() * names.length)],
      email: `user${i}@example.com`,
      phone: `+91 98${Math.floor(Math.random() * 89999999 + 10000000)}`
    });
  }
  return purchases.sort((a, b) => b.date - a.date);
};

const ALL_PURCHASES = generateDummyPurchases();

const AdminReports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState("this month");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const filteredData = useMemo(() => {
    const now = new Date();
    return ALL_PURCHASES.filter((item) => {
      const itemDate = new Date(item.date);
      if (timeRange === "today") return itemDate.toDateString() === now.toDateString();
      if (timeRange === "this month") return itemDate.getMonth() === now.getMonth();
      if (timeRange === "3 months") return itemDate >= new Date(new Date().setMonth(now.getMonth() - 3));
      if (timeRange === "half month") return itemDate >= new Date(new Date().setDate(now.getDate() - 15));
      if (timeRange === "year") return itemDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [timeRange]);
  // --- AGGREGATION FOR CHARTS (Fixing Chronological Order) ---
  const chartData = useMemo(() => {
    // 1. Sort the filtered data oldest -> newest
    const sortedForChart = [...filteredData].sort((a, b) => a.date - b.date);

    // 2. Group the sorted data by date string
    const groups = sortedForChart.reduce((acc, curr) => {
      const label = curr.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acc[label] = (acc[label] || 0) + curr.total;
      return acc;
    }, {});

    // 3. Map to Recharts format (will now naturally be in date order)
    return Object.keys(groups).map(key => ({
      label: key,
      sales: groups[key]
    }));
  }, [filteredData]);

  // --- TABLE DATA (Keeps newest at the top for the list) ---
  const tableData = useMemo(() => {
    return [...filteredData].sort((a, b) => b.date - a.date);
  }, [filteredData]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Sales Report", 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [["ID", "Customer", "Product", "Total", "Date"]],
      body: filteredData.map(d => [d.id, d.customer, d.product, `Rs.${d.total}`, d.date.toLocaleDateString()]),
    });
    doc.save(`Report_${timeRange}.pdf`);
  };

  // --- EXPORT TO EXCEL LOGIC ---
  const exportToExcel = () => {
    try {
      // 1. Prepare the data for Excel (flattening or picking specific fields)
      const excelData = filteredData.map((item) => ({
        "Transaction ID": item.id,
        "Customer Name": item.customer,
        "Phone Number": item.phone,
        "Product": item.product,
        "Category": item.category,
        "Date": item.date.toLocaleDateString(),
        "Subtotal (₹)": item.subtotal,
        "Discount (₹)": item.discount,
        "GST (₹)": item.gst,
        "Total Amount (₹)": item.total,
      }));

      // 2. Create a worksheet from the JSON data
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 3. Create a new workbook and append the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");

      // 4. Generate the Excel file and trigger download
      XLSX.writeFile(workbook, `Store_Report_${timeRange}_${new Date().getTime()}.xlsx`);

      // 5. Show success feedback
      setToastMessage("Excel sheet exported successfully!");
      setShowToast(true);
    } catch (error) {
      console.error("Excel Export Error:", error);
      setToastMessage("Failed to export Excel sheet.");
      setShowToast(true);
    }
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-[#f8f9fa] overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* FIXED HEADER & FILTERS */}
          <div className="bg-white border-b border-border z-20 shadow-sm">
            <header className="px-8 py-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold">Store Intelligence</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Reports / Analytics</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel} className="border-gold text-gold hover:bg-gold/10">
                  <Download className="w-4 h-4 mr-2" /> Excel
                </Button>
                <Button size="sm" onClick={exportToPDF} className="bg-primary text-white">
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </Button>
              </div>
            </header>

            <div className="px-8 pb-4 flex items-center gap-4">
              <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
                {["today", "half month", "this month", "3 months", "year"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === range ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SCROLLABLE CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

            {/* 1. SCROLLABLE CUSTOMER SECTION */}
            <LuxuryCard className="overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg"><User className="w-5 h-5 text-primary" /></div>
                  <h3 className="font-serif font-bold text-xl">Customer Ledger</h3>
                </div>
                <span className="text-sm font-medium bg-muted px-3 py-1 rounded-full">{filteredData.length} records found</span>
              </div>

              <div className="relative border rounded-xl overflow-hidden bg-white">
                <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead className="min-w-[150px]">Customer</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/30 group"
                          onClick={() => setSelectedCustomer(row)}
                        >
                          <TableCell className="font-mono text-[10px] text-muted-foreground">{row.id}</TableCell>
                          <TableCell>
                            <div className="font-semibold group-hover:text-primary transition-colors">{row.customer}</div>
                            <div className="text-[11px] text-muted-foreground">{row.phone}</div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${row.category === 'Gold' ? 'border-yellow-200 bg-yellow-50 text-yellow-700' : 'border-slate-200 bg-slate-50'
                              }`}>
                              {row.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{row.date.toLocaleDateString()}</TableCell>
                          <TableCell className="text-right font-bold">₹{row.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Info className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </LuxuryCard>

            <GoldDivider />

            {/* 2. ANALYTICS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LuxuryCard>
                <div className="flex items-center gap-3 mb-6">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  <h3 className="font-serif font-bold text-xl">Daily Volume</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} tickLine={false} />
                      <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                      <Bar dataKey="sales" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>

              <LuxuryCard>
                <div className="flex items-center gap-3 mb-6">
                  <PieChart className="w-6 h-6 text-primary" />
                  <h3 className="font-serif font-bold text-xl">Inventory Split</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={[{ name: 'G', value: 40 }, { name: 'S', value: 30 }, { name: 'P', value: 30 }]} innerRadius={60} outerRadius={90} dataKey="value">
                        <Cell fill="#D4AF37" /><Cell fill="#C0C0C0" /><Cell fill="#E5E4E2" />
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </LuxuryCard>
            </div>
          </div>
        </main>

        {/* CUSTOMER DETAIL DIALOG */}
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="sm:max-w-[425px] border-gold">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl border-b pb-4">Invoice Detail</DialogTitle>
              <DialogDescription className="text-xs uppercase tracking-widest text-primary pt-2">
                TXN REF: {selectedCustomer?.id}
              </DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-6 pt-4">
                <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="p-3 bg-white rounded-full shadow-sm"><User className="w-5 h-5 text-primary" /></div>
                  <div>
                    <h4 className="font-bold text-lg">{selectedCustomer.customer}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" /> {selectedCustomer.phone}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-y py-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-medium">{selectedCustomer.product}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span>{selectedCustomer.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{selectedCustomer.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount (10%)</span>
                    <span>-₹{selectedCustomer.discount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>GST (3%)</span>
                    <span>+₹{selectedCustomer.gst.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-primary text-white rounded-xl">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    <span className="font-bold">Total Paid</span>
                  </div>
                  <span className="text-2xl font-serif font-bold">₹{selectedCustomer.total.toLocaleString()}</span>
                </div>

                <Button className="w-full variant-outline border-gold text-" onClick={() => setSelectedCustomer(null)}>
                  Close Details
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

export default AdminReports;