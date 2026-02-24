import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Search, Edit, Trash2, Filter } from "lucide-react";

// 1. New Skeleton Component that mimics the admin card structure
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
  const [isLoading, setIsLoading] = useState(true); // 2. New Loading State

  const [admins, setAdmins] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [branchName, setBranchName] = useState("");
  const [state, setState] = useState("");
  const [password, setPassword] = useState("");

  const token = localStorage.getItem("token");

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;
    try {
      await fetch(`http://localhost:3000/api/admin/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAdmins();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleEdit = async (admin: any) => {
    const newBranch = prompt("Enter new branch name", admin.branchName);
    const newState = prompt("Enter new state", admin.state);
    if (!newBranch || !newState) return;

    try {
      await fetch(`http://localhost:3000/api/admin/update/${admin.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ branchName: newBranch, state: newState }),
      });
      fetchAdmins();
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("https://suvarnagold-nd6t.vercel.app/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, branchName, state, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create admin");

      setToastMessage("Admin created successfully!");
      setShowToast(true);
      setShowForm(false);
      setUsername(""); setBranchName(""); setState(""); setPassword("");
      fetchAdmins();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const fetchAdmins = async () => {
    setIsLoading(true); // Trigger loading immediately
    try {
      const response = await fetch("http://localhost:3000/api/admin/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setAdmins(data.admins);
      }
    } catch (error) {
      console.error("Fetch admins error:", error);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />

        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">Admin Management</h1>
                <p className="text-sm text-muted-foreground">Create and manage branch administrators</p>
              </div>

              <Button variant="gold" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Admin
              </Button>
            </div>
          </header>

          <div className="p-6 space-y-8">
            {showForm && (
              <LuxuryCard className="animate-in slide-in-from-top duration-300">
                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <h3 className="font-serif font-bold text-lg mb-4">Create New Admin</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    <Input placeholder="Branch Name" value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
                    <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} required />
                    <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" variant="gold">Create Admin</Button>
                    <Button type="button" variant="gold-outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  </div>
                </form>
              </LuxuryCard>
            )}

            <GoldDivider />

            <section>
              <h2 className="text-xl font-serif font-bold mb-6 text-foreground">All Administrators</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 3. Render Skeletons if loading, otherwise real data */}
                {isLoading 
                  ? Array.from({ length: 6 }).map((_, i) => <AdminSkeleton key={i} />)
                  : admins.map((admin) => (
                    <LuxuryCard key={admin.id} className="page-transition">
                      <div className="flex items-start justify-between">
                        <div className="w-12 h-12 gradient-gold rounded-full flex items-center justify-center shadow-gold mb-4">
                          <Users className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(admin)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDelete(admin.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <h3 className="font-serif font-bold text-lg text-foreground">{admin.username}</h3>
                      <p className="text-sm text-muted-foreground">{admin.branchName}</p>
                      <p className="text-sm text-muted-foreground">{admin.state}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Created: {new Date(admin.createdAt).toLocaleDateString()}
                      </p>
                    </LuxuryCard>
                  ))
                }
              </div>

              {!isLoading && admins.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No administrators found.</p>
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