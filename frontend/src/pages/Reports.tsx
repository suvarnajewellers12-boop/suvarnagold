"use client";

import { useState, useMemo, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Calendar, Phone, Receipt, RefreshCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

let reportsCache: any[] | null = null;

const Reports = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "quarter" | "half-year" | "year">("month");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [ALL_PURCHASES, setPurchases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ================= FETCH REPORTS =================
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
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      // GROUP ITEMS INTO PURCHASE
      const grouped = (data.purchases || []).reduce((acc: any[], p: any) => {

        const existing = acc.find((x) => x.id === p.id);

        if (existing) {

          existing.items.push({
            product: p.product,
            grams: Number(p.grams),
            cost: Number(p.total)
          });

        } else {

          acc.push({
            id: p.id,
            customer: p.customer,
            phone: p.phone,
            date: new Date(p.date),
            total: Number(p.total),
            items: [
              {
                product: p.product,
                grams: Number(p.grams),
                cost: Number(p.total)
              }
            ]
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

  useEffect(() => {
    fetchReports();
  }, []);

  // ================= FILTER DATA =================
  const filteredData = useMemo(() => {

    const now = new Date();

    return ALL_PURCHASES.filter((item) => {

      const itemDate = item.date;

      if (timeRange === "day") return itemDate.toDateString() === now.toDateString();

      if (timeRange === "week")
        return itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      if (timeRange === "month")
        return itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear();

      if (timeRange === "quarter")
        return itemDate >= new Date(new Date().setMonth(now.getMonth() - 3));

      if (timeRange === "half-year")
        return itemDate >= new Date(new Date().setMonth(now.getMonth() - 6));

      if (timeRange === "year")
        return itemDate.getFullYear() === now.getFullYear();

      return true;

    });

  }, [timeRange, ALL_PURCHASES]);

  // ================= CHART DATA =================
  const chartData = useMemo(() => {

    const sorted = [...filteredData].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const groups: Record<string, number> = {};

    sorted.forEach((curr) => {

      const label = curr.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });

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

  // ================= EXPORT EXCEL =================
  const exportToExcel = () => {

    const excelData = filteredData.map((d) => ({
      "Transaction ID": d.id,
      Customer: d.customer,
      Phone: d.phone,
      Date: d.date.toLocaleDateString(),
      Total: d.total
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    XLSX.writeFile(workbook, `Suvarna_Report_${timeRange}.xlsx`);

    setToastMessage("Excel Export Successful!");
    setShowToast(true);

  };

  // ================= EXPORT PDF =================
  const exportToPDF = () => {

    const doc = new jsPDF();

    doc.text(`Suvarna Jewellery Report - ${timeRange.toUpperCase()}`, 14, 15);

    autoTable(doc, {
      startY: 25,
      head: [["ID", "Customer", "Total", "Date"]],
      body: tableData.map((d) => [
        d.id.slice(-8),
        d.customer,
        `₹${d.total}`,
        d.date.toLocaleDateString()
      ]),
      headStyles: { fillColor: [184, 134, 11] }
    });

    doc.save(`Suvarna_Report_${timeRange}.pdf`);

    setToastMessage("PDF Export Successful!");
    setShowToast(true);

  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">

        <DashboardSidebar />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* HEADER */}
          <header className="sticky top-0 z-20 bg-background border-b px-8 py-6">

            <div className="flex items-center justify-between">

              <div>
                <h1 className="text-3xl font-serif font-bold">
                  Sales Intelligence
                </h1>
                <p className="text-sm text-muted-foreground">
                  Suvarna Jewellery Analytics
                </p>
              </div>

              <div className="flex gap-3">

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchReports(true)}
                >
                  <RefreshCcw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                </Button>

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

          {/* CONTENT */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">

            <div className="flex gap-2">

              {(["day", "week", "month", "quarter", "half-year", "year"] as const)
                .map((range) => (

                  <Button
                    key={range}
                    variant={timeRange === range ? "gold" : "ghost"}
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>

                ))}

            </div>

            <GoldDivider />

            {/* TABLE */}
            <LuxuryCard className="p-0 overflow-hidden">

              <div className="p-6 border-b flex justify-between">

                <h3 className="font-serif font-bold text-xl">
                  Purchase Registry
                </h3>

                <div className="text-xs font-bold text-primary">
                  {filteredData.length} Records
                </div>

              </div>

              <div className="max-h-[450px] overflow-auto">

                <Table>

                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>

                    {tableData.map((row) => (

                      <TableRow
                        key={row.id}
                        onClick={() => setSelectedCustomer(row)}
                        className="cursor-pointer hover:bg-primary/5"
                      >

                        <TableCell className="font-mono">
                          #{row.id.slice(-8)}
                        </TableCell>

                        <TableCell>

                          <div className="font-bold">
                            {row.customer}
                          </div>

                          <div className="text-xs text-muted-foreground flex gap-1 items-center">
                            <Phone className="w-3 h-3" />
                            {row.phone}
                          </div>

                        </TableCell>

                        <TableCell className="text-right font-bold text-amber-700">
                          ₹{row.total.toLocaleString()}
                        </TableCell>

                      </TableRow>

                    ))}

                  </TableBody>

                </Table>

              </div>

            </LuxuryCard>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              <LuxuryCard title="Revenue Stream">

                <div className="h-72">

                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="sales" fill="#d4af37" />
                    </BarChart>
                  </ResponsiveContainer>

                </div>

              </LuxuryCard>

              <LuxuryCard title="Sales Velocity">

                <div className="h-72">

                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="sales" stroke="#d4af37" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>

                </div>

              </LuxuryCard>

            </div>

          </div>

        </main>

      </div>

      {/* DIALOG */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>

        <DialogContent className="max-w-md">

          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (

            <div className="space-y-6">

              <div>
                <h3 className="font-bold text-lg">
                  {selectedCustomer.customer}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedCustomer.phone}
                </p>
              </div>

              <div className="space-y-3">

                {selectedCustomer.items.map((item: any, i: number) => (

                  <div key={i} className="flex justify-between">

                    <div>
                      <p className="font-semibold">{item.product}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.grams} grams
                      </p>
                    </div>

                    <p className="font-bold text-amber-700">
                      ₹{item.cost.toLocaleString()}
                    </p>

                  </div>

                ))}

              </div>

              <div className="border-t pt-4 flex justify-between font-bold text-lg">

                <span>Total</span>
                <span className="text-amber-700">
                  ₹{selectedCustomer.total.toLocaleString()}
                </span>

              </div>

            </div>

          )}

        </DialogContent>

      </Dialog>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

    </SidebarProvider>
  );
};

export default Reports;