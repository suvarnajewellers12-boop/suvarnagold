"use client";

import { useEffect, useState, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessToast } from "@/components/SuccessToast";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, X, Phone, UserCircle, 
  ShieldCheck, LayoutGrid, Check, ChevronsUpDown,
  Calendar, IndianRupee, Layers, KeyRound, ChevronRight,
  TrendingUp, Lock, Loader2, Search, RefreshCcw,
  Scale, FileText, Table as TableIcon
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";

// Export Utils
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ================= CACHE CONFIGURATION =================
let customerRegistryCache: { 
  customers: any[] | null, 
  schemes: any[] | null 
} = { customers: null, schemes: null };

const CustomerSkeleton = () => (
  <div className="border border-gold/10 rounded-[22px] overflow-hidden bg-white animate-pulse p-6">
    <div className="flex items-center gap-4 mb-4">
      <div className="h-12 w-12 rounded-full bg-slate-100" />
      <div className="space-y-2">
        <div className="h-4 w-24 bg-slate-100 rounded" />
        <div className="h-3 w-16 bg-slate-50 rounded" />
      </div>
    </div>
    <div className="h-5 w-32 bg-slate-50 rounded-full" />
  </div>
);

const SuperadminCustomerManagement = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [customers, setCustomers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({ name: "", username: "", password: "", phone: "" });
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // ================= DATA FETCHING =================
  const fetchData = async (forceRefresh = false) => {
    if (!forceRefresh && customerRegistryCache.customers && customerRegistryCache.schemes) {
      setCustomers(customerRegistryCache.customers);
      setSchemes(customerRegistryCache.schemes);
      setIsInitialLoading(false);
      return;
    }
    setIsInitialLoading(true);
    try {
      const [resS, resC] = await Promise.all([
        fetch("https://suvarnagold-16e5.vercel.app/api/schemes/all", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("https://suvarnagold-16e5.vercel.app/api/customers/all", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const dataS = await resS.json();
      const dataC = await resC.json();
      if (resS.ok && resC.ok) {
        setSchemes(dataS.schemes || []);
        setCustomers(dataC.customers || []);
        customerRegistryCache.schemes = dataS.schemes;
        customerRegistryCache.customers = dataC.customers;
      }
    } catch (error) { console.error("Fetch error", error); } 
    finally { setIsInitialLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ================= EXPORT LOGIC =================
  // ================= HARDENED EXPORT LOGIC =================
  
  const exportToExcel = () => {
    const exportData = customers.flatMap(cust => 
      cust.schemes.map((cs: any) => ({
        "Scheme": cs.scheme.name,
        "Customer": cust.name,
        "Monthly": cs.scheme.monthlyAmount,
        "Bonus": cs.scheme.isWeightBased ? "N/A" : (cs.scheme.maturityMonths || 0),
        "Paid#": cs.installmentsPaid,
        "Left#": cs.installmentsLeft,
        "Total Paid": cs.totalPaid,
        "Remaining": cs.remainingAmount,
        "Gold": cs.accumulatedGrams.toFixed(3),
        "Status": cs.isCompleted ? "Completed" : "Active"
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer_Registry");
    XLSX.writeFile(wb, `Suvarna_Customer_Ledger_${new Date().toLocaleDateString()}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    
    doc.setFontSize(16);
    doc.text("Suvarna Gold - Full Customer Enrollment Registry", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableRows = customers.flatMap(cust => 
      cust.schemes.map((cs: any) => [
        cs.scheme.name,
        cust.name,
        `Rs. ${cs.scheme.monthlyAmount}`,
        cs.scheme.isWeightBased ? "-" : `${cs.scheme.maturityMonths} Mo`,
        cs.installmentsPaid,
        cs.installmentsLeft,
        `Rs. ${cs.totalPaid}`,
        `Rs. ${cs.remainingAmount}`,
        `${cs.accumulatedGrams.toFixed(3)}g`,
        cs.isCompleted ? "COMPLETED" : "ACTIVE"
      ])
    );

    autoTable(doc, {
      startY: 28,
      head: [[
        'Scheme', 'Customer', 'Monthly', 'Bonus', 'Paid#', 'Left#', 'Total Paid', 'Remaining', 'Gold', 'Status'
      ]],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { 
        fillColor: [184, 134, 11], 
        textColor: [255, 255, 255],
        fontStyle: 'bold' 
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.save(`Suvarna_Customer_Registry_${new Date().toLocaleDateString()}.pdf`);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const handleCreateCustomer = async () => {
    if (!form.name || !form.username || !form.password || !form.phone || !selectedSchemeId) {
      setToastMessage("All fields required");
      setShowToast(true);
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, schemeIds: [selectedSchemeId] }),
      });
      if (res.ok) {
        setToastMessage("Authorized & Registered 🎉");
        setShowToast(true);
        setForm({ name: "", username: "", password: "", phone: "" });
        setSelectedSchemeId(null);
        setShowForm(false);
        fetchData(true);
      }
    } finally { setIsCreating(false); }
  };

  const handleSaveNewPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setToastMessage("Min. 4 characters required");
      setShowToast(true);
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/customers/change-password/${selectedCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setToastMessage("Credentials updated");
        setShowToast(true);
        setIsUpdatingPassword(false);
        setNewPassword("");
      }
    } finally { setIsSavingPassword(false); }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#fdfdfc] dark:bg-[#0a0a0a] overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          <header className="bg-transparent px-8 py-6 flex justify-between items-center shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60">Superadmin Access</span>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">Customer Registry</h1>
            </div>

            <div className="flex gap-2">
               <div className="relative w-48 hidden lg:block mr-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input placeholder="Search..." className="h-10 pl-9 rounded-full bg-slate-100/50 border-none text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Button onClick={exportToPDF} variant="outline" size="sm" className="rounded-full border-red-100 text-red-600 gap-2"><FileText size={14}/> PDF</Button>
              <Button onClick={exportToExcel} variant="outline" size="sm" className="rounded-full border-emerald-100 text-emerald-600 gap-2"><TableIcon size={14}/> EXCEL</Button>
              <Button onClick={() => fetchData(true)} variant="outline" size="icon" className="rounded-full h-10 w-10 border-gold/10 text-gold"><RefreshCcw size={16} className={isInitialLoading ? "animate-spin" : ""} /></Button>
              <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "gold"} className="rounded-full font-bold uppercase text-[10px] h-10 px-6">
                {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Close" : "New User"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 pb-6 gap-6">
            {/* ASIDE FORM PANEL */}
            <aside className={`h-full transition-all duration-500 shrink-0 z-20 ${showForm ? "w-[380px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}>
              <div className="h-[calc(100vh-140px)] bg-white border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col p-8 border-b-4 border-b-gold/20">
                <div className="flex items-center gap-3 mb-8">
                  <UserCircle className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-serif font-bold italic">Register Member</h2>
                </div>
                <div className="space-y-4 flex-1">
                  <Input placeholder="Full Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-11 rounded-xl bg-slate-50/50" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Username" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} className="h-11 rounded-xl bg-slate-50/50" />
                    <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="h-11 rounded-xl bg-slate-50/50" />
                  </div>
                  <Input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="h-11 rounded-xl bg-slate-50/50" />
                  
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-gold ml-1">Portfolio Assignment</label>
                    <Popover open={openDropdown} onOpenChange={setOpenDropdown}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between rounded-xl border-gold/10 h-11 text-muted-foreground">
                          {selectedSchemeId ? schemes.find(s => s.id === selectedSchemeId)?.name : "Choose Portfolio"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 text-gold" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[315px] p-0 rounded-2xl z-[100]">
                        <Command>
                          <CommandInput placeholder="Search..." />
                          <CommandList>
                            <CommandGroup>
                              {schemes.map((scheme) => (
                                <CommandItem key={scheme.id} onSelect={() => { setSelectedSchemeId(scheme.id); setOpenDropdown(false); }} className="p-3 cursor-pointer">
                                  <span>{scheme.name}</span> {selectedSchemeId === scheme.id && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button variant="gold" className="w-full h-14 rounded-2xl font-bold mt-6 shadow-lg shadow-gold/20" onClick={handleCreateCustomer} disabled={isCreating}>
                  {isCreating ? <Loader2 className="animate-spin mr-2" /> : "Authorize Member"}
                </Button>
              </div>
            </aside>

            {/* MAIN CONTENT */}
            <section className="flex-1 bg-white border border-gold/10 rounded-[2.5rem] overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className={`grid gap-6 ${showForm ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                  {isInitialLoading ? Array.from({ length: 8 }).map((_, i) => <CustomerSkeleton key={i} />) : (
                    filteredCustomers.map((customer) => (
                      <div key={customer.id} onClick={() => setSelectedCustomer(customer)} className="group cursor-pointer">
                        <LuxuryCard className="p-6 rounded-[22px] bg-white border-gold/5 border hover:shadow-xl transition-all">
                          <div className="flex items-center gap-4 mb-5">
                            <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center text-gold font-serif text-xl font-bold">{customer.name.charAt(0)}</div>
                            <div className="overflow-hidden">
                              <h3 className="font-serif font-bold text-lg group-hover:text-gold transition-colors truncate">{customer.name}</h3>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">@{customer.username}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-auto">
                            {customer.schemes?.map((cs: any) => (
                              <Badge key={cs.id} className="bg-gold/5 text-gold text-[8px] font-bold border-none uppercase">{cs.scheme.name}</Badge>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t flex justify-between items-center text-muted-foreground">
                            <span className="text-[10px] font-bold"><Phone size={10} className="inline mr-1"/> {customer.phone}</span>
                            <ChevronRight size={14} className="text-gold" />
                          </div>
                        </LuxuryCard>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* MEMBER OVERRIDE DIALOG */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => { setSelectedCustomer(null); setIsUpdatingPassword(false); }}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] border-gold/20 p-0 overflow-hidden shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader className="p-8 bg-slate-50/50 border-b">
            <div className="flex justify-between items-center w-full pr-8">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center text-gold font-serif text-3xl font-bold">{selectedCustomer?.name.charAt(0)}</div>
                <div className="text-left">
                  <DialogTitle className="text-3xl font-serif font-bold text-slate-900">{selectedCustomer?.name}</DialogTitle>
                  <div className="flex items-center gap-3 mt-1 font-bold">
                    <Badge className="bg-gold/5 text-gold text-[10px]">@{selectedCustomer?.username}</Badge>
                    <span className="text-xs text-muted-foreground"><Phone size={12} className="inline mr-1 text-gold" /> {selectedCustomer?.phone}</span>
                  </div>
                </div>
              </div>
              <Button onClick={() => setIsUpdatingPassword(!isUpdatingPassword)} variant="outline" className="rounded-full border-gold/20 text-gold text-[10px] h-9 gap-2">
                {isUpdatingPassword ? <X size={14} /> : <KeyRound size={14} />} Reset PWD
              </Button>
            </div>
          </DialogHeader>

          {isUpdatingPassword && (
            <div className="bg-gold/[0.03] p-8 border-b flex gap-4">
              <Input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 rounded-xl" />
              <Button variant="gold" onClick={handleSaveNewPassword} disabled={isSavingPassword} className="h-11 px-8 font-bold text-[10px]">UPDATE</Button>
            </div>
          )}

          <div className="p-8 max-h-[55vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedCustomer?.schemes.map((cs: any) => (
                <div key={cs.id} className="border border-gold/10 rounded-3xl p-6 bg-[#fafaf9] text-left">
                  <div className="flex justify-between mb-5">
                    <h5 className="font-serif font-bold text-lg">{cs.scheme.name}</h5>
                    <Badge className={cs.isCompleted ? "bg-emerald-500 rounded-full" : "bg-gold rounded-full"}>{cs.isCompleted ? "DONE" : "ACTIVE"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4 font-bold text-[11px] text-slate-500">
                    <div className="flex items-center gap-2"><Calendar size={13} className="text-gold/60"/> {cs.scheme.durationMonths} Mo.</div>
                    <div className="flex items-center gap-2"><IndianRupee size={13} className="text-gold/60"/> ₹{cs.scheme.monthlyAmount}</div>
                    {cs.scheme.isWeightBased ? (
                      <div className="flex items-center gap-2 text-amber-600 col-span-2"><Scale size={13}/> Accumulated: {cs.accumulatedGrams.toFixed(3)} g</div>
                    ) : (
                      <div className="flex items-center gap-2 text-gold col-span-2"><TrendingUp size={13}/> Maturity: {cs.scheme.maturityMonths} Mo. Bonus</div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-gold/10">
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Authorized Balance Remaining</p>
                    <p className="font-serif font-bold text-gold text-xl">₹{cs.remainingAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={() => setSelectedCustomer(null)} className="rounded-full px-10 font-black text-[10px] border-gold/20 text-gold h-11">DISMISS</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default SuperadminCustomerManagement;