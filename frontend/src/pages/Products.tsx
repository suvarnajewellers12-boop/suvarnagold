"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, RefreshCw, Loader2, Filter, Store,
  FileDown, Table as TableIcon, X, CheckSquare,
  Trash2, Layers, Tag, ShieldCheck, Search as SearchIcon, PackageSearch
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BulkBarcodePrinter from "../components/BulkBarcodePrinter";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const ITEMS_PER_ROW_MAX = 4; // xl:grid-cols-4
const ROW_SELECT_BATCH = 25;
const VIRTUAL_OVERSCAN = 3; // extra rows rendered above/below viewport
const CARD_HEIGHT_PX = 440; // approximate card height (px) — tune to your actual card
const GAP_PX = 40;          // gap-10 = 2.5rem = 40px

const STORE_INFO = {
  name: "Suvarna Jewellers",
  hq: "Visakhapatnam, Andhra Pradesh",
  exportNote: "Official Inventory Registry",
};

const ORNAMENT_MAPPING: Record<string, string[]> = {
  head_hair: ["Tiara, Crown, Diadem", "Hair Comb, Hair Pin", "Fascinator Chain, Coronet", "Wreath (laurel), Circlet"],
  forehead: ["Frontlet, Ferronnière", "Bandeau, Brow Band"],
  ears: ["Stud, Hoop Earrings", "Drop, Chandelier Earrings", "Huggie Earrings, Ear Cuffs", "Clip-on, Threader, Crawler"],
  nose: ["Nose Ring, Nose Stud", "Septum Ring, Nose Chain, Nose Cuff"],
  neck: ["Necklace, Pendant, Choker", "Chain, Locket, Collar Necklace", "Torque/Torc, Riviere, Lavaliere", "Bib Necklace, Sautoir", "Opera, Rope Chain, Lariat"],
  chest_shoulders: ["Brooch, Fibula, Pectoral", "Shoulder Chain, Epaulette, Body Chain"],
  arms: ["Armlet, Arm Band, Upper Arm Cuff", "Arm Chain"],
  wrists: ["Bangle, Bracelet, Cuff", "Tennis, Charm, Chain Bracelet", "Slave Bracelet (hand chain)"],
  hands_fingers: ["Signet, Engagement, Wedding Band", "Cocktail, Eternity, Stackable Rings", "Knuckle Ring, Hand Harness/Chain"],
  others: ["other"]
};

let productsCache: any[] | null = null;

// ─────────────────────────────────────────────────────────
// SKELETON — memoized so it never re-renders
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// VIRTUALISED GRID
// Only renders cards that are (or are near) the viewport.
// No external dependency — uses a scroll listener on the
// parent <main> element and simple index math.
// ─────────────────────────────────────────────────────────
interface VirtualGridProps {
  products: any[];
  printQueueIds: Set<string>;
  onToggle: (product: any) => void;
  onSelectRow: (startIndex: number) => void;
  onRemoveRow: (startIndex: number) => void;
  onUpdated: () => void;
  onDeleted: () => void;
  showToast: (msg: string) => void;
  columnsCount: number; // determined by container width
}

const VirtualGrid: React.FC<VirtualGridProps> = ({
  products,
  printQueueIds,
  onToggle,
  onSelectRow,
  onRemoveRow,
  onUpdated,
  onDeleted,
  showToast,
  columnsCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  // containerOffsetTop = distance (px) from scroll-parent's content top to our grid top
  const containerOffsetTopRef = useRef<number>(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  const ROW_HEIGHT = CARD_HEIGHT_PX + GAP_PX;
  const totalRows = Math.ceil(products.length / columnsCount);
  const totalHeight = totalRows * ROW_HEIGHT;

  // Find the closest scrollable ancestor (the <main> element)
  useEffect(() => {
    let el: HTMLElement | null = containerRef.current?.parentElement ?? null;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        scrollParentRef.current = el;
        break;
      }
      el = el.parentElement;
    }
    // Fall back to the document root if nothing found
    if (!scrollParentRef.current) {
      scrollParentRef.current = document.documentElement;
    }
  }, []);

  // Measure and track everything on scroll + resize
  useEffect(() => {
    const parent = scrollParentRef.current;
    if (!parent) return;

    const measure = () => {
      if (!containerRef.current) return;
      // getBoundingClientRect().top is viewport-relative.
      // parent.getBoundingClientRect().top is also viewport-relative.
      // So: container's distance from scroll-parent top edge (in content space)
      //   = parent.scrollTop + (containerRect.top - parentRect.top)
      const containerRect = containerRef.current.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      containerOffsetTopRef.current =
        parent.scrollTop + (containerRect.top - parentRect.top);
      setContainerHeight(parent.clientHeight);
      setScrollTop(parent.scrollTop);
    };

    const onScroll = () => {
      setScrollTop(parent.scrollTop);
    };

    const onResize = () => measure();

    parent.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    // Initial measurement — defer one frame so layout is complete
    requestAnimationFrame(measure);

    return () => {
      parent.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Re-measure containerOffsetTop whenever products list changes (filters, search)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!containerRef.current || !scrollParentRef.current) return;
      const parent = scrollParentRef.current;
      const containerRect = containerRef.current.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      containerOffsetTopRef.current =
        parent.scrollTop + (containerRect.top - parentRect.top);
    });
  }, [products]);

  // Calculate which rows are visible
  const { startRow, endRow } = useMemo(() => {
    // How far the user has scrolled past the top of our grid
    const scrolledPastGrid = scrollTop - containerOffsetTopRef.current;

    // If we haven't reached the grid yet, start from row 0
    const firstVisible = scrolledPastGrid > 0
      ? Math.floor(scrolledPastGrid / ROW_HEIGHT)
      : 0;

    const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT);

    return {
      startRow: Math.max(0, firstVisible - VIRTUAL_OVERSCAN),
      endRow: Math.min(totalRows - 1, firstVisible + visibleRows + VIRTUAL_OVERSCAN),
    };
  }, [scrollTop, containerHeight, totalRows, ROW_HEIGHT]);

  const visibleItems = useMemo(() => {
    const items: Array<{ product: any; index: number; top: number }> = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columnsCount; col++) {
        const index = row * columnsCount + col;
        if (index >= products.length) break;
        items.push({ product: products[index], index, top: row * ROW_HEIGHT });
      }
    }
    return items;
  }, [startRow, endRow, products, columnsCount, ROW_HEIGHT]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: totalHeight }}
    >
      {visibleItems.map(({ product, index, top }) => {
        const col = index % columnsCount;
        // Correct CSS calc for equal-width columns with fixed px gaps:
        //   card width  = (100% - (cols-1)*GAP) / cols
        //   card left   = col * (cardWidth + GAP)
        const totalGapPx = (columnsCount - 1) * GAP_PX;
        const cardW = columnsCount > 1
          ? `calc((100% - ${totalGapPx}px) / ${columnsCount})`
          : "100%";
        const cardLeft = col === 0
          ? "0px"
          : `calc(${col} * ((100% - ${totalGapPx}px) / ${columnsCount} + ${GAP_PX}px))`;

        return (
          <div
            key={product.id}
            style={{
              position: "absolute",
              top,
              left: cardLeft,
              width: cardW,
              height: CARD_HEIGHT_PX,
            }}
          >
            <ProductCard
              product={product}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              showToast={showToast}
              isSelected={printQueueIds.has(product.id)}
              onToggle={onToggle}
              productIndex={index}
              onSelectRow={onSelectRow}
              onRemoveRow={onRemoveRow}
            />
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// USE COLUMNS HOOK — tracks container width → column count
// ─────────────────────────────────────────────────────────
function useColumnsCount(ref: React.RefObject<HTMLDivElement>) {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w < 640) setCols(1);
      else if (w < 1024) setCols(2);
      else if (w < 1280) setCols(3);
      else setCols(4);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return cols;
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
const Products = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // printQueue stored as Map for O(1) lookup
  const [printQueueMap, setPrintQueueMap] = useState<Map<string, any>>(new Map());
  const printQueueIds = useMemo(() => new Set(printQueueMap.keys()), [printQueueMap]);
  const printQueue = useMemo(() => Array.from(printQueueMap.values()), [printQueueMap]);

  const [filters, setFilters] = useState({
    metal: "all",
    bodyPart: "all",
    category: "all",
    branch: "all",
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const columnsCount = useColumnsCount(gridRef);

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
    // New fields added below for the Silver 92.5% logic:
    pricingBasis: "grams",
    pieceCost: ""
  });

  // ── toast helper ──────────────────────────────────────
  const fireToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  }, []);

  // ── bulk selection ────────────────────────────────────
  const toggleSelection = useCallback((product: any) => {
    setPrintQueueMap(prev => {
      const next = new Map(prev);
      next.has(product.id) ? next.delete(product.id) : next.set(product.id, product);
      return next;
    });
  }, []);

  const filteredProductsRef = useRef<any[]>([]);

  /**
   * ROW TOGGLE — single handler used for BOTH onSelectRow and onRemoveRow.
   * • If ALL 25 items in the batch are already in the queue → remove them all.
   * • Otherwise → add any that are missing.
   * This means clicking a row-select button always toggles the entire batch,
   * regardless of which prop name ProductCard uses to call it.
   */
  const selectOrToggleRow = useCallback((startIndex: number) => {
    const list = filteredProductsRef.current;
    const end = Math.min(startIndex + ROW_SELECT_BATCH, list.length);
    const batch = list.slice(startIndex, end);
    if (batch.length === 0) return;

    // Capture current queue state BEFORE setState to determine correct toast
    setPrintQueueMap(prev => {
      const allSelected = batch.every(p => prev.has(p.id));
      const next = new Map(prev);
      if (allSelected) {
        batch.forEach(p => next.delete(p.id));
        // Schedule toast after state update
        setTimeout(() => fireToast(`Removed ${batch.length} items from batch`), 0);
      } else {
        batch.forEach(p => { if (!next.has(p.id)) next.set(p.id, p); });
        setTimeout(() => fireToast(`Added ${batch.length} items to batch`), 0);
      }
      return next;
    });
  }, [fireToast]);

  // Alias — ProductCard may call onRemoveRow separately; both route through the same toggle.
  const removeRowFromQueue = selectOrToggleRow;

  const selectAllFiltered = useCallback(() => {
    const all = filteredProductsRef.current;
    setPrintQueueMap(prev => {
      const next = new Map(prev);
      all.forEach(p => next.set(p.id, p));
      return next;
    });
    fireToast(`Added ${all.length} items to print queue`);
  }, [fireToast]);

  // ── exports ───────────────────────────────────────────
  const exportToExcel = useCallback(() => {
    const fp = filteredProductsRef.current;
    const getWeightValue = (p: any) => {
      const isSilver925 = p.metalType === "silver" && String(p.carats).trim() === "92.5%";
      return isSilver925 && Number(p.pieceCost) > 0 ? p.pieceCost : p.grams;
    };

    const dataToExport = fp.map(p => ({
      "SKU": p.sku || "N/A",
      "Product Name": p.name,
      "Metal": p.metalType,
      "Quality": p.carats || "N/A",
      "Branch": p.branchName,
      "Category": p.category,
      "Body Part": p.bodyPart,
      "Grams / Piece Cost": getWeightValue(p),
      "Stone Wt": p.stoneWeight,
      "Net Weight": p.netWeight,
      "VA (%)": p.va,
      "HUID": p.itemCode || "N/A",
      "Quantity": p.quantity,
      "Stone Cost": p.stoneCost || "0",
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, `Suvarna_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    fireToast("Inventory Excel file generated.");
  }, [fireToast]);

  const exportToPDF = useCallback(() => {
    const fp = filteredProductsRef.current;
    const getWeightValue = (p: any) => {
      const isSilver925 = p.metalType === "silver" && String(p.carats).trim() === "92.5%";
      return isSilver925 && Number(p.pieceCost) > 0 ? p.pieceCost : p.grams;
    };

    const doc = new jsPDF('landscape');
    doc.setFontSize(22);
    doc.setTextColor(120, 80, 20);
    doc.text("SUVARNA JEWELLERS", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${STORE_INFO.hq} | Inventory Registry`, 14, 25);
    doc.text(`Exported: ${new Date().toLocaleString()} | Items: ${fp.length}`, 14, 30);
    const tableColumn = ["SKU", "Name", "Branch", "Metal", "Grams / Piece Cost", "Stone Weight", "Net Wt", "VA", "HUID", "Qty", "Stone Cost"];
    const tableRows = fp.map(p => [
      p.sku || "-", p.name.toUpperCase(), p.branchName,
      `${p.metalType} (${p.carats})`, getWeightValue(p), p.stoneWeight,
      p.netWeight, `${p.va}%`, p.itemCode || "-", p.quantity, p.stoneCost || "0"
    ]);
    autoTable(doc, {
      head: [tableColumn], body: tableRows, startY: 38, theme: 'grid',
      headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [250, 248, 240] }
    });
    doc.save(`Suvarna_Registry_${Date.now()}.pdf`);
    fireToast("Inventory PDF file generated.");
  }, [fireToast]);

  // ── net weight auto-calc ──────────────────────────────
  useEffect(() => {
    const g = parseFloat(formData.grams) || 0;
    const s = parseFloat(formData.stoneWeight) || 0;
    setFormData(prev => ({ ...prev, netWeight: (g + s).toFixed(3) }));
  }, [formData.grams, formData.stoneWeight]);

  // ── data fetching ─────────────────────────────────────
  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/admin/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.admins) {
        const uniqueBranches = Array.from(
          new Set(data.admins.map((a: any) => a.branchName?.trim()))
        ).filter(Boolean) as string[];
        setBranches(uniqueBranches);
        if (uniqueBranches.length > 0) {
          setFormData(prev => prev.branchName ? prev : { ...prev, branchName: uniqueBranches[0] });
        }
      }
    } catch (e) { console.error("Fetch Branches Error:", e); }
  }, [token]);

  const fetchProducts = useCallback(async (forceRefresh = false) => {
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
      const fetched = data.products || [];
      productsCache = fetched;
      setProducts(fetched);
    } catch (e) {
      console.error("Fetch Error:", e);
      fireToast("Critical: Failed to synchronize treasury.");
    } finally {
      setIsLoading(false);
    }
  }, [token, fireToast]);

  useEffect(() => {
    fetchProducts();
    fetchBranches();
  }, []);
// ── create product ────────────────────────────────────
  const handleCreateProduct = useCallback(async () => {
    // 1. Check if the user is in 92.5% Silver "Piece Cost" mode
    const isPieceCostMode = 
      formData.type === "silver" && 
      formData.carats === "92.5%" && 
      formData.pricingBasis === "piece";

    // 2. Enforce Name validation (always required)
    if (!formData.name) {
      fireToast("Please provide a Display Name.");
      return;
    }

    // 3. Enforce Grams validation ONLY if not using Piece Cost
    if (!isPieceCostMode && (!formData.grams || parseFloat(formData.grams) <= 0)) {
      fireToast("Please provide the Metal Weight (g).");
      return;
    }

    // 4. Enforce Piece Cost validation ONLY if using Piece Cost
    if (isPieceCostMode && (!formData.pieceCost || parseFloat(formData.pieceCost) <= 0)) {
      fireToast("Please provide the Piece Cost.");
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          grams: parseFloat(formData.grams) || 0,
          quantity: Number(formData.quantity) || 1,
          stoneWeight: parseFloat(formData.stoneWeight) || 0,
          netWeight: parseFloat(formData.netWeight) || 0,
          va: parseFloat(formData.va) || 0,
          stoneCost: parseFloat(formData.stoneCost) || 0,
          pieceCost: parseFloat(formData.pieceCost) || 0, // Sending the piece cost
          manufactureDate: currentDate,
          branchName: formData.branchName,
          metalType: formData.type,
          itemCode: formData.huid ? formData.huid.toUpperCase() : "",
        }),
      });
      if (res.ok) {
        fireToast("Masterpiece added to collection");
        setShowForm(false);
        await fetchProducts(true);
        // Reset form, including the new Piece Cost states
        setFormData({
          name: "", type: "gold", grams: "", carats: "", bodyPart: "",
          category: "", quantity: "1", huid: "", stoneWeight: "0", netWeight: "0",
          va: "0", branchName: branches[0] || "", stoneCost: "0",
          pricingBasis: "grams", pieceCost: "" // <-- Added reset here
        });
      } else {
        const err = await res.json();
        fireToast(`Error: ${err.error}`);
      }
    } catch (e) { 
      console.error("Creation Error:", e); 
      fireToast("Failed to create masterpiece.");
    } finally { 
      setIsSubmitting(false); 
      setIsLoading(false); 
    }
  }, [formData, token, branches, fetchProducts, fireToast]);
  // ── filtering (memoised) ──────────────────────────────
  const filteredProducts = useMemo(() => {
    const cleanMatch = (val: any, filterVal: string, secondVal?: any) => {
      if (filterVal === "all") return true;
      if (filterVal === "silver-92.5") {
        return String(val).trim().toLowerCase() === "silver" && String(secondVal).trim() === "92.5%";
      }
      return (val?.toString().trim().toLowerCase() || "") === filterVal.trim().toLowerCase();
    };
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p =>
      cleanMatch(p.metalType, filters.metal, p.carats) &&
      cleanMatch(p.bodyPart, filters.bodyPart) &&
      cleanMatch(p.category, filters.category) &&
      cleanMatch(p.branchName, filters.branch) &&
      (!q || (p.sku?.toString().toLowerCase() || "").includes(q) ||
        (p.name?.toString().toLowerCase() || "").includes(q) ||
        (p.itemCode?.toString().toLowerCase() || "").includes(q) ||
        (p.grams?.toString().toLowerCase() || "").includes(q))
    );
  }, [products, filters, searchQuery]);

  // Keep ref in sync so callbacks always see latest filteredProducts
  useEffect(() => { filteredProductsRef.current = filteredProducts; }, [filteredProducts]);

  const resetFilters = useCallback(() => {
    setFilters({ metal: "all", bodyPart: "all", category: "all", branch: "all" });
    setSearchQuery("");
  }, []);

  const handleRefetch = useCallback(() => fetchProducts(true), [fetchProducts]);

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#fdfcf9] font-sans">
        <DashboardSidebar />

        {/* ADD PRODUCT MODAL */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[1.5rem] p-6 w-full max-w-md space-y-4 shadow-2xl border border-amber-100 max-h-[95vh] overflow-y-auto custom-scrollbar relative">
              <div className="flex justify-between items-center border-b border-amber-100 pb-3">
                <h2 className="text-lg font-serif font-black text-amber-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-600" /> New Masterpiece
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} className="rounded-full h-8 w-8 hover:bg-red-50 hover:text-red-500">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Branch Origin</label>
                  <Select value={formData.branchName} onValueChange={(val) => setFormData(p => ({ ...p, branchName: val }))}>
                    <SelectTrigger className="h-10 bg-amber-50/30 border-amber-100 rounded-lg"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                    <SelectContent className="z-[130]">
                      {branches.map(b => <SelectItem key={b} value={b} className="capitalize font-bold text-xs">{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Display Name</label>
                  <Input placeholder="e.g., Antique Gold Haram" value={formData.name} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Placement</label>
                    <Select value={formData.bodyPart} onValueChange={(val) => setFormData(p => ({ ...p, bodyPart: val, category: "" }))}>
                      <SelectTrigger className="h-10 bg-white border-amber-50 rounded-lg text-xs"><SelectValue placeholder="Select Area" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        {Object.keys(ORNAMENT_MAPPING).map(k => <SelectItem key={k} value={k}>{k.replace(/_/g, " & ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Type</label>
                    <Select value={formData.category} onValueChange={(val) => setFormData(p => ({ ...p, category: val }))} disabled={!formData.bodyPart}>
                      <SelectTrigger className="h-10 bg-white border-amber-50 rounded-lg text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent className="z-[130] max-h-[200px]">
                        {formData.bodyPart && ORNAMENT_MAPPING[formData.bodyPart]?.map(item => (
                          <SelectItem key={item} value={item.toLowerCase().replace(/ /g, "_")} className="text-xs">{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Metal Base</label>
                    <Select value={formData.type} onValueChange={(val) => setFormData(p => ({ ...p, type: val, carats: "", pricingBasis: "grams" }))}>
                      <SelectTrigger className="h-10 border-amber-50 rounded-lg text-xs"><SelectValue placeholder="Metal" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        <SelectItem value="gold" className="font-bold text-amber-600 text-xs">Gold</SelectItem>
                        <SelectItem value="silver" className="font-bold text-slate-500 text-xs">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Purity</label>
                    <Select value={formData.carats} onValueChange={(val) => setFormData(p => ({ ...p, carats: val, pricingBasis: "grams" }))}>
                      <SelectTrigger className="h-10 border-amber-50 rounded-lg text-xs"><SelectValue placeholder="Quality" /></SelectTrigger>
                      <SelectContent className="z-[130]">
                        {formData.type === "gold"
                          ? ["24K", "22K", "18K", "14K", "9K"].map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)
                          : ["99.9%", "92.5%", "70%", "Others"].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Updated Dynamic Metal Input Field (Grams vs Piece Cost) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center ml-1 pr-1">
                      <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest">
                        {formData.pricingBasis === "piece" ? "Piece Cost" : "Metal Wt (g)"}
                      </label>
                      <select
                        value={formData.pricingBasis || "grams"}
                        onChange={(e) => setFormData(p => ({ ...p, pricingBasis: e.target.value }))}
                        className="text-[9px] font-black text-amber-600 bg-transparent border-none outline-none cursor-pointer uppercase tracking-tight hover:text-amber-700"
                      >
                        <option value="grams">Grams</option>
                        {formData.type === "silver" && formData.carats === "92.5%" && (
                          <option value="piece">Piece Cost</option>
                        )}
                      </select>
                    </div>
                    {formData.pricingBasis === "piece" ? (
                      <Input type="number" min="0" placeholder="₹0.00" value={formData.pieceCost || ""} className="h-10 border-amber-50 rounded-lg text-xs animate-in fade-in duration-150" onChange={(e) => setFormData(p => ({ ...p, pieceCost: e.target.value }))} />
                    ) : (
                      <Input type="number" min="0" placeholder="0.000" value={formData.grams || ""} className="h-10 border-amber-50 rounded-lg text-xs animate-in fade-in duration-150" onChange={(e) => setFormData(p => ({ ...p, grams: e.target.value }))} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Stone Wt (g)</label>
                    <Input type="number" min="0" placeholder="0.000" value={formData.stoneWeight} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData(p => ({ ...p, stoneWeight: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">VA %</label>
                    <Input type="number" min="0" placeholder="0%" value={formData.va} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData(p => ({ ...p, va: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">Stone Cost</label>
                    <Input type="number" min="0" placeholder="₹0" value={formData.stoneCost} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData(p => ({ ...p, stoneCost: e.target.value }))} />
                  </div>
                </div>

                {/* Updated Dynamic Weight Aggregator Box */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-3 rounded-xl border border-amber-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[8px] uppercase font-black text-amber-600 tracking-widest">
                        {formData.pricingBasis === "piece" ? "Pricing Summary Structure" : "Aggregated Net Weight"}
                      </p>
                      {formData.pricingBasis === "piece" ? (
                        <p className="text-xl font-mono font-black text-amber-900 tracking-tighter">
                          ₹{Number(formData.pieceCost || 0).toLocaleString('en-IN')} <span className="text-xs font-serif">Fixed</span>
                        </p>
                      ) : (
                        <p className="text-2xl font-mono font-black text-amber-900 tracking-tighter">
                          {Number((formData.grams || 0) - (formData.stoneWeight || 0)).toFixed(3)} <span className="text-xs font-serif">g</span>
                        </p>
                      )}
                    </div>
                    <Layers className="w-6 h-6 text-amber-200/50" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-amber-800 uppercase tracking-widest ml-1">HUID Serial</label>
                  <Input placeholder="Enter HUID" value={formData.huid} className="h-10 border-amber-50 rounded-lg text-xs" onChange={(e) => setFormData(p => ({ ...p, huid: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">Discard</Button>
                <Button onClick={handleCreateProduct} className="flex-[2] h-11 rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-lg font-black uppercase text-[10px] tracking-widest" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Finalize Entry
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* BULK PRINTER WIDGET */}
        {printQueue.length > 0 && (
          <BulkBarcodePrinter
            queue={printQueue}
            onClearQueue={() => setPrintQueueMap(new Map())}
            onRemoveFromQueue={(id: string) => setPrintQueueMap(prev => { const n = new Map(prev); n.delete(id); return n; })}
          />
        )}

        <main className="flex-1 overflow-auto h-screen custom-scrollbar">
          {/* HEADER */}
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-amber-50 px-10 py-8 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-amber-600 p-2.5 rounded-2xl shadow-lg shadow-amber-200">
                <Plus className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-4xl font-serif font-black tracking-tight text-amber-950 italic">Inventory Vault</h1>
                <p className="text-[11px] text-amber-700 font-black uppercase tracking-[0.3em] mt-1 ml-1 opacity-60">Suvarna Luxury Collection</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {filteredProducts.length > 0 && (
                <Button variant="outline" size="sm" onClick={selectAllFiltered}
                  className="rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-900 font-black uppercase text-[10px] tracking-widest transition-all">
                  <CheckSquare className="w-4 h-4 mr-2" /> Select All ({filteredProducts.length})
                </Button>
              )}
              <div className="h-10 w-[2px] bg-amber-50 mx-2" />
              <Button variant="outline" size="sm" onClick={exportToExcel} className="hidden md:flex rounded-xl border-amber-200 text-amber-800 font-bold hover:bg-amber-50">
                <TableIcon className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="hidden md:flex rounded-xl border-red-200 text-red-800 font-bold hover:bg-red-50">
                <FileDown className="w-4 h-4 mr-2" /> Registry PDF
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl border-2" onClick={handleRefetch}>
                <RefreshCw className={`w-5 h-5 text-amber-600 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="gold" className="h-12 px-8 rounded-2xl shadow-xl shadow-amber-100 font-black uppercase tracking-widest text-xs" onClick={() => setShowForm(true)}>
                <Plus className="w-5 h-5 mr-2 stroke-[3px]" /> Add Masterpiece
              </Button>
            </div>
          </header>

          <div className="p-10 space-y-10 max-w-[1700px] mx-auto">
            {/* FILTER SUITE */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-amber-50/50 border-2 border-amber-50 flex flex-wrap gap-8 items-end relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-40 blur-3xl" />
              <div className="space-y-2 relative z-10">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <SearchIcon className="w-3.5 h-3.5" /> Quick Search
                </label>
                <Input
                  placeholder="Search by SKU, Name, or Item Code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 h-11 rounded-xl border-2 border-amber-50 bg-white placeholder:text-amber-400/50 text-xs font-bold focus:border-amber-400 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-2 relative z-10">
                <label className="text-[10px] font-black text-amber-900/40 uppercase flex items-center gap-2 tracking-[0.2em] ml-1">
                  <Filter className="w-3.5 h-3.5" /> Filter: Metal Base
                </label>
                <div className="flex flex-wrap gap-2 p-1 bg-amber-50/50 rounded-xl border border-amber-100">
                  {["all", "gold", "silver", "silver-92.5"].map(t => (
                    <button key={t} onClick={() => setFilters(f => ({ ...f, metal: t }))}
                      className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        filters.metal === t ? "bg-amber-600 text-white shadow-lg shadow-amber-200 scale-105" : "text-amber-800/60 hover:text-amber-600")}>
                      {t === "silver-92.5" ? "92.5% Silver" : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <Store className="w-3.5 h-3.5" /> Branch Location
                </label>
                <Select value={filters.branch} onValueChange={(val) => setFilters(f => ({ ...f, branch: val }))}>
                  <SelectTrigger className="w-48 text-xs font-bold h-11 bg-white border-2 border-amber-50 rounded-xl focus:ring-amber-500 shadow-sm"><SelectValue placeholder="All Branches" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-amber-100">
                    <SelectItem value="all" className="font-bold">Global Registry</SelectItem>
                    {branches.map(b => <SelectItem key={b} value={b} className="capitalize font-bold">{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1">Body Placement</label>
                <Select value={filters.bodyPart} onValueChange={(val) => setFilters(f => ({ ...f, bodyPart: val }))}>
                  <SelectTrigger className="w-44 text-xs font-bold h-11 bg-white border-2 border-amber-50 rounded-xl shadow-sm"><SelectValue placeholder="All Parts" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-amber-100">
                    <SelectItem value="all" className="font-bold uppercase tracking-tighter">Every Part</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="ears">Ears</SelectItem>
                    <SelectItem value="nose">Nose</SelectItem>
                    <SelectItem value="neck">Neck</SelectItem>
                    <SelectItem value="wrist">Wrist</SelectItem>
                    <SelectItem value="fingers">Fingers</SelectItem>
                    <SelectItem value="others">Others</SelectItem>

                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" /> Piece Category
                </label>
                <Select value={filters.category} onValueChange={(val) => setFilters(f => ({ ...f, category: val }))}>
                  <SelectTrigger className="w-44 text-xs font-bold h-11 bg-white border-2 border-amber-50 rounded-xl shadow-sm"><SelectValue placeholder="All Categories" /></SelectTrigger>
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
              <Button variant="ghost" onClick={resetFilters}
                className="h-11 px-6 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                Reset Filters
              </Button>
            </div>

            <div className="py-4"><GoldDivider opacity={30} /></div>

            {/* INVENTORY GRID */}
            <div>
              <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-sm font-bold text-amber-700">
                  <span className="text-amber-900 font-black">{filteredProducts.length}</span> products in registry
                </p>
                {printQueue.length > 0 && (
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl px-8 py-3 shadow-lg shadow-emerald-100">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Selected Items</p>
                      <p className="text-3xl font-mono font-black text-emerald-900">{printQueue.length}</p>
                    </div>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                  {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
                </div>
              ) : filteredProducts.length === 0 ? (
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
              ) : (
                // VIRTUALISED GRID — only renders visible cards
                <div ref={gridRef}>
                  <VirtualGrid
                    products={filteredProducts}
                    printQueueIds={printQueueIds}
                    onToggle={toggleSelection}
                    onSelectRow={selectOrToggleRow}
                    onRemoveRow={removeRowFromQueue}
                    onUpdated={() => fetchProducts(true)}
                    onDeleted={() => fetchProducts(true)}
                    showToast={fireToast}
                    columnsCount={columnsCount}
                  />
                </div>
              )}
            </div>
          </div>

          {/* FOOTER */}
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

// SVG fallback icons
const PackageSearch = ({ className, size }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    <path d="M11 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0" /><path d="m20 21-1.5-1.5" />
  </svg>
);

const CheckSquare = ({ className, size }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 11 3 3L22 4" />
  </svg>
);

export default Products;