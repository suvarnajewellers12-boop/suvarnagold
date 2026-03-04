"use client";

import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, PackageOpen, Hash, Loader2, RefreshCw } from "lucide-react";

// ================= CACHE CONFIGURATION =================
// Declared outside the component to persist during the session
let productsCache: any[] | null = null;

const ProductSkeleton = () => (
  <div className="card-luxury h-[380px] p-5 flex flex-col animate-pulse border border-border rounded-2xl">
    <div className="flex justify-between items-start mb-6">
      <div className="h-6 w-20 bg-muted rounded-full" />
      <div className="h-4 w-4 bg-muted rounded" />
    </div>
    <div className="h-7 w-3/4 bg-muted rounded mb-4" />
    <div className="space-y-3 flex-1">
      <div className="h-3 w-full bg-muted rounded" />
      <div className="h-3 w-5/6 bg-muted rounded" />
    </div>
    <div className="pt-4 border-t border-border mt-auto flex justify-between items-center">
      <div className="h-6 w-24 bg-muted rounded" />
      <div className="h-9 w-9 bg-muted rounded-lg" />
    </div>
  </div>
);

const Products = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // States
  const [products, setProducts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "gold" | "silver" | "other">("all");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [barcodeModal, setBarcodeModal] = useState<{ image: string; productId: string; sku: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "gold",
    grams: "",
    carats: "",
    cost: "",
    quantity: "1",
  });

  // ================= FETCH WITH CACHE LOGIC =================
  const fetchProducts = async (forceRefresh = false) => {
    // If data is in cache and we aren't forcing a refresh, use it immediately
    if (!forceRefresh && productsCache !== null) {
      setProducts(productsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/products/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const fetchedProducts = data.products || [];
      
      // Update local state and global cache
      setProducts(fetchedProducts);
      productsCache = fetchedProducts;
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleShowBarcode = async (sku: string, productId: string) => {
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/barcode/${sku}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBarcodeModal({ image: data.barcodeImage, productId, sku });
      }
    } catch (err) {
      console.error("Barcode Fetch Failed", err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const currentDate = new Date().toISOString().split("T")[0];
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/products/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          grams: parseFloat(formData.grams),
          carats: String(formData.carats),
          cost: Number(formData.cost),
          quantity: Number(formData.quantity),
          metalType: String(formData.type),
          manufactureDate: currentDate,
        }),
      });

      if (res.ok) {
        setToastMessage("Treasury updated with new asset!");
        setShowToast(true);
        setShowForm(false);
        
        // CRITICAL: Force a refresh to sync cache after new entry
        await fetchProducts(true);
        
        setFormData({ name: "", type: "gold", grams: "", carats: "", cost: "", quantity: "1" });
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || "Failed to create product"}`);
      }
    } catch (error) {
      console.error("Creation Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = filter === "all"
    ? products
    : products.filter((p) => p.metalType?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background font-sans text-foreground">
        <DashboardSidebar />

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-card border border-amber-200/20 shadow-[0_0_50px_-12px_rgba(251,191,36,0.3)] rounded-3xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-500 p-6 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <PackageOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-serif font-bold tracking-wide">Add New Product</h2>
                    <p className="text-amber-100 text-xs opacity-80">The current date will be recorded automatically</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Product Name</label>
                    <Input
                      placeholder="e.g. Traditional Gold Choker"
                      className="h-12 border-amber-100/20 focus:border-amber-500 bg-muted/5"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Metal Type</label>
                    <select
                      className="flex h-12 w-full rounded-md border border-amber-100/20 bg-muted/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="92% silver">92% Silver</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Weight (Grams)</label>
                    <Input type="number" step="0.001" placeholder="0.000" className="h-12" value={formData.grams} onChange={(e) => setFormData({ ...formData, grams: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Purity / Carats</label>
                    <Input placeholder="e.g. 22K" className="h-12" value={formData.carats} onChange={(e) => setFormData({ ...formData, carats: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Cost</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                      <Input type="number" className="h-12 pl-8" placeholder="0.00" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Quantity in Stock</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input type="number" className="h-12 pl-10" placeholder="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" variant="gold" disabled={isSubmitting} className="flex-1 h-14 text-md font-bold shadow-amber-500/20 shadow-xl relative overflow-hidden">
                    {isSubmitting ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span> : "Confirm Registration"}
                  </Button>
                  <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setShowForm(false)} className="h-14 px-8">Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {barcodeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center space-y-6">
              <h2 className="font-serif text-2xl font-bold text-gray-900">Barcode Label</h2>
              <div className="bg-muted/10 p-4 rounded-2xl border border-dashed border-gray-200">
                <img src={barcodeModal.image} alt="Barcode" className="mx-auto mix-blend-multiply" />
                <p className="mt-4 text-[10px] font-mono text-gray-400 uppercase">SKU: {barcodeModal.sku}</p>
              </div>
              <div className="flex flex-col gap-3">
                <a href={barcodeModal.image} download={`SKU-${barcodeModal.sku}.png`} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold">Download Label</a>
                <button onClick={() => setBarcodeModal(null)} className="text-sm text-gray-500">Close</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto h-screen relative">
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif font-bold text-amber-900 dark:text-amber-100">Treasury Products</h1>
              <p className="text-sm text-muted-foreground">Manage your jewelry collection</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchProducts(true)} 
                title="Refresh Cache"
                className="h-12 w-12 rounded-2xl border-gold/20 text-gold"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="gold" onClick={() => setShowForm(true)} className="h-12 px-6 rounded-2xl gap-2 font-bold shadow-lg">
                <Plus className="w-5 h-5" />
                Add Product
              </Button>
            </div>
          </header>

          <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            <div className="flex gap-2 p-1.5 bg-muted/30 rounded-2xl border border-border/40 w-fit">
              {(["all", "gold", "silver", "other"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-6 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-all ${filter === t ? "bg-amber-500 text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <GoldDivider />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
                : filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onUpdated={() => fetchProducts(true)} // Refresh cache if card triggers update
                    showToast={setToastMessage}
                    onShowQR={(code: string) => handleShowBarcode(code, product.id)}
                  />
                ))}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center opacity-50">
                <PackageOpen className="w-16 h-16 mb-4" />
                <h3 className="text-xl font-serif font-bold">No products found</h3>
              </div>
            )}
          </div>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default Products;