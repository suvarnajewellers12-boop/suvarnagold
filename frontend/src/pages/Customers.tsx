"use client";

import { useEffect, useState } from "react";
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
  TrendingUp, Lock
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

const CustomerManagement = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [customers, setCustomers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  
  // Security Update States
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [form, setForm] = useState({ name: "", username: "", password: "", phone: "" });
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const fetchData = async () => {
    setIsInitialLoading(true);
    try {
      const [resS, resC] = await Promise.all([
        fetch("https://suvarnagold-16e5.vercel.app/api/schemes/all", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("https://suvarnagold-16e5.vercel.app/api/customers/all", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const dataS = await resS.json();
      const dataC = await resC.json();
      if (resS.ok) setSchemes(dataS.schemes || []);
      if (resC.ok) setCustomers(dataC.customers || []);
    } catch (error) { console.error("Fetch error", error); }
    finally { setIsInitialLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateCustomer = async () => {
    if (!form.name || !form.username || !form.password || !form.phone || !selectedSchemeId) {
      setToastMessage("All fields including a scheme selection are required");
      setShowToast(true);
      return;
    }
    const res = await fetch("https://suvarnagold-16e5.vercel.app/api/customers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, schemeIds: [selectedSchemeId] }),
    });
    if (res.ok) {
      setToastMessage("Customer Registry Updated 🎉");
      setShowToast(true);
      setForm({ name: "", username: "", password: "", phone: "" });
      setSelectedSchemeId(null);
      fetchData();
    }
  };

  const handleSaveNewPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setToastMessage("Password must be at least 4 characters");
      setShowToast(true);
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/customers/change-password/${selectedCustomer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setToastMessage("Security credentials updated successfully");
        setShowToast(true);
        setIsUpdatingPassword(false);
        setNewPassword("");
      } else {
        const error = await res.json();
        setToastMessage(error.message || "Failed to update security credentials");
        setShowToast(true);
      }
    } catch (e) { 
        setToastMessage("Backend communication error"); 
        setShowToast(true); 
    } finally {
        setIsSavingPassword(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#fdfdfc] dark:bg-[#0a0a0a] w-full overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          <header className="bg-transparent px-8 py-6 flex justify-between items-center shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60 font-sans">Registry Management</span>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-900">Customer Registry</h1>
            </div>
            <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "gold"} className="gap-2 rounded-full font-bold uppercase tracking-widest text-[10px] h-11 px-7 border-gold/20 shadow-sm transition-all active:scale-95">
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? "Close Form" : "New Customer"}
            </Button>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 pb-6 gap-6">
            <aside className={`h-full transition-all duration-500 shrink-0 z-20 ${showForm ? "w-[400px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}>
              <div className="h-[calc(100vh-140px)] bg-white border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col border-b-4 border-b-gold/20 overflow-hidden">
                <div className="p-8 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-8 shrink-0">
                    <div className="p-2 bg-gold/10 rounded-xl"><UserCircle className="w-5 h-5 text-gold" /></div>
                    <h2 className="text-xl font-serif font-bold italic text-slate-900">Register Member</h2>
                  </div>
                  <div className="space-y-4 flex-1">
                    <Input name="name" placeholder="Full Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-11 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="username" placeholder="Username" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} className="h-11 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                      <Input name="password" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="h-11 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                    </div>
                    <Input name="phone" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="h-11 rounded-xl bg-slate-50/50 border-gold/10 focus-visible:ring-gold" />
                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-gold ml-1 text-left block">Mandatory Portfolio Assignment</label>
                      <Popover open={openDropdown} onOpenChange={setOpenDropdown}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between rounded-xl border-gold/10 bg-slate-50/50 h-11 text-muted-foreground font-medium border-dashed">
                            {selectedSchemeId ? schemes.find(s => s.id === selectedSchemeId)?.name : "Choose Single Portfolio"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gold" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" sideOffset={10} align="start" className="w-[336px] p-0 rounded-2xl border-gold/10 shadow-2xl z-[100]">
                          <Command className="rounded-2xl">
                            <CommandInput placeholder="Find schemes..." className="h-10" />
                            <CommandList className="max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                              <CommandEmpty className="p-4 text-xs italic text-center text-muted-foreground">No portfolios found</CommandEmpty>
                              <CommandGroup>
                                {schemes.map((scheme) => (
                                  <CommandItem 
                                    key={scheme.id} 
                                    onSelect={() => { setSelectedSchemeId(scheme.id); setOpenDropdown(false); }} 
                                    className={`flex items-center justify-between p-3 rounded-xl mb-1 cursor-pointer transition-all
                                      ${selectedSchemeId === scheme.id ? "bg-gold/10 text-gold font-bold" : "hover:bg-slate-50"}`}
                                  >
                                    <span className="text-sm truncate">{scheme.name}</span>
                                    {selectedSchemeId === scheme.id && <Check className="h-4 w-4" />}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <Button variant="gold" className="w-full h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-bold shadow-xl shadow-gold/20 mt-6 shrink-0 transition-all active:scale-95" onClick={handleCreateCustomer}>Authorize Registration</Button>
                </div>
              </div>
            </aside>

            <section className="flex-1 flex flex-col min-w-0 bg-white border border-gold/10 rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-8 py-6 border-b border-gold/5 shrink-0 bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold/5 rounded-lg"><LayoutGrid className="w-4 h-4 text-gold" /></div>
                  <h2 className="text-lg font-serif font-bold uppercase tracking-tight">Active Members</h2>
                </div>
                <Badge variant="outline" className="rounded-full border-gold/20 text-gold bg-gold/5 px-4 py-1 text-[9px] uppercase font-bold tracking-widest">Global Registry</Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className={`grid gap-6 transition-all duration-500 ${showForm ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                  {isInitialLoading ? Array.from({ length: 8 }).map((_, i) => <CustomerSkeleton key={i} />) : (
                    customers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className="group hover:border-gold/40 cursor-pointer transition-all duration-300"
                      >
                        <LuxuryCard 
                          className="p-6 rounded-[22px] shadow-sm hover:shadow-xl flex flex-col bg-white border-gold/5 border"
                        >
                          <div className="flex items-center gap-4 mb-5">
                            <div className="h-12 w-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-serif text-xl font-bold">{customer.name.charAt(0)}</div>
                            <div className="overflow-hidden">
                              <h3 className="font-serif font-bold text-lg leading-tight uppercase truncate text-slate-900 group-hover:text-gold transition-colors">{customer.name}</h3>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">@{customer.username}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-auto">
                            {customer.schemes?.map((cs: any) => (
                              <Badge key={cs.id} className="bg-gold/[0.03] text-[8px] text-gold border border-gold/10 px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter">{cs.scheme.name}</Badge>
                            ))}
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-muted-foreground">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter"><Phone size={12} className="text-gold/60"/> {customer.phone}</div>
                            <ChevronRight size={14} className="text-gold opacity-0 group-hover:opacity-100 transition-opacity" />
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

      <Dialog open={!!selectedCustomer} onOpenChange={() => { setSelectedCustomer(null); setIsUpdatingPassword(false); }}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] border-gold/20 bg-white/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl ring-1 ring-gold/10">
          <DialogHeader className="p-8 border-b border-gold/10 bg-slate-50/50">
            <div className="flex justify-between items-center w-full pr-10">
                <div className="flex items-center gap-5">
                  <div className="h-16 w-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-serif text-3xl font-bold">{selectedCustomer?.name.charAt(0)}</div>
                  <div>
                    <DialogTitle className="text-3xl font-serif font-bold text-slate-900">{selectedCustomer?.name}</DialogTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge className="bg-gold/5 text-gold border-gold/10 text-[10px] font-bold uppercase tracking-widest">@{selectedCustomer?.username}</Badge>
                      <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Phone size={13} className="text-gold" /> {selectedCustomer?.phone}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => setIsUpdatingPassword(!isUpdatingPassword)} 
                  variant={isUpdatingPassword ? "gold" : "outline"} 
                  className="rounded-full border-gold/20 text-gold text-[10px] font-bold uppercase px-4 h-9 gap-2 hover:bg-gold/5 transition-all"
                >
                    {isUpdatingPassword ? <X size={14} /> : <KeyRound size={14} />} 
                    {isUpdatingPassword ? "Cancel Update" : "Security Update"}
                </Button>
            </div>
          </DialogHeader>

          {/* PASSWORD UPDATE COMPONENT */}
          {isUpdatingPassword && (
            <div className="bg-gold/[0.03] border-b border-gold/10 px-8 py-6 animate-in slide-in-from-top duration-300">
                <div className="flex items-end gap-4 max-w-md">
                    <div className="flex-1 space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gold tracking-widest ml-1">New Member Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                            <Input 
                                type="password"
                                placeholder="Min 4 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="h-10 pl-9 rounded-xl border-gold/20 bg-white"
                            />
                        </div>
                    </div>
                    <Button 
                        variant="gold" 
                        onClick={handleSaveNewPassword}
                        disabled={isSavingPassword}
                        className="h-10 rounded-xl px-6 text-[10px] uppercase font-bold tracking-widest"
                    >
                        {isSavingPassword ? "Saving..." : "Update Credentials"}
                    </Button>
                </div>
            </div>
          )}

          <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
            <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-gold mb-6 border-b border-gold/10 pb-2 flex items-center gap-2"><Layers size={12}/> Enrollment Portfolio</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              {selectedCustomer?.schemes.map((cs: any) => (
                <div key={cs.id} className="border border-gold/10 rounded-3xl p-6 bg-[#fafaf9] hover:bg-white transition-all shadow-sm">
                  <div className="flex justify-between items-start mb-5">
                    <h5 className="font-serif font-bold text-lg text-slate-900">{cs.scheme.name}</h5>
                    <Badge className={cs.isCompleted ? "bg-emerald-500 rounded-full" : "bg-gold rounded-full"}>{cs.isCompleted ? "Finished" : "Active"}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-5 font-bold text-[11px] text-slate-500">
                    <div className="flex items-center gap-2"><Calendar size={13} className="text-gold/70"/> {cs.scheme.durationMonths} Mo.</div>
                    <div className="flex items-center gap-2"><IndianRupee size={13} className="text-gold/70"/> ₹{cs.scheme.monthlyAmount}/mo</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={13} className="text-gold/70"/> {cs.installmentsPaid}/{cs.installmentsPaid + cs.installmentsLeft} Paid</div>
                    <div className="flex items-center gap-2"><TrendingUp size={13} className="text-gold/70"/> ₹{cs.scheme.maturityAmount}[Maturity Amount]</div>
                  </div>

                  <div className="pt-4 border-t border-gold/5 flex justify-between items-end">
                    <div className="space-y-1">
                       <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Amount Remaining</p>
                       <p className="font-serif font-bold text-gold text-lg">₹{cs.remainingAmount.toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">Registry Secure</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t border-gold/10 flex justify-end">
            <Button variant="outline" onClick={() => { setSelectedCustomer(null); setIsUpdatingPassword(false); }} className="rounded-full px-10 font-bold text-[10px] uppercase tracking-widest border-gold/20 text-gold h-11 transition-all shadow-sm">Dismiss Member Profile</Button>
          </div>
        </DialogContent>
      </Dialog>
      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default CustomerManagement;
