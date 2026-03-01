"use client";

import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Plus } from "lucide-react";

// ================= Skeleton =================
const ProductSkeleton = () => (
  <div className="card-luxury h-[380px] p-5 flex flex-col animate-pulse">
    <div className="flex justify-between items-start mb-6">
      <div className="h-6 w-20 bg-muted rounded-full" />
      <div className="h-4 w-4 bg-muted rounded" />
    </div>
    <div className="h-7 w-3/4 bg-muted rounded mb-4" />
    <div className="space-y-3 flex-1">
      <div className="flex justify-between">
        <div className="h-3 w-12 bg-muted rounded" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-10 bg-muted rounded" />
        <div className="h-3 w-14 bg-muted rounded" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-14 bg-muted rounded" />
        <div className="h-3 w-12 bg-muted rounded" />
      </div>
    </div>
    <div className="pt-4 border-t border-border mt-auto flex justify-between items-center">
      <div className="h-6 w-24 bg-muted rounded" />
      <div className="h-9 w-9 bg-muted rounded-lg" />
    </div>
  </div>
);

const Products = () => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "gold" | "silver" | "other"
  >("all");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [barcodeModal, setBarcodeModal] = useState<{
    image: string;
    productId: string;
    uniqueCode: string;
  } | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "gold",
    grams: "",
    carats: "",
    cost: "",
    quantity: "",
    manufactureDate: "",
  });

  // ================= FETCH PRODUCTS =================
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        "https://suvarnagold-16e5.vercel.app/api/products/all",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ================= SHOW BARCODE =================
  const handleShowBarcode = async (uniqueCode: string, productId: string) => {
    const res = await fetch(
      `https://suvarnagold-16e5.vercel.app/api/products/barcode/${uniqueCode}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();

    if (res.ok) {
      setBarcodeModal({
        image: data.barcodeImage,
        productId,
        uniqueCode,
      });
    } else {
      alert(data.error);
    }
  };

  // ================= CREATE PRODUCT =================
  const handleCreateProduct = async (e: any) => {
    e.preventDefault();

    const res = await fetch(
      "https://suvarnagold-16e5.vercel.app/api/products/create",
      {
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
      }
    );

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

  // 🔥 FIXED FILTER (metalType instead of type)
  const filteredProducts =
    filter === "all"
      ? products
      : products.filter((p) => p.metalType === filter);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />

        {/* ================= BARCODE MODAL ================= */}
        {barcodeModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-[420px] text-center space-y-4 animate-in zoom-in-95 duration-200">
              
              <h2 className="font-serif text-xl font-bold">
                Product Barcode
              </h2>

              <img
                src={barcodeModal.image}
                alt="Barcode"
                className="mx-auto w-full max-w-[300px] h-auto"
              />

              {/* 🔥 PRODUCT ID BELOW BARCODE */}
              <div className="text-sm text-gray-600 mt-2">
                <p className="font-semibold">Product ID:</p>
                <p className="break-all">{barcodeModal.productId}</p>
              </div>

              <a
                href={barcodeModal.image}
                download={`BARCODE-${barcodeModal.productId}.png`}
                className="block bg-gradient-to-r from-yellow-500 to-yellow-400 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
              >
                Download Barcode
              </a>

              <button
                onClick={() => setBarcodeModal(null)}
                className="text-sm text-gray-500 hover:text-black"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ================= MAIN ================= */}
        <main className="flex-1 overflow-auto h-screen">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold">Products</h1>
              <p className="text-sm text-muted-foreground">
                Manage your jewelry inventory
              </p>
            </div>

            <Button variant="gold" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </header>

          <div className="p-6 space-y-8">
            {/* FILTER */}
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

            <GoldDivider />

            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <ProductSkeleton key={i} />
                  ))
                : filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onUpdated={fetchProducts}
                      showToast={setToastMessage}
                      onShowQR={(code: string) =>
                        handleShowBarcode(code, product.id)
                      }
                    />
                  ))}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No jewelry products found.
                </p>
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