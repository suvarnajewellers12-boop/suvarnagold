"use client";
import { Eye, EyeOff, Users, Plus, Edit, Trash2, Loader2, Search, X, AlertTriangle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

// ================= CACHE CONFIGURATION =================
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
  const [showPassword, setShowPassword] = useState(false);

  const [admins, setAdmins] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Form States for Creation
  const [username, setUsername] = useState("");
  const [branchName, setBranchName] = useState("");
  const [state, setState] = useState("");
  const [password, setPassword] = useState("");

  // Dialog States
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  
  // Edit Form States
  const [editBranch, setEditBranch] = useState("");
  const [editState, setEditState] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

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
        adminCache = fetchedAdmins;
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

  // ================= ACTIONS =================

  const openEditDialog = (admin: any) => {
    setSelectedAdmin(admin);
    setEditBranch(admin.branchName);
    setEditState(admin.state);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (admin: any) => {
    setSelectedAdmin(admin);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAdmin) return;
    setIsSubmitting(true);
    try {
      await fetch(`https://suvarnagold-16e5.vercel.app/api/admin/delete/${selectedAdmin.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setToastMessage("Administrator removed successfully");
      setShowToast(true);
      setDeleteDialogOpen(false);
      fetchAdmins(true);
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    setIsSubmitting(true);
    try {
      await fetch(`https://suvarnagold-16e5.vercel.app/api/admin/update/${selectedAdmin.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ branchName: editBranch, state: editState }),
      });
      setToastMessage("Admin details updated");
      setShowToast(true);
      setEditDialogOpen(false);
      fetchAdmins(true);
    } catch (error) {
      console.error("Update error:", error);
    } finally {
      setIsSubmitting(false);
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
      fetchAdmins(true);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-gold">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
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
                          <Button size="icon" variant="ghost" onClick={() => openEditDialog(admin)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(admin)}><Trash2 className="w-4 h-4" /></Button>
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
            </section>
          </div>
        </main>
      </div>

      {/* ================= MODALS ================= */}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] border-gold/20">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Edit Administrator</DialogTitle>
            <DialogDescription>Update branch and location for {selectedAdmin?.username}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateAdmin} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest">Branch Name</label>
              <Input value={editBranch} onChange={(e) => setEditBranch(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest">State / Region</label>
              <Input value={editState} onChange={(e) => setEditState(e.target.value)} required />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-red-200">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="text-red-600 w-6 h-6" />
            </div>
            <DialogTitle className="text-xl">Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{selectedAdmin?.username}</strong>? 
              This action cannot be undone and they will lose all access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:justify-center mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>Keep Admin</Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default AdminManagement;