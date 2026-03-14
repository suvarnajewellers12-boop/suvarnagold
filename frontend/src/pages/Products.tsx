"use client";

import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import BarcodeSettingsWidget from "@/components/BarcodeSettingsWidget";

let productsCache: any[] | null = null;

const Products = () => {

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filter, setFilter] = useState<"all" | "gold" | "silver" | "other">("all");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [barcodeModal, setBarcodeModal] = useState<{
    image: string;
    productId: string;
    sku: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "gold",
    grams: "",
    carats: "",
    cost: "",
    quantity: "1",
  });

  /* ---------------- FETCH PRODUCTS ---------------- */

  const fetchProducts = async (forceRefresh = false) => {

    if (!forceRefresh && productsCache !== null) {
      setProducts(productsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {

      const res = await fetch(
        "https://suvarnagold-16e5.vercel.app/api/products/all",
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

  /* ---------------- BARCODE ---------------- */

  const handleShowBarcode = async (sku: string, productId: string) => {

    try {

      const res = await fetch(
        `https://suvarnagold-16e5.vercel.app/api/products/barcode/${sku}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();

      if (res.ok) {
        setBarcodeModal({
          image: data.barcodeImage,
          productId,
          sku,
        });
      }

    } catch (err) {

      console.error("Barcode Fetch Failed", err);

    }
  };

  /* ---------------- PRINT LABEL ---------------- */

  const printBarcode = (image: string, sku: string) => {

    const printWindow = window.open("", "", "width=400,height=300");

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
      <title>Print Barcode</title>

      <style>

      @page{
        size: 80mm 12mm;
        margin:0;
      }

      body{
        margin:0;
        padding:0;
      }

      .label{
        width:80mm;
        height:12mm;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
      }

      img{
        width:30mm;
        height:8mm;
        object-fit:contain;
      }

      .sku{
        font-size:2.5mm;
        font-weight:bold;
        margin-top:1mm;
        font-family:monospace;
      }

      </style>

      </head>

      <body>

      <div class="label">

        <img src="${image}" />

        <div class="sku">${sku}</div>

      </div>

      </body>

      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  /* ---------------- CREATE PRODUCT ---------------- */

  const handleCreateProduct = async () => {

    setIsSubmitting(true);

    try {

      const currentDate = new Date().toISOString().split("T")[0];

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
            manufactureDate: currentDate,
          }),
        }
      );

      if (res.ok) {

        setToastMessage("Product added successfully");
        setShowToast(true);

        setShowForm(false);

        await fetchProducts(true);

        setFormData({
          name: "",
          type: "gold",
          grams: "",
          carats: "",
          cost: "",
          quantity: "1",
        });

      }

    } catch (error) {

      console.error("Creation Error:", error);

    } finally {

      setIsSubmitting(false);

    }
  };

  const filteredProducts =
    filter === "all"
      ? products
      : products.filter((p) =>
          p.metalType?.toLowerCase().includes(filter.toLowerCase())
        );

  return (

<SidebarProvider>

<div className="min-h-screen flex w-full bg-background">

<DashboardSidebar />

{/* ADD PRODUCT MODAL */}

{showForm && (

<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120]">

<div className="bg-white rounded-2xl p-8 w-[420px] space-y-4">

<h2 className="text-xl font-bold">Add Product</h2>

<Input
placeholder="Product Name"
value={formData.name}
onChange={(e)=>setFormData({...formData,name:e.target.value})}
/>

<Input
placeholder="Weight (grams)"
value={formData.grams}
onChange={(e)=>setFormData({...formData,grams:e.target.value})}
/>

<Input
placeholder="Carats"
value={formData.carats}
onChange={(e)=>setFormData({...formData,carats:e.target.value})}
/>

<Input
placeholder="Cost"
value={formData.cost}
onChange={(e)=>setFormData({...formData,cost:e.target.value})}
/>

<div className="flex gap-3">

<Button
onClick={handleCreateProduct}
className="flex-1"
disabled={isSubmitting}
>
{isSubmitting ? <Loader2 className="animate-spin"/> : "Create"}
</Button>

<Button
variant="outline"
onClick={()=>setShowForm(false)}
className="flex-1"
>
Cancel
</Button>

</div>

</div>

</div>

)}

{/* BARCODE MODAL */}

{barcodeModal && (

<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">

<div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg space-y-6">

<h2 className="text-2xl font-serif font-bold text-center">
Barcode Label Calibration
</h2>

<BarcodeSettingsWidget
barcodeImage={barcodeModal.image}
sku={barcodeModal.sku}
/>

<div className="flex flex-col gap-3">

<button
onClick={()=>printBarcode(barcodeModal.image,barcodeModal.sku)}
className="w-full bg-black text-white py-3 rounded-xl font-bold"
>
Print Label
</button>

<button
onClick={()=>setBarcodeModal(null)}
className="text-sm text-gray-500"
>
Close
</button>

</div>

</div>

</div>

)}

{/* MAIN */}

<main className="flex-1 overflow-auto h-screen">

<header className="sticky top-0 z-40 bg-background border-b px-8 py-6 flex justify-between">

<div>

<h1 className="text-3xl font-serif font-bold">
Treasury Products
</h1>

<p className="text-sm text-muted-foreground">
Manage your jewelry collection
</p>

</div>

<div className="flex gap-3">

<Button
variant="outline"
size="icon"
onClick={()=>fetchProducts(true)}
>
<RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin":""}`} />
</Button>

<Button
variant="gold"
onClick={()=>setShowForm(true)}
>
<Plus className="w-5 h-5 mr-2"/>
Add Product
</Button>

</div>

</header>

<div className="p-8 space-y-8 max-w-[1600px] mx-auto">

<div className="flex gap-2">

{(["all","gold","silver","other"] as const).map((t)=>(
<button
key={t}
onClick={()=>setFilter(t)}
className={`px-6 py-2 rounded-xl text-xs font-bold uppercase ${
filter===t ? "bg-amber-500 text-white":"text-muted-foreground"
}`}
>
{t}
</button>
))}

</div>

<GoldDivider/>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">

{filteredProducts.map((product)=>(
<ProductCard
key={product.id}
product={product}
onUpdated={()=>fetchProducts(true)}
showToast={setToastMessage}
onShowQR={(code:string)=>handleShowBarcode(code,product.id)}
/>
))}

</div>

</div>

</main>

</div>

<SuccessToast
message={toastMessage}
isVisible={showToast}
onClose={()=>setShowToast(false)}
/>

</SidebarProvider>

);

};

export default Products;