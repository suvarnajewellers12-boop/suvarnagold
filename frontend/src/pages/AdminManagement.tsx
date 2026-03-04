"use client";

import { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Edit, Trash2, Loader2, Search, X } from "lucide-react";

// ================= CACHE CONFIGURATION =================
// Lives outside the component to persist during the session
let adminCache: any[] | null = null;

const AdminSkeleton = () => (
  <LuxuryCard className="animate-pulse">
    <div className="flex items-start justify-between">
      <div className="w-12 h-12 bg-muted rounded-full mb-4" />
      <div className="flex gap-2">
        <div className="w-8 h-8 bg-muted rounded-md" />
        <div className="w-8 h-8 bg-muted rounded-md" />
      </div>
    </div>
    <div className="h-6 w-3/4 bg-muted rounded mb-2" />
    <div className="h-4 w-1/2 bg-muted rounded mb-2" />
    <div className="h-4 w-1/3 bg-muted rounded mb-2" />
    <div className="h-3 w-1/4 bg-muted rounded mt-4" />
  </LuxuryCard>
);

const AdminManagement = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [admins, setAdmins] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // For better management
  
  const [username, setUsername] = useState("");
  const [branchName, setBranchName] = useState("");
  const [state, setState] = useState("");
  const [password, setPassword] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ================= FETCH WITH CACHE LOGIC =================
  const fetchAdmins = async (forceRefresh = false) => {
    if (!forceRefresh && adminCache !== null) {
      setAdmins(adminCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("https://suvarnagold-16e5.vercel.app/api/admin/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        const fetchedAdmins = data.admins || [];
        setAdmins(fetchedAdmins);
        adminCache = fetchedAdmins; // Update memory cache
      }
    } catch (error) {
      console.error("Fetch admins error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // ================= CRUD OPERATIONS (WITH CACHE UPDATES) =================
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;
    try {
      await fetch(`https://suvarnagold-16e5.vercel.app/api/admin/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAdmins(true); // Force refresh cache
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleEdit = async (admin: any) => {
    const newBranch = prompt("Enter new branch name", admin.branchName);
    const newState = prompt("Enter new state", admin.state);
    if (!newBranch || !newState) return;

    try {
      await fetch(`https://suvarnagold-16e5.vercel.app/api/admin/update/${admin.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ branchName: newBranch, state: newState }),
      });
      fetchAdmins(true); // Force refresh cache
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("https://suvarnagold-16e5.vercel.app/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, branchName, state, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create admin");

      setToastMessage("Admin registered successfully!");
      setShowToast(true);
      setShowForm(false);
      setUsername(""); setBranchName(""); setState(""); setPassword("");
      fetchAdmins(true); // Sync cache
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered list for search
  const filteredAdmins = useMemo(() => {
    return admins.filter(admin => 
      admin.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.branchName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [admins, searchQuery]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7]">
        <DashboardSidebar />

        <main className="flex-1 overflow-auto h-screen relative">
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-8 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">Admin Management</h1>
              <p className="text-sm text-muted-foreground italic">Managing authorized branch administrators</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => fetchAdmins(true)} className="h-10 rounded-full border-gold/20 text-[10px] uppercase font-bold tracking-widest">
                Sync Data
              </Button>
              <Button variant="gold" onClick={() => setShowForm(!showForm)} className="h-10 rounded-full px-6 shadow-lg">
                {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {showForm ? "Cancel" : "Create Admin"}
              </Button>
            </div>
          </header>

          <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
            {showForm && (
              <LuxuryCard className="animate-in slide-in-from-top duration-300 border-amber-500/20">
                <form onSubmit={handleCreateAdmin} className="space-y-6">
                  <h3 className="font-serif font-bold text-xl mb-4 italic">Register New Administrator</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admin Username</label>
                      <Input placeholder="e.g. jaya_admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Branch Location</label>
                      <Input placeholder="e.g. Vizag Main" value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Region / State</label>
                      <Input placeholder="e.g. Andhra Pradesh" value={state} onChange={(e) => setState(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Security Password</label>
                      <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gold/5">
                    <Button type="submit" variant="gold" className="px-10 h-12" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                      {isSubmitting ? "Authorizing..." : "Create Admin"}
                    </Button>
                  </div>
                </form>
              </LuxuryCard>
            )}

            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search admins or branches..." 
                className="pl-10 h-11 bg-white border-gold/10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <GoldDivider />

            <section>
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-serif font-bold text-foreground">Active Administrators</h2>
                 <span className="text-[10px] font-bold px-3 py-1 bg-amber-100 text-amber-700 rounded-full">{filteredAdmins.length} Total</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading 
                  ? Array.from({ length: 6 }).map((_, i) => <AdminSkeleton key={i} />)
                  : filteredAdmins.map((admin) => (
                    <LuxuryCard key={admin.id} className="hover:shadow-xl transition-all duration-300 group border-gold/10">
                      <div className="flex items-start justify-between">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:bg-amber-600 transition-colors">
                          <Users className="w-6 h-6 text-amber-700 group-hover:text-white" />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(admin)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(admin.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <h3 className="font-serif font-bold text-lg text-foreground">{admin.username}</h3>
                      <div className="space-y-1 mt-2">
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">{admin.branchName}</p>
                        <p className="text-sm text-muted-foreground">{admin.state}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-4 border-t border-gold/5 pt-3">
                        Registered: {new Date(admin.createdAt).toLocaleDateString("en-GB")}
                      </p>
                    </LuxuryCard>
                  ))
                }
              </div>

              {!isLoading && filteredAdmins.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-gold/10 rounded-3xl opacity-50">
                  <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-muted-foreground italic">No administrators found matching your criteria.</p>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default AdminManagement;