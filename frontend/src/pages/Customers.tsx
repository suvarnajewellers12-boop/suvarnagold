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
  Scale, FileText, Table as TableIcon, CreditCard, UserPlus
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
  const [rates, setRates] = useState({ gold24: 0, gold22: 0, gold18: 0, silver: 0 });
  const cleanPrice = (price: string) => {
    return Number(price.replace(/[₹,]/g, ""));
  };
  const fetchLiveRates = async () => {
    try {
      // setLoading(true);
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
      const data = await res.json();
      console.log("API DATA:", data);
      setRates({
        gold24: cleanPrice(data.gold24),
        gold22: cleanPrice(data.gold22),
        gold18: cleanPrice(data.gold18),
        silver: cleanPrice(data.silver),
      });
    } catch (error) {
      console.error("Failed to fetch rates", error);
    } finally {
      // setLoading(false);
    }
  };

  // States for Assigning & Payment
  const [isAssigning, setIsAssigning] = useState(false);
  const [assigningSchemeId, setAssigningSchemeId] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);

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
        fetch("https://suvarnagold-16e5.vercel.app/api/customers/all", { headers: { Authorization: `Bearer ${token}` } }),
        fetchLiveRates()
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

  // ================= EXPORT LOGIC (Indivdual Statement) =================
  const generateCustomerReport = (customer: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Statement: ${customer.name}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Phone: ${customer.phone} | Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    const body = customer.schemes.map((cs: any) => [
      cs.scheme.name,
      cs.installmentsPaid,
      `Rs. ${cs.totalPaid.toLocaleString()}`,
      `${cs.accumulatedGrams.toFixed(3)}g`,
      cs.isCompleted ? "COMPLETED" : "ACTIVE"
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Scheme Name', 'Paid Months', 'Total Cash', 'Weight', 'Status']],
      body: body,
      headStyles: { fillColor: [184, 134, 11] }
    });

    doc.save(`${customer.name}_Suvarna_Report.pdf`);
  };

  // ================= MANUAL PAYMENT HANDLER =================
  const handleManualPayment = async (customerSchemeId: string) => {
    setIsProcessingPayment(customerSchemeId);
    try {
      // Logic: Hit the existing payment collection API
      
      const res = await fetch("http://localhost:3000/api/schemes/payoffline", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerSchemeId, goldRate:rates.gold22 }),
      });
      if (res.ok) {
        setToastMessage("Installment Collected Offline ✅");
        setShowToast(true);
        const customerToUpdate = await fetch(`http://localhost:3000/api/customers/${selectedCustomer.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const updatedCust = await customerToUpdate.json();
        setSelectedCustomer(updatedCust.customer);
        fetchData(true);
      }
    } finally { setIsProcessingPayment(null); }
  };

  // ================= ASSIGN NEW SCHEME HANDLER =================
  const handleAssignNewScheme = async () => {
    if (!assigningSchemeId) return;
    setIsCreating(true);
    try {
      const res = await fetch("http://localhost:3000/api/schemes/assign-scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerId: selectedCustomer.id, schemeId: assigningSchemeId }),
      });
      if (res.ok) {
        setToastMessage("New Portfolio Linked Successfully!");
        setShowToast(true);
        setIsAssigning(false);
        fetchData(true);
        setSelectedCustomer(null); // Reset to refresh list
      }
    } finally { setIsCreating(false); }
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#fdfdfc] dark:bg-[#0a0a0a] overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          <header className="bg-transparent px-8 py-6 flex justify-between items-center shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60">Superadmin Control</span>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">Member Directory</h1>
            </div>

            <div className="flex gap-2">
              <div className="relative w-48 hidden lg:block mr-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input placeholder="Search..." className="h-10 pl-9 rounded-full bg-slate-100/50 border-none text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Button onClick={() => fetchData(true)} variant="outline" size="icon" className="rounded-full h-10 w-10 border-gold/10 text-gold"><RefreshCcw size={16} className={isInitialLoading ? "animate-spin" : ""} /></Button>
              <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "gold"} className="rounded-full font-bold uppercase text-[10px] h-10 px-6 gap-2">
                {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Close" : "Register User"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 pb-6 gap-6">
            {/* ASIDE REGISTRATION FORM */}
            <aside className={`h-full transition-all duration-500 shrink-0 z-20 ${showForm ? "w-[380px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}>
              <div className="h-[calc(100vh-140px)] bg-white border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col p-8 border-b-4 border-b-gold/20">
                <div className="flex items-center gap-3 mb-8">
                  <UserCircle className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-serif font-bold">Member Entry</h2>
                </div>
                <div className="space-y-4 flex-1">
                  <Input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl bg-slate-50/50" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-11 rounded-xl bg-slate-50/50" />
                    <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11 rounded-xl bg-slate-50/50" />
                  </div>
                  <Input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl bg-slate-50/50" />

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-gold ml-1">Initial Scheme</label>
                    <Popover open={openDropdown} onOpenChange={setOpenDropdown}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between rounded-xl border-gold/10 h-11 text-muted-foreground font-medium">
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
                <Button variant="gold" className="w-full h-14 rounded-2xl font-bold mt-6 shadow-lg" onClick={handleCreateCustomer} disabled={isCreating}>
                  {isCreating ? <Loader2 className="animate-spin mr-2" /> : "Authorize Registration"}
                </Button>
              </div>
            </aside>

            {/* MAIN GRID */}
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
                              <h3 className="font-serif font-bold text-lg truncate group-hover:text-gold transition-colors">{customer.name}</h3>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">@{customer.username}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-auto">
                            {customer.schemes?.map((cs: any) => (
                              <Badge key={cs.id} className="bg-gold/5 text-gold text-[8px] font-bold border-none uppercase tracking-tighter">{cs.scheme.name}</Badge>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t flex justify-between items-center text-muted-foreground">
                            <span className="text-[10px] font-bold"><Phone size={10} className="inline mr-1" /> {customer.phone}</span>
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
      <Dialog open={!!selectedCustomer} onOpenChange={() => { setSelectedCustomer(null); setIsAssigning(false); setIsUpdatingPassword(false); }}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] border-gold/20 p-0 overflow-hidden shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader className="p-8 bg-slate-50/50 border-b">
            <div className="flex justify-between items-center w-full pr-8">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center text-gold font-serif text-3xl font-bold">{selectedCustomer?.name.charAt(0)}</div>
                <div className="text-left">
                  <DialogTitle className="text-3xl font-serif font-bold text-slate-900">{selectedCustomer?.name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1 font-bold">
                    <Badge className="bg-gold/5 text-gold text-[10px]">@{selectedCustomer?.username}</Badge>
                    <Button variant="ghost" onClick={() => generateCustomerReport(selectedCustomer)} className="h-7 text-[9px] bg-blue-50 text-blue-600 rounded-full font-bold px-3 gap-1">
                      <FileText size={12} /> DOWNLOAD REPORT
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsAssigning(!isAssigning)} variant="outline" className="rounded-full border-gold/20 text-gold text-[10px] h-9 gap-2 font-bold uppercase">
                  {isAssigning ? <X size={14} /> : <UserPlus size={14} />} {isAssigning ? "Cancel" : "Assign Scheme"}
                </Button>
                <Button onClick={() => setIsUpdatingPassword(!isUpdatingPassword)} variant="outline" className="rounded-full border-gold/20 text-gold text-[10px] h-9 gap-2 font-bold uppercase">
                  Reset PWD
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* ASSIGNMENT PANEL */}
          {isAssigning && (
            <div className="bg-emerald-50/50 border-b border-emerald-100 p-8 flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold uppercase text-emerald-700 ml-1">New Portfolio Assignment</label>
                <select onChange={(e) => setAssigningSchemeId(e.target.value)} className="w-full h-11 rounded-xl bg-white border border-emerald-200 px-3 text-sm font-medium">
                  <option value="">Select Scheme to Link</option>
                  {schemes.map(s => <option key={s.id} value={s.id}>{s.name} (₹{s.monthlyAmount}/mo)</option>)}
                </select>
              </div>
              <Button onClick={handleAssignNewScheme} disabled={isCreating} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 uppercase text-[10px] tracking-widest">
                {isCreating ? <Loader2 className="animate-spin" /> : "Confirm Link"}
              </Button>
            </div>
          )}

          {isUpdatingPassword && (
            <div className="bg-gold/[0.03] p-8 border-b flex gap-4">
              <Input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 rounded-xl" />
              <Button variant="gold" onClick={handleSaveNewPassword} disabled={isSavingPassword} className="h-11 px-8 font-bold text-[10px] uppercase">UPDATE</Button>
            </div>
          )}

          <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedCustomer?.schemes.map((cs: any) => (
                <div key={cs.id} className="border border-gold/10 rounded-3xl p-6 bg-[#fafaf9] flex flex-col justify-between hover:bg-white transition-all shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h5 className="font-serif font-bold text-lg">{cs.scheme.name}</h5>
                      <Badge className={cs.isCompleted ? "bg-emerald-500 rounded-full" : "bg-gold rounded-full"}>{cs.isCompleted ? "DONE" : "ACTIVE"}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Installments</p>
                        <p className="text-sm font-bold">{cs.installmentsPaid} <span className="text-muted-foreground font-medium">/ {cs.scheme.durationMonths} Mo.</span></p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Weight Saved</p>
                        <p className="text-sm font-bold text-amber-600 flex items-center gap-1"><Scale size={12} /> {cs.accumulatedGrams.toFixed(3)}g</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gold/10 flex justify-between items-center mt-4">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Balance Rem.</p>
                      <p className="font-bold text-gold text-lg">₹{cs.remainingAmount.toLocaleString()}</p>
                    </div>

                    {!cs.isCompleted && (
                      <Button
                        size="sm"
                        onClick={() => handleManualPayment(cs.id)}
                        disabled={isProcessingPayment === cs.id}
                        className="rounded-full h-11 px-5 bg-slate-900 text-white hover:bg-black font-bold text-[10px] gap-2 shadow-lg tracking-widest uppercase"
                      >
                        {isProcessingPayment === cs.id ? <Loader2 className="animate-spin w-4 h-4" /> : <CreditCard size={14} />}
                        Pay Offline
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={() => setSelectedCustomer(null)} className="rounded-full px-10 font-black text-[10px] border-gold/20 text-gold h-11 tracking-widest uppercase">DISMISS PROFILE</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default SuperadminCustomerManagement;