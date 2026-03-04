"use client";

import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackageOpen, RefreshCw, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

// ================= CACHE CONFIGURATION =================
let productsCache: any[] | null = null;
// 🔥 NEW: Cache for individual barcodes (Key: SKU, Value: base64 Image string)
const barcodeCache: Record<string, string> = {};

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

const AdminProducts = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "gold" | "silver" | "other">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [barcodeModal, setBarcodeModal] = useState<{ image: string; productId: string; sku: string } | null>(null);

  // ================= FETCH PRODUCTS (With Cache) =================
  const fetchProducts = async (forceRefresh = false) => {
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

  // ================= SHOW BARCODE (With Barcode Cache) =================
  const handleShowBarcode = async (sku: string, productId: string) => {
    // 🔥 Check if this specific barcode is already cached
    if (barcodeCache[sku]) {
      console.log("Serving barcode from cache for SKU:", sku);
      setBarcodeModal({ image: barcodeCache[sku], productId, sku });
      return;
    }

    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/barcode/${sku}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (res.ok) {
        // 🔥 Store in cache for next time
        barcodeCache[sku] = data.barcodeImage;
        setBarcodeModal({ image: data.barcodeImage, productId, sku });
      }
    } catch (err) {
      console.error("Barcode Fetch Failed", err);
    }
  };

  const filteredProducts = products
    .filter((p) => filter === "all" || p.metalType?.toLowerCase() === filter)
    .filter((p) => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background font-sans text-foreground">
        <AdminSidebar />

        {/* BARCODE MODAL */}
        {barcodeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center space-y-6 animate-in zoom-in-95">
              <h2 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">Barcode Identity</h2>
              <div className="bg-muted/10 p-4 rounded-2xl border border-dashed border-gray-200">
                <img src={barcodeModal.image} alt="Barcode" className="mx-auto mix-blend-multiply" />
                <p className="mt-4 text-[10px] font-mono text-gray-400 uppercase tracking-widest">SKU: {barcodeModal.sku}</p>
              </div>
              <div className="flex flex-col gap-3">
                <a href={barcodeModal.image} download={`SKU-${barcodeModal.sku}.png`} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all">Download Label</a>
                <button onClick={() => setBarcodeModal(null)} className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto h-screen relative">
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif font-bold text-amber-900 dark:text-amber-100">Inventory Catalog</h1>
              <p className="text-sm text-muted-foreground italic">Administrative Overview</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search vault..."
                  className="pl-9 w-64 h-11 rounded-xl border-gold/10 bg-slate-50/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchProducts(true)} 
                className="h-11 w-11 rounded-xl border-gold/20 text-gold"
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
              </Button>
            </div>
          </header>

          <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-2 p-1.5 bg-muted/30 rounded-2xl border border-border/40 w-fit">
                {(["all", "gold", "silver", "other"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={cn(
                      "px-6 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-300",
                      filter === t 
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <GoldDivider />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)
                : filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onUpdated={() => {
                        // If a card is updated, clear the cache and re-fetch
                        productsCache = null; 
                        fetchProducts(true);
                    }}
                    showToast={setToastMessage}
                    onShowQR={(code: string) => handleShowBarcode(code, product.id)}
                  />
                ))}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
                <PackageOpen className="w-16 h-16 mb-4 text-amber-900" />
                <h3 className="text-xl font-serif font-bold">The registry is empty</h3>
                <p className="text-sm">Try refreshing the data or checking different filters.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default AdminProducts;