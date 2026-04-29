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
  FileDown, Table as TableIcon, X, Printer, CheckSquare,
  Trash2, Layers, Tag, Scissors, Sparkles, ShieldCheck
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
// UPDATED: Now using the Bulk Barcode Printer component
import BulkBarcodePrinter from "../components/BulkBarcodePrinter";

// Export Utilities
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

/**
 * PRODUCT SKELETON LOADER
 * Provides a high-fidelity shimmer effect while inventory is being synchronized
 * from the Suvarna Backend API.
 */
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

const STORE_INFO = {
  name: "Suvarna Jewellers",
  hq: "Visakhapatnam, Andhra Pradesh",
  exportNote: "Official Inventory Registry",
};

const Products = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ---------------------------------------------------------------------------
  // 1. CORE DATA STATES
  // ---------------------------------------------------------------------------
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NEW: Bulk Printing Queue State
  const [printQueue, setPrintQueue] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    metal: "all",
    bodyPart: "all",
    category: "all",
    branch: "all",
  });

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. ORNAMENT CATEGORY DEFINITIONS
  // ---------------------------------------------------------------------------
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
    stoneCost: "0",
  });

  // ---------------------------------------------------------------------------
  // 3. BULK PRINTING HANDLERS
  // ---------------------------------------------------------------------------
  const toggleSelection = (product: any) => {
    setPrintQueue(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.filter(item => item.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const selectAllFiltered = () => {
    setPrintQueue(filteredProducts);
    setToastMessage(`Added ${filteredProducts.length} items to print queue`);
    setShowToast(true);
  };

  // ---------------------------------------------------------------------------
  // 4. EXPORT UTILITIES (EXCEL & PDF)
  // ---------------------------------------------------------------------------
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
      "Quantity": p.quantity,
      "Stone Cost": p.stoneCost || "0",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, `Suvarna_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);

    setToastMessage("Inventory Excel file generated.");
    setShowToast(true);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(22);
    doc.setTextColor(120, 80, 20); // Deep Gold
    doc.text("SUVARNA JEWELLERS", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${STORE_INFO.hq} | Inventory Registry`, 14, 25);
    doc.text(`Exported: ${new Date().toLocaleString()} | Items: ${filteredProducts.length}`, 14, 30);

    const tableColumn = ["SKU", "Name", "Branch", "Metal", "Grams", "Stone Weight", "Net Wt", "VA", "HUID", "Qty", "Stone Cost"];
    const tableRows = filteredProducts.map(p => [
      p.sku || "-",
      p.name.toUpperCase(),
      p.branchName,
      `${p.metalType} (${p.carats})`,
      p.grams,
      p.stoneWeight,
      p.netWeight,
      `${p.va}%`,
      p.huid || "-",
      p.quantity,
      p.stoneCost || "0"
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [250, 248, 240] }
    });

    doc.save(`Suvarna_Registry_${Date.now()}.pdf`);
    setToastMessage("Inventory PDF file generated.");
    setShowToast(true);
  };

  // ---------------------------------------------------------------------------
  // 5. AUTO CALCULATION & DATA SYNC
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const g = parseFloat(formData.grams) || 0;
    const s = parseFloat(formData.stoneWeight) || 0;
    const total = (g + s).toFixed(3);
    setFormData((prev) => ({ ...prev, netWeight: total }));
  }, [formData.grams, formData.stoneWeight]);

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
      setToastMessage("Critical: Failed to synchronize treasury.");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchBranches();
  }, []);

  // ---------------------------------------------------------------------------
  // 6. CREATION LOGIC
  // ---------------------------------------------------------------------------
  const handleCreateProduct = async () => {
    if (!formData.name || !formData.grams) {
      setToastMessage("Please provide at least Name and Weight.");
      setShowToast(true);
      return;
    }

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
          stoneCost: parseFloat(formData.stoneCost),
          manufactureDate: currentDate,
          branchName: formData.branchName,
          metalType: formData.type,
        }),
      });
      if (res.ok) {
        setToastMessage("Masterpiece added to collection");
        setShowToast(true);
        setShowForm(false);
        await fetchProducts(true);
        setFormData({
          name: "", type: "gold", grams: "", carats: "", bodyPart: "",
          category: "", quantity: "1", huid: "", stoneWeight: "0", netWeight: "0",
          va: "0", branchName: branches[0] || "", stoneCost: "0"
        });
      } else {
        const err = await res.json();
        setToastMessage(`Error: ${err.error}`);
        setShowToast(true);
      }
    } catch (error) {
      console.error("Creation Error:", error);
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. FILTERING & MEMOIZATION
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 8. RENDER LOGIC
  // ---------------------------------------------------------------------------
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#fdfcf9] font-sans">
        <DashboardSidebar />

        {/* --- ADD PRODUCT MODAL --- */}
        {/* --- ADD PRODUCT MODAL --- */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200">
            {/* Reduced max-width from max-w-lg to max-w-md and adjusted padding */}
            <div className="bg-white rounded-[1.5rem] p-6 w-full max-w-md space-y-4 shadow-2xl border border-amber-100 max-h-[95vh] overflow-y-auto custom-scrollbar relative">

              {/* Header - Made more compact */}
              <div className="flex justify-between items-center border-b border-amber-100 pb-3">
                <h2 className="text-lg font-serif font-black text-amber-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-600" /> New Masterpiece
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowForm(false)}
                  className="rounded-full h-8 w-8 hover:bg-red-50 hover:text-red-500"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-3">
                {/* Branch Selection - Reduced heights from h-12 to h-10 */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Branch Origin</label>
                  <Select value={formData.branchName} onValueChange={(val) => setFormData({ ...formData, branchName: val })}>
                    <SelectTrigger className="h-10 bg-amber-50/30 border-amber-100 rounded-lg focus:ring-amber-500">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent className="z-[130]">
                      {branches.map(b => (
                        <SelectItem key={b} value={b} className="capitalize font-bold text-xs">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Display Name */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Display Name</label>
                  <Input
                    placeholder="e.g., Antique Gold Haram"
                    value={formData.name}
                    className="h-10 border-amber-50 rounded-lg focus:border-amber-400 focus:ring-0 text-xs"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Placement & Type Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Placement</label>
                    <Select value={formData.bodyPart} onValueChange={(val) => setFormData({ ...formData, bodyPart: val, category: "" })}>
                      <SelectTrigger className="h-10 bg-white border-amber-50 rounded-lg text-xs">
                        <SelectValue placeholder="Select Area" />
                      </SelectTrigger>
                      <SelectContent className="z-[130]">
                        <SelectItem value="head_hair">Head & Hair</SelectItem>
                        <SelectItem value="forehead">Forehead</SelectItem>
                        <SelectItem value="ears">Ears</SelectItem>
                        <SelectItem value="nose">Nose</SelectItem>
                        <SelectItem value="neck">Neck</SelectItem>
                        <SelectItem value="wrists">Wrists</SelectItem>
                        <SelectItem value="hands_fingers">Hands & Fingers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Type</label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })} disabled={!formData.bodyPart}>
                      <SelectTrigger className="h-10 bg-white border-amber-50 rounded-lg text-xs">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="z-[130] max-h-[200px]">
                        {formData.bodyPart && ORNAMENT_MAPPING[formData.bodyPart as keyof typeof ORNAMENT_MAPPING]?.map((item) => (
                          <SelectItem key={item} value={item.toLowerCase().replace(/ /g, "_")} className="text-xs">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Metal Base & Purity Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Metal Base</label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val, carats: "" })}>
                      <SelectTrigger className="h-10 border-amber-50 rounded-lg text-xs"><SelectValue placeholder="Metal" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        <SelectItem value="gold" className="font-bold text-amber-600 text-xs">Gold</SelectItem>
                        <SelectItem value="silver" className="font-bold text-slate-500 text-xs">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Purity</label>
                    <Select value={formData.carats} onValueChange={(val) => setFormData({ ...formData, carats: val })}>
                      <SelectTrigger className="h-10 border-amber-50 rounded-lg text-xs"><SelectValue placeholder="Quality" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        {formData.type === "gold" ? (
                          ["24K", "22K", "18K", "14K", "9K"].map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)
                        ) : (
                          ["99.9%", "92.5%", "70%"].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Weights Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Metal Wt (g)</label>
                    <Input type="number" placeholder="0.000" value={formData.grams} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData({ ...formData, grams: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Stone Wt (g)</label>
                    <Input type="number" placeholder="0.000" value={formData.stoneWeight} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData({ ...formData, stoneWeight: e.target.value })} />
                  </div>
                </div>

                {/* VA & Stone Cost Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">VA %</label>
                    <Input type="number" placeholder="0%" value={formData.va} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData({ ...formData, va: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Stone Cost</label>
                    <Input type="number" placeholder="₹0" value={formData.stoneCost} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData({ ...formData, stoneCost: e.target.value })} />
                  </div>
                </div>

                {/* Calculated Weight - Made much smaller */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-3 rounded-xl border border-amber-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[8px] uppercase font-black text-amber-600 tracking-widest">Aggregated Net Weight</p>
                      <p className="text-2xl font-mono font-black text-amber-900 tracking-tighter">{formData.netWeight} <span className="text-xs font-serif">g</span></p>
                    </div>
                    <Layers className="w-6 h-6 text-amber-200/50" />
                  </div>
                </div>

                {/* HUID */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">HUID Serial</label>
                  <Input placeholder="Enter HUID" value={formData.huid} className="h-10 border-amber-50 rounded-lg focus:border-amber-400 text-xs" onChange={(e) => setFormData({ ...formData, huid: e.target.value })} />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">Discard</Button>
                <Button onClick={handleCreateProduct} className="flex-[2] h-11 rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-lg font-black uppercase text-[10px] tracking-widest" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Finalize Entry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- BULK PRINTER WIDGET --- */}
        {printQueue.length > 0 && (
          <BulkBarcodePrinter
            queue={printQueue}
            onClearQueue={() => setPrintQueue([])}
            onRemoveFromQueue={(id) => setPrintQueue(prev => prev.filter(item => item.id !== id))}
          />
        )}

        <main className="flex-1 overflow-auto h-screen custom-scrollbar">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-amber-50 px-10 py-8 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-amber-600 p-2.5 rounded-2xl shadow-lg shadow-amber-200">
                  <Plus className="text-white w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-4xl font-serif font-black tracking-tight text-amber-950 italic">Inventory Vault</h1>
                  <p className="text-[11px] text-amber-700 font-black uppercase tracking-[0.3em] mt-1 ml-1 opacity-60">Suvarna Luxury Collection</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* BULK ACTION PANEL */}
              {filteredProducts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllFiltered}
                  className="rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-900 font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  <CheckSquare className="w-4 h-4 mr-2" /> Select Visible
                </Button>
              )}

              <div className="h-10 w-[2px] bg-amber-50 mx-2" />

              <Button variant="outline" size="sm" onClick={exportToExcel} className="hidden md:flex rounded-xl border-amber-200 text-amber-800 font-bold hover:bg-amber-50">
                <TableIcon className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="hidden md:flex rounded-xl border-red-200 text-red-800 font-bold hover:bg-red-50">
                <FileDown className="w-4 h-4 mr-2" /> Registry PDF
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl border-2" onClick={() => fetchProducts(true)}>
                <RefreshCw className={`w-5 h-5 text-amber-600 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="gold" className="h-12 px-8 rounded-2xl shadow-xl shadow-amber-100 font-black uppercase tracking-widest text-xs" onClick={() => setShowForm(true)}>
                <Plus className="w-5 h-5 mr-2 stroke-[3px]" /> Add Masterpiece
              </Button>
            </div>
          </header>

          <div className="p-10 space-y-10 max-w-[1700px] mx-auto">
            {/* ADVANCED FILTERING SUITE */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-amber-50/50 border-2 border-amber-50 flex flex-wrap gap-8 items-end relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-40 blur-3xl" />

              <div className="space-y-2 relative z-10">
                <label className="text-[10px] font-black text-amber-900/40 uppercase flex items-center gap-2 tracking-[0.2em] ml-1">
                  <Filter className="w-3.5 h-3.5" /> Filter: Metal Base
                </label>
                <div className="flex gap-2 p-1 bg-amber-50/50 rounded-xl border border-amber-100">
                  {["all", "gold", "silver"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilters({ ...filters, metal: t })}
                      className={cn(
                        "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        filters.metal === t
                          ? "bg-amber-600 text-white shadow-lg shadow-amber-200 scale-105"
                          : "text-amber-800/60 hover:text-amber-600"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <Store className="w-3.5 h-3.5" /> Branch Location
                </label>
                <Select value={filters.branch} onValueChange={(val) => setFilters({ ...filters, branch: val })}>
                  <SelectTrigger className="w-48 text-xs font-bold h-11 bg-white border-2 border-amber-50 rounded-xl focus:ring-amber-500 shadow-sm">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-amber-100">
                    <SelectItem value="all" className="font-bold">Global Registry</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b} value={b} className="capitalize font-bold">{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1">Body Placement</label>
                <Select value={filters.bodyPart} onValueChange={(val) => setFilters({ ...filters, bodyPart: val })}>
                  <SelectTrigger className="w-44 text-xs font-bold h-11 bg-white border-2 border-amber-50 rounded-xl shadow-sm">
                    <SelectValue placeholder="All Parts" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-amber-100">
                    <SelectItem value="all" className="font-bold uppercase tracking-tighter">Every Part</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="ears">Ears</SelectItem>
                    <SelectItem value="nose">Nose</SelectItem>
                    <SelectItem value="neck">Neck</SelectItem>
                    <SelectItem value="wrist">Wrist</SelectItem>
                    <SelectItem value="fingers">Fingers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" /> Piece Category
                </label>
                <Select value={filters.category} onValueChange={(val) => setFilters({ ...filters, category: val })}>
                  <SelectTrigger className="w-44 text-xs font-bold h-11 bg-white border-2 border-amber-50 rounded-xl shadow-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-amber-100">
                    <SelectItem value="all" className="font-bold">Total Collection</SelectItem>
                    <SelectItem value="rings">Rings</SelectItem>
                    <SelectItem value="earrings">Earrings</SelectItem>
                    <SelectItem value="necklaces">Necklaces</SelectItem>
                    <SelectItem value="bangles">Bangles</SelectItem>
                    <SelectItem value="nosepins">Nose Pins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                className="h-11 px-6 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
            </div>

            <div className="py-4">
              <GoldDivider opacity={30} />
            </div>

            {/* INVENTORY DISPLAY GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onUpdated={() => fetchProducts(true)}
                    showToast={setToastMessage}
                    // Selection logic for bulk printing
                    isSelected={!!printQueue.find(item => item.id === product.id)}
                    onToggle={toggleSelection}
                  />
                ))
              ) : (
                <div className="col-span-full py-40 text-center space-y-6 bg-white/50 rounded-[3rem] border-4 border-dashed border-amber-100/50">
                  <div className="text-amber-200 flex justify-center"><PackageSearch size={80} className="animate-bounce" /></div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-serif font-black text-amber-900 italic">No Artifacts Uncovered</h3>
                    <p className="text-muted-foreground font-serif text-lg opacity-60">Adjust your criteria to reveal hidden treasures from the registry.</p>
                  </div>
                  <Button variant="gold" size="lg" className="h-14 px-10 rounded-2xl shadow-xl shadow-amber-200" onClick={resetFilters}>
                    Restore Full Registry View
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* TERMINAL FOOTER DECORATION */}
          <footer className="p-20 text-center opacity-20 flex flex-col items-center gap-4">
            <div className="h-[2px] w-40 bg-amber-900" />
            <p className="text-[10px] font-black uppercase tracking-[1em] text-amber-900">End of Inventory Registry</p>
            <p className="text-xs font-serif italic text-amber-900 max-w-sm">
              Proprietary Inventory System for Suvarna Jewellers. Unauthorized reproduction of stock data is strictly prohibited.
            </p>
          </footer>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

// SVG Placeholder icons to fulfill missing imports in current context
const PackageSearch = ({ className, size }: { className?: string, size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /><path d="M11 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0" /><path d="m20 21-1.5-1.5" /></svg>
);

const CheckSquare = ({ className, size }: { className?: string, size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 11 3 3L22 4" /></svg>
);

export default Products;