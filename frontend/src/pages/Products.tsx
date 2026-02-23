import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Plus, Search, Filter, QrCode } from "lucide-react";

// 1. Precise Skeleton Component to match ProductCard height/structure
const ProductSkeleton = () => (
  <div className="card-luxury h-[380px] p-5 flex flex-col animate-pulse">
    <div className="flex justify-between items-start mb-6">
      <div className="h-6 w-20 bg-muted rounded-full" />
      <div className="h-4 w-4 bg-muted rounded" />
    </div>
    <div className="h-7 w-3/4 bg-muted rounded mb-4" />
    <div className="space-y-3 flex-1">
      <div className="flex justify-between"><div className="h-3 w-12 bg-muted rounded" /><div className="h-3 w-16 bg-muted rounded" /></div>
      <div className="flex justify-between"><div className="h-3 w-10 bg-muted rounded" /><div className="h-3 w-14 bg-muted rounded" /></div>
      <div className="flex justify-between"><div className="h-3 w-14 bg-muted rounded" /><div className="h-3 w-12 bg-muted rounded" /></div>
    </div>
    <div className="pt-4 border-t border-border mt-auto flex justify-between items-center">
      <div className="h-6 w-24 bg-muted rounded" />
      <div className="h-9 w-9 bg-muted rounded-lg" />
    </div>
  </div>
);

const Products = () => {
  const [showToast, setShowToast] = useState(false);
  const [qrModal, setQrModal] = useState<{ image: string; productId: string } | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "gold" | "silver" | "other">("all");
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 2. Instant Loading State

  const [formData, setFormData] = useState({
    name: "",
    type: "gold",
    grams: "",
    carats: "",
    cost: "",
    quantity: "",
    manufactureDate: "",
  });

  const token = localStorage.getItem("token");

  const fetchProducts = async () => {
    setIsLoading(true); // Trigger skeleton immediately on fetch
    try {
      const res = await fetch("http://localhost:3000/api/products/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false); // End skeleton state
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleShowQR = async (uniqueCode: string) => {
    const res = await fetch(`http://localhost:3000/api/products/qr/${uniqueCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setQrModal({ image: data.qrImage, productId: data.productId });
    } else {
      alert(data.error);
    }
  };

  const handleCreateProduct = async (e: any) => {
    e.preventDefault();
    const res = await fetch("http://localhost:3000/api/products/create", {
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
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setToastMessage("Product created successfully!");
      setShowToast(true);
      setShowForm(false);
      fetchProducts();
    } else {
      alert(data.error);
    }
  };

  const filteredProducts =
    filter === "all" ? products : products.filter((p) => p.type === filter);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />

        {qrModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-[350px] text-center space-y-4 animate-in zoom-in-95 duration-200">
              <h2 className="font-serif text-xl font-bold">Product QR Code</h2>
              <img src={qrModal.image} alt="QR Code" className="mx-auto w-64 h-64" />
              <a
                href={qrModal.image}
                download={`QR-${qrModal.productId}.png`}
                className="block bg-gradient-to-r from-yellow-500 to-yellow-400 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
              >
                Download QR
              </a>
              <button onClick={() => setQrModal(null)} className="text-sm text-gray-500 hover:text-black">
                Close
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto h-screen">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold">Products</h1>
              <p className="text-sm text-muted-foreground">Manage your jewelry inventory</p>
            </div>
            <Button variant="gold" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </header>

          <div className="p-6 space-y-8">
            {showForm && (
              <LuxuryCard className="animate-in slide-in-from-top duration-300">
                <form onSubmit={handleCreateProduct} className="grid grid-cols-2 gap-4">
                  <Input placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  <Input placeholder="Type (gold/silver/other)" onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
                  <Input placeholder="Grams" onChange={(e) => setFormData({ ...formData, grams: e.target.value })} />
                  <Input placeholder="Carats" onChange={(e) => setFormData({ ...formData, carats: e.target.value })} />
                  <Input placeholder="Cost" onChange={(e) => setFormData({ ...formData, cost: e.target.value })} />
                  <Input placeholder="Quantity" onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
                  <Input type="date" onChange={(e) => setFormData({ ...formData, manufactureDate: e.target.value })} />
                  <Button type="submit" variant="gold">Save Product</Button>
                </form>
              </LuxuryCard>
            )}

            <GoldDivider />

            <div className="flex gap-2">
              {(["all", "gold", "silver", "other"] as const).map((type) => (
                <Button
                  key={type}
                  variant={filter === type ? "gold" : "gold-outline"}
                  size="sm"
                  onClick={() => setFilter(type)}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 3. Logical Gate for Skeleton vs Real Data */}
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
                : filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onUpdated={fetchProducts}
                      showToast={setToastMessage}
                      onShowQR={handleShowQR}
                    />
                  ))}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No jewelry products found.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </SidebarProvider>
  );
};

export default Products;