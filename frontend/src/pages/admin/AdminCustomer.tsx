"use client";

import { useEffect, useState, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar"; 
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessToast } from "@/components/SuccessToast";
import { GoldDivider } from "@/components/GoldDivider";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, X, Phone, UserCircle, 
  ShieldCheck, LayoutGrid, Check, ChevronsUpDown,
  Calendar, IndianRupee, Layers, KeyRound, ChevronRight,
  TrendingUp, Lock, Loader2, Search, Filter 
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
import { cn } from "@/lib/utils";

// 1. Aligned Skeleton Component
const CustomerSkeleton = () => (
  <div className="card-luxury h-[220px] p-6 flex flex-col animate-pulse">
    <div className="flex items-center gap-4 mb-5">
      <div className="h-12 w-12 rounded-full bg-muted" />
      <div className="space-y-2 flex-1">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/4 bg-muted rounded" />
      </div>
    </div>
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="h-5 w-16 bg-muted rounded-full" />
      <div className="h-5 w-20 bg-muted rounded-full" />
    </div>
    <div className="mt-auto pt-4 border-t border-border flex justify-between">
      <div className="h-3 w-24 bg-muted rounded" />
      <div className="h-4 w-4 bg-muted rounded" />
    </div>
  </div>
);

// ================= CACHE CONFIGURATION =================
// Declared outside the component to persist across tab switches within the same session
let customerRegistryCache: { 
  customers: any[] | null, 
  schemes: any[] | null 
} = {
  customers: null,
  schemes: null
};

const CustomerManagement = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [customers, setCustomers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

  // ================= FETCH WITH CACHE LOGIC =================
  const fetchData = async (forceRefresh = false) => {
    // 1. Check if we can return data from the cache
    if (!forceRefresh && customerRegistryCache.customers && customerRegistryCache.schemes) {
      setCustomers(customerRegistryCache.customers);
      setSchemes(customerRegistryCache.schemes);
      setIsLoading(false);
      return;
    }

    // 2. Fetch fresh data if cache is empty or forceRefresh is true
    setIsLoading(true);
    try {
      const [resS, resC] = await Promise.all([
        fetch("https://suvarnagold-16e5.vercel.app/api/schemes/all", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("https://suvarnagold-16e5.vercel.app/api/customers/all", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const dataS = await resS.json();
      const dataC = await resC.json();
      
      if (resS.ok && resC.ok) {
        const fetchedSchemes = dataS.schemes || [];
        const fetchedCustomers = dataC.customers || [];
        
        // Update Local States
        setSchemes(fetchedSchemes);
        setCustomers(fetchedCustomers);
        
        // Update Global Cache
        customerRegistryCache = { customers: fetchedCustomers, schemes: fetchedSchemes };
      }
    } catch (error) { 
        console.error("Registry fetch error", error); 
    } finally { 
        setIsLoading(false); 
    }
  };

  useEffect(() => { 
      fetchData(); 
  }, []);

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
    const res = await fetch("https://suvarnagold-16e5.vercel.app/api/customers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, schemeIds: [selectedSchemeId] }),
    });
    if (res.ok) {
      setToastMessage("Customer Registered 🎉");
      setShowToast(true);
      setForm({ name: "", username: "", password: "", phone: "" });
      setSelectedSchemeId(null);
      setShowForm(false);
      
      // Force refresh the cache so the list updates immediately
      fetchData(true);
    }
    setIsCreating(false);
  };

  const handleSaveNewPassword = async () => {
    setIsSavingPassword(true);
    const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/customers/change-password/${selectedCustomer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) {
      setToastMessage("Password updated");
      setShowToast(true);
      setIsUpdatingPassword(false);
      setNewPassword("");
    }
    setIsSavingPassword(false);
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AdminSidebar />
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* HEADER */}
          <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">Customer Registry</h1>
                <p className="text-sm text-muted-foreground">Manage authorized members and portfolios</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "gold"}>
                   {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                   {showForm ? "Close Form" : "New Customer"}
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {showForm && (
                <aside className="w-full lg:w-[400px] animate-in slide-in-from-left duration-300">
                  <LuxuryCard className="border-gold/20 shadow-xl">
                    <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                      <UserCircle className="text-gold w-5 h-5" /> Register Member
                    </h2>
                    <div className="space-y-4">
                      <Input placeholder="Full Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Username" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} />
                        <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
                      </div>
                      <Input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                      
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-gold ml-1">Portfolio Assignment</label>
                        <Popover open={openDropdown} onOpenChange={setOpenDropdown}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between border-dashed border-gold/30">
                              {selectedSchemeId ? schemes.find(s => s.id === selectedSchemeId)?.name : "Select Scheme"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gold" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[336px] p-0 z-[100]">
                            <Command>
                              <CommandInput placeholder="Search schemes..." />
                              <CommandList>
                                <CommandEmpty>No schemes found.</CommandEmpty>
                                <CommandGroup>
                                  {schemes.map((scheme) => (
                                    <CommandItem key={scheme.id} onSelect={() => { setSelectedSchemeId(scheme.id); setOpenDropdown(false); }}>
                                      {scheme.name}
                                      <Check className={cn("ml-auto h-4 w-4", selectedSchemeId === scheme.id ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <Button variant="gold" className="w-full h-12 mt-4" onClick={handleCreateCustomer} disabled={isCreating}>
                        {isCreating ? <Loader2 className="animate-spin" /> : "Authorize Registration"}
                      </Button>
                    </div>
                  </LuxuryCard>
                </aside>
              )}

              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Active Members ({filteredCustomers.length})</span>
                </div>
                
                <div className={cn(
                  "grid gap-6",
                  showForm ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                )}>
                  {isLoading 
                    ? Array.from({ length: 8 }).map((_, i) => <CustomerSkeleton key={i} />)
                    : filteredCustomers.map((customer, index) => (
                      <div 
                        key={customer.id} 
                        onClick={() => setSelectedCustomer(customer)}
                        className="page-transition cursor-pointer"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <LuxuryCard className="group p-6 hover:border-gold/40 transition-all h-[220px] flex flex-col">
                          <div className="flex items-center gap-4 mb-5">
                            <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center text-gold font-serif text-xl font-bold">
                              {customer.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="font-serif font-bold text-lg truncate group-hover:text-gold transition-colors">{customer.name}</h3>
                              <p className="text-xs text-muted-foreground">@{customer.username}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {customer.schemes?.slice(0, 2).map((cs: any) => (
                              <Badge key={cs.id} variant="outline" className="text-[9px] border-gold/20 text-gold uppercase">{cs.scheme.name}</Badge>
                            ))}
                          </div>
                          <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                            <span className="text-xs flex items-center gap-1.5 text-muted-foreground"><Phone size={12}/> {customer.phone}</span>
                            <ChevronRight size={14} className="text-gold" />
                          </div>
                        </LuxuryCard>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* DETAIL DIALOG */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => { setSelectedCustomer(null); setIsUpdatingPassword(false); }}>
        <DialogContent className="max-w-3xl rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-8 border-b bg-muted/30">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-5">
                  <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center text-gold font-serif text-3xl font-bold">{selectedCustomer?.name.charAt(0)}</div>
                  <div>
                    <DialogTitle className="text-2xl font-serif font-bold">{selectedCustomer?.name}</DialogTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="text-[10px] border-gold/40 text-gold">@{selectedCustomer?.username}</Badge>
                      <span className="text-xs text-muted-foreground font-medium">{selectedCustomer?.phone}</span>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setIsUpdatingPassword(!isUpdatingPassword)} variant="outline" size="sm" className="gap-2">
                  <KeyRound size={14} /> Security
                </Button>
            </div>
          </DialogHeader>

          <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isUpdatingPassword && (
              <div className="mb-8 p-4 bg-gold/5 border border-gold/10 rounded-lg flex items-end gap-4 animate-in fade-in zoom-in-95">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gold">New Password</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-background" />
                </div>
                <Button variant="gold" onClick={handleSaveNewPassword} disabled={isSavingPassword}>Update</Button>
              </div>
            )}

            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Enrollment Portfolios</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedCustomer?.schemes.map((cs: any) => (
                <div key={cs.id} className="border rounded-xl p-5 space-y-3 hover:bg-muted/10 transition-colors">
                  <div className="flex justify-between items-start">
                    <h5 className="font-serif font-bold">{cs.scheme.name}</h5>
                    <Badge variant={cs.isCompleted ? "default" : "outline"}>{cs.isCompleted ? "Completed" : "Active"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-muted-foreground">
                    <p className="flex items-center gap-1"><Calendar size={12}/> {cs.scheme.durationMonths} Mo</p>
                    <p className="flex items-center gap-1"><IndianRupee size={12}/> ₹{cs.scheme.monthlyAmount}</p>
                  </div>
                  <div className="pt-3 border-t flex justify-between items-end">
                    <div className="space-y-1">
                       <p className="text-[9px] uppercase text-muted-foreground">Remaining</p>
                       <p className="font-serif font-bold text-gold">₹{cs.remainingAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default CustomerManagement;