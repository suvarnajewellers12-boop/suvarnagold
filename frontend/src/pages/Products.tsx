"use client";

import { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, RefreshCw, Loader2, Filter, Store,
  FileDown, Table as TableIcon
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BarcodeSettingsWidget from "@/components/BarcodeSettingsWidget";

// Export Utilities
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const ProductSkeleton = () => (
  <div className="h-[400px] w-full rounded-3xl bg-gray-100 animate-pulse flex flex-col p-6 space-y-4">
    <div className="flex justify-between">
      <div className="h-6 w-24 bg-gray-200 rounded-full" />
      <div className="h-8 w-8 bg-gray-200 rounded-full" />
    </div>
    <div className="h-8 w-3/4 bg-gray-200 rounded-lg" />
    <div className="space-y-2 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-10 bg-gray-200 rounded-xl" />
        <div className="h-10 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-16 bg-gray-200 rounded-2xl w-full" />
    </div>
    <div className="mt-auto flex justify-between items-end pt-4">
      <div className="h-12 w-28 bg-gray-200 rounded-xl" />
      <div className="h-12 w-12 bg-gray-200 rounded-xl" />
    </div>
  </div>
);

let productsCache: any[] | null = null;

const Products = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filters, setFilters] = useState({
    metal: "all",
    bodyPart: "all",
    category: "all",
    branch: "all",
  });

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const ORNAMENT_MAPPING = {
    head_hair: ["Tiara, Crown, Diadem", "Hair Comb, Hair Pin", "Fascinator Chain, Coronet", "Wreath (laurel), Circlet"],
    forehead: ["Frontlet, Ferronnière", "Bandeau, Brow Band"],
    ears: ["Stud, Hoop Earrings", "Drop, Chandelier Earrings", "Huggie Earrings, Ear Cuffs", "Clip-on, Threader, Crawler"],
    nose: ["Nose Ring, Nose Stud", "Septum Ring, Nose Chain, Nose Cuff"],
    neck: ["Necklace, Pendant, Choker", "Chain, Locket, Collar Necklace", "Torque/Torc, Riviere, Lavaliere", "Bib Necklace, Sautoir", "Opera, Rope Chain, Lariat"],
    chest_shoulders: ["Brooch, Fibula, Pectoral", "Shoulder Chain, Epaulette, Body Chain"],
    arms: ["Armlet, Arm Band, Upper Arm Cuff", "Arm Chain"],
    wrists: ["Bangle, Bracelet, Cuff", "Tennis, Charm, Chain Bracelet", "Slave Bracelet (hand chain)"],
    hands_fingers: ["Signet, Engagement, Wedding Band", "Cocktail, Eternity, Stackable Rings", "Knuckle Ring, Hand Harness/Chain"],
  };

  const [barcodeModal, setBarcodeModal] = useState<{
    image: string;
    productId: string;
    sku: string;
    netWeight: number;
    stoneWeight: number;
    grams: number;
    huid: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "gold",
    grams: "",
    carats: "",
    quantity: "1",
    huid: "",
    stoneWeight: "0",
    netWeight: "0",
    va: "0",
    bodyPart: "",
    category: "",
    branchName: "",
  });

  /* ---------------- EXPORT FUNCTIONS ---------------- */
  const exportToExcel = () => {
    const dataToExport = filteredProducts.map(p => ({
      "SKU": p.sku || "N/A",
      "Product Name": p.name,
      "Metal": p.metalType,
      "Quality": p.carats || "N/A",
      "Branch": p.branchName,
      "Category": p.category,
      "Body Part": p.bodyPart,
      "Grams": p.grams,
      "Stone Wt": p.stoneWeight,
      "Net Weight": p.netWeight,
      "VA (%)": p.va,
      "HUID": p.huid || "N/A",
      "Quantity": p.quantity
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(20);
    doc.setTextColor(180, 150, 50); // Gold tone
    doc.text("Suvarna Jewellery - Inventory Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exported: ${new Date().toLocaleString()} | Filter: ${filters.metal} / ${filters.branch}`, 14, 28);

    const tableColumn = ["SKU", "Name", "Branch", "Metal", "Grams", "Net Wt", "VA", "HUID", "Qty"];
    const tableRows = filteredProducts.map(p => [
      p.sku || "-",
      p.name,
      p.branchName,
      `${p.metalType} (${p.carats})`,
      p.grams,
      p.netWeight,
      `${p.va}%`,
      p.huid || "-",
      p.quantity
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [180, 150, 50] },
      styles: { fontSize: 8 }
    });

    doc.save(`Suvarna_Inventory_${Date.now()}.pdf`);
  };

  /* ---------------- AUTO CALCULATION ---------------- */
  useEffect(() => {
    const g = parseFloat(formData.grams) || 0;
    const s = parseFloat(formData.stoneWeight) || 0;
    const total = (g + s).toFixed(3);
    setFormData((prev) => ({ ...prev, netWeight: total }));
  }, [formData.grams, formData.stoneWeight]);

  /* ---------------- FETCH BRANCHES ---------------- */
  const fetchBranches = async () => {
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/admin/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.admins) {
        const uniqueBranches = Array.from(new Set(data.admins.map((a: any) => a.branchName?.trim()))) as string[];
        const validBranches = uniqueBranches.filter(b => b && b !== "");
        setBranches(validBranches);
        if (validBranches.length > 0 && !formData.branchName) {
          setFormData(prev => ({ ...prev, branchName: validBranches[0] }));
        }
      }
    } catch (error) {
      console.error("Fetch Branches Error:", error);
    }
  };

  /* ---------------- FETCH PRODUCTS ---------------- */
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
    fetchBranches();
  }, []);

  const handleShowBarcode = async (sku: string, productId: string) => {
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/barcode/${sku}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBarcodeModal({ image: data.barcodeImage, productId, sku, netWeight: data.netWeight, stoneWeight: data.stoneWeight, grams: data.grams, huid: data.huid });
      }
    } catch (err) {
      console.error("Barcode Fetch Failed", err);
    }
  };

  const handleCreateProduct = async () => {
    setIsSubmitting(true);
    setIsLoading(true);
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
          quantity: Number(formData.quantity),
          stoneWeight: parseFloat(formData.stoneWeight),
          netWeight: parseFloat(formData.netWeight),
          va: parseFloat(formData.va),
          manufactureDate: currentDate,
          branchName: formData.branchName,
          metalType: formData.type,
        }),
      });
      if (res.ok) {
        setToastMessage("Product added successfully");
        setShowToast(true);
        setShowForm(false);
        await fetchProducts(true);
        setFormData({
          name: "", type: "gold", grams: "", carats: "", bodyPart: "",
          category: "", quantity: "1", huid: "", stoneWeight: "0", netWeight: "0",
          va: "0", branchName: branches[0] || "",
        });
      }
    } catch (error) {
      console.error("Creation Error:", error);
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  /* ---------------- FILTER LOGIC ---------------- */
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const cleanMatch = (val: any, filterVal: string) => {
        if (filterVal === "all") return true;
        const normalizedVal = val?.toString().trim().toLowerCase() || "";
        const normalizedFilter = filterVal.trim().toLowerCase();
        return normalizedVal === normalizedFilter;
      };

      return (
        cleanMatch(p.metalType, filters.metal) &&
        cleanMatch(p.bodyPart, filters.bodyPart) &&
        cleanMatch(p.category, filters.category) &&
        cleanMatch(p.branchName, filters.branch)
      );
    });
  }, [products, filters]);

  const resetFilters = () => setFilters({ metal: "all", bodyPart: "all", category: "all", branch: "all" });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background font-sans">
        <DashboardSidebar />

        {/* --- ADD PRODUCT MODAL --- */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120] overflow-y-auto p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md space-y-4 my-8 shadow-2xl border border-amber-100">
              <h2 className="text-xl font-bold font-serif text-amber-900 border-b pb-2 flex items-center gap-2">
                <Plus className="w-5 h-5" /> Add New Masterpiece
              </h2>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Store className="w-3 h-3" /> Assign to Branch
                  </label>
                  <Select value={formData.branchName} onValueChange={(val) => setFormData({ ...formData, branchName: val })}>
                    <SelectTrigger className="bg-amber-50/50 border-amber-200">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent className="z-[130]">
                      {branches.map(b => (
                        <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Input
                  placeholder="Product Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-3">
                  {/* Placement Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Placement</label>
                    <Select
                      value={formData.bodyPart}
                      onValueChange={(val) => setFormData({ ...formData, bodyPart: val, category: "" })}
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-200">
                        <SelectValue placeholder="Select Placement" />
                      </SelectTrigger>
                      <SelectContent className="z-[130]">
                        <SelectItem value="head_hair">Head & Hair</SelectItem>
                        <SelectItem value="forehead">Forehead</SelectItem>
                        <SelectItem value="ears">Ears</SelectItem>
                        <SelectItem value="nose">Nose</SelectItem>
                        <SelectItem value="neck">Neck</SelectItem>
                        <SelectItem value="chest_shoulders">Chest & Shoulders</SelectItem>
                        <SelectItem value="arms">Arms</SelectItem>
                        <SelectItem value="wrists">Wrists</SelectItem>
                        <SelectItem value="hands_fingers">Hands & Fingers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Select (Filtered) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                    <Select
                      value={formData.category}
                      onValueChange={(val) => setFormData({ ...formData, category: val })}
                      disabled={!formData.bodyPart} // Disable if no placement is selected
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-200">
                        <SelectValue placeholder={formData.bodyPart ? "Select Type" : "Pick Placement first"} />
                      </SelectTrigger>
                      <SelectContent className="z-[130] max-h-[300px]">
                        {formData.bodyPart && ORNAMENT_MAPPING[formData.bodyPart]?.map((item) => (
                          <SelectItem key={item} value={item.toLowerCase().replace(/ /g, "_")}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Metal</label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val, carats: "" })}>
                      <SelectTrigger><SelectValue placeholder="Metal" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">{formData.type === "gold" ? "Carats" : "Purity"}</label>
                    <Select value={formData.carats} onValueChange={(val) => setFormData({ ...formData, carats: val })}>
                      <SelectTrigger><SelectValue placeholder="Quality" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        {formData.type === "gold" ? (
                          ["24K", "22K", "18K", "16K", "9K"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)
                        ) : (
                          ["99.9%", "95.0%", "92.5%", "70%"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Metal Grams</label>
                    <Input type="number" placeholder="Grams" value={formData.grams} onChange={(e) => setFormData({ ...formData, grams: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Stone Weight</label>
                    <Input type="number" placeholder="Stone Wt" value={formData.stoneWeight} onChange={(e) => setFormData({ ...formData, stoneWeight: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">VA (Making Charges)</label>
                    <Input type="number" placeholder="VA" value={formData.va} onChange={(e) => setFormData({ ...formData, va: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Quantity</label>
                    <Input type="number" placeholder="Qty" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <p className="text-[10px] uppercase font-bold text-amber-600 text-center">Calculated Total Weight</p>
                  <p className="text-xl font-mono font-bold text-amber-900 text-center">{formData.netWeight} g</p>
                </div>

                <Input placeholder="HUID Number" value={formData.huid} onChange={(e) => setFormData({ ...formData, huid: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleCreateProduct} className="flex-1 bg-black text-white hover:bg-gray-800" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Create Product"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* --- BARCODE MODAL --- */}
        {barcodeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg relative">
              <button
                onClick={() => setBarcodeModal(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-serif font-bold">Print Barcode Label</h2>
                  <p className="text-sm text-gray-500 mt-1">Ready for TSC TE244 (54x12mm)</p>
                </div>
                <BarcodeSettingsWidget
                  barcodeImage={barcodeModal.image}
                  sku={barcodeModal.sku}
                  netWeight={barcodeModal.netWeight}
                  stoneWeight={barcodeModal.stoneWeight}
                  grams={barcodeModal.grams}
                  huid={barcodeModal.huid}
                />
                <Button variant="outline" onClick={() => setBarcodeModal(null)} className="w-full py-6">
                  Cancel & Close
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto h-screen">
          <header className="sticky top-0 z-40 bg-background border-b px-8 py-6 flex justify-between items-center shadow-sm">
            <div>
              <h1 className="text-3xl font-serif font-bold">Treasury Products</h1>
              <p className="text-sm text-muted-foreground">Manage your jewelry collection across branches</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="hidden md:flex border-amber-200 text-amber-800">
                <TableIcon className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="hidden md:flex border-red-200 text-red-800">
                <FileDown className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" size="icon" onClick={() => fetchProducts(true)}>
                <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="gold" onClick={() => setShowForm(true)}><Plus className="w-5 h-5 mr-2" />Add Product</Button>
            </div>
          </header>

          <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-wrap gap-6 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Filter className="w-3 h-3" /> Metal</label>
                <div className="flex gap-2">
                  {["all", "gold", "silver"].map((t) => (
                    <button key={t} onClick={() => setFilters({ ...filters, metal: t })} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filters.metal === t ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "bg-gray-50 text-muted-foreground hover:bg-gray-100"}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Store className="w-3 h-3" /> Branch</label>
                <Select value={filters.branch} onValueChange={(val) => setFilters({ ...filters, branch: val })}>
                  <SelectTrigger className="w-40 text-xs h-9 bg-gray-50 border-none"><SelectValue placeholder="All Branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Placement</label>
                <Select value={filters.bodyPart} onValueChange={(val) => setFilters({ ...filters, bodyPart: val })}>
                  <SelectTrigger className="w-36 text-xs h-9 bg-gray-50 border-none"><SelectValue placeholder="All Body Parts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parts</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="ears">Ears</SelectItem>
                    <SelectItem value="nose">Nose</SelectItem>
                    <SelectItem value="neck">Neck</SelectItem>
                    <SelectItem value="wrist">Wrist</SelectItem>
                    <SelectItem value="fingers">Fingers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Category</label>
                <Select value={filters.category} onValueChange={(val) => setFilters({ ...filters, category: val })}>
                  <SelectTrigger className="w-36 text-xs h-9 bg-gray-50 border-none"><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="rings">Rings</SelectItem>
                    <SelectItem value="earrings">Earrings</SelectItem>
                    <SelectItem value="necklaces">Necklaces</SelectItem>
                    <SelectItem value="bangles">Bangles</SelectItem>
                    <SelectItem value="nosepins">Nose Pins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="ghost" className="text-xs h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold" onClick={resetFilters}>Reset All</Button>
            </div>

            <GoldDivider />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onUpdated={() => fetchProducts(true)}
                    showToast={setToastMessage}
                    onShowQR={(code: string) => handleShowBarcode(code, product.id)}
                  />
                ))
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="text-amber-200 flex justify-center"><Filter className="w-12 h-12" /></div>
                  <p className="text-muted-foreground font-serif text-lg">No pieces found matching these filters.</p>
                  <Button variant="outline" onClick={resetFilters}>Clear Filters</Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default Products;