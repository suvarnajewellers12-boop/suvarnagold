import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { GoldDivider } from "@/components/GoldDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  metalType: "gold" | "silver" | "other";
  grams: number;
  carats: number;
  cost: number;
  quantity: number;
  manufactureDate: string;
  uniqueCode: string;
}

// 1. New Skeleton Component that mimics the real card exactly
const ProductSkeleton = () => (
  <div className="card-luxury h-[320px] p-5 flex flex-col animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 w-16 bg-muted rounded-full" />
      <div className="h-4 w-24 bg-muted rounded" />
    </div>
    <div className="h-7 w-3/4 bg-muted rounded mb-3" />
    <div className="grid grid-cols-2 gap-3 flex-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-10 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
      <div className="space-y-2">
        <div className="h-3 w-8 bg-muted rounded" />
        <div className="h-6 w-24 bg-muted rounded" />
      </div>
      <div className="h-10 w-10 bg-muted rounded-md" />
    </div>
  </div>
);

const ProductViewCard = ({
  product,
  onShowQR
}: {
  product: Product;
  onShowQR: (code: string) => void;
}) => {
  const typeColors = {
    gold: "from-yellow-600 to-yellow-400",
    silver: "from-gray-400 to-gray-200",
    other: "from-amber-700 to-amber-500",
  };

  return (
    <div className="card-luxury h-[320px] p-5 flex flex-col page-transition">
      <div className="flex items-center justify-between mb-4">
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r uppercase tracking-wide",
            typeColors[product.metalType]
          )}
        >
          {product.metalType}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(product.manufactureDate).toLocaleDateString()}
        </span>
      </div>

      <h3 className="font-serif text-xl font-bold text-foreground mb-3">
        {product.name}
      </h3>

      <div className="grid grid-cols-2 gap-3 text-sm flex-1">
        <div>
          <p className="text-muted-foreground">Weight</p>
          <p className="font-semibold">{product.grams}g</p>
        </div>
        <div>
          <p className="text-muted-foreground">Carats</p>
          <p className="font-semibold">{product.carats}K</p>
        </div>
        <div>
          <p className="text-muted-foreground">Stock</p>
          <p className="font-semibold">{product.quantity} pcs</p>
        </div>
        <div>
          <p className="text-muted-foreground">ID</p>
          <p className="font-semibold text-xs">{product.id}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
        <div>
          <p className="text-muted-foreground text-xs">Price</p>
          <p className="text-xl font-serif font-bold text-gradient-gold">
            ₹{product.cost?.toLocaleString()}
          </p>
        </div>
        <Button variant="outline" size="icon" className="border-primary/30" onClick={() => onShowQR(product.uniqueCode)}>
          <QrCode className="w-5 h-5 text-primary" />
        </Button>
      </div>
    </div>
  );
};

const AdminProducts = () => {
  const [filter, setFilter] = useState<"all" | "gold" | "silver" | "other">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 2. New Loading State
  const [qrModal, setQrModal] = useState<{
    image: string;
    productId: string;
  } | null>(null);

  const token = localStorage.getItem("token");

  const fetchProducts = async () => {
    setIsLoading(true); // Trigger loading immediately
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/products/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleShowQR = async (uniqueCode: string) => {
    const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/qr/${uniqueCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setQrModal({ image: data.qrImage, productId: data.productId });
    } else {
      alert(data.error);
    }
  };

  const filteredProducts = products
    .filter((p) => filter === "all" || p.metalType === filter)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">Products</h1>
                <p className="text-sm text-muted-foreground">View available jewelry inventory</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter:</span>
              </div>
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
            </div>

            <GoldDivider />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 3. Render Skeletons if loading, otherwise real data */}
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
                : filteredProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className="page-transition"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <ProductViewCard product={product} onShowQR={handleShowQR} />
                    </div>
                  ))}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No products found matching your criteria.</p>
              </div>
            )}
          </div>
        </main>

        {qrModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-[350px] text-center relative">
              <h3 className="font-serif text-lg font-bold mb-4">Product QR Code</h3>
              <img src={qrModal.image} alt="QR Code" className="w-60 h-60 mx-auto mb-4" />
              <p className="text-xs text-muted-foreground mb-4">Product ID: {qrModal.productId}</p>
              <div className="flex gap-3 justify-center">
                <a href={qrModal.image} download={`QR-${qrModal.productId}.png`} className="px-4 py-2 bg-primary text-white rounded-md text-sm">Download</a>
                <Button variant="outline" onClick={() => setQrModal(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
};

export default AdminProducts;
