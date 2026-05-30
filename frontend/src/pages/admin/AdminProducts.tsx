"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { ProductCard } from "@/components/ProductCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackageOpen, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const VIRTUAL_OVERSCAN = 3;
const CARD_HEIGHT_PX = 400; // match your actual rendered ProductCard height
const GAP_PX = 32;          // gap-8 = 2rem = 32px

// Module-level caches — survive re-renders and filter changes
let productsCache: any[] | null = null;
const barcodeCache: Record<string, string> = {};

// ─────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// USE COLUMNS HOOK
// Tracks container width via ResizeObserver → correct column count
// Matches: sm:2  lg:3  xl:4  2xl:5
// ─────────────────────────────────────────────────────────
function useColumnsCount(ref: React.RefObject<HTMLDivElement>) {
  const [cols, setCols] = useState(5);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w < 640) setCols(1);
      else if (w < 1024) setCols(2);
      else if (w < 1280) setCols(3);
      else if (w < 1536) setCols(4);
      else setCols(5);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return cols;
}

// ─────────────────────────────────────────────────────────
// VIRTUAL GRID
// Renders only the cards near the viewport using absolute positioning.
// Total container height is always correct so scrollbar stays accurate.
// ─────────────────────────────────────────────────────────
interface VirtualGridProps {
  products: any[];
  columnsCount: number;
  onUpdated: () => void;
  showToast: (msg: string) => void;
  onShowQR: (sku: string, productId: string) => void;
}

const VirtualGrid: React.FC<VirtualGridProps> = ({
  products,
  columnsCount,
  onUpdated,
  showToast,
  onShowQR,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const containerOffsetTopRef = useRef<number>(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  const ROW_HEIGHT = CARD_HEIGHT_PX + GAP_PX;
  const totalRows = Math.ceil(products.length / columnsCount);
  const totalHeight = totalRows * ROW_HEIGHT;

  // Locate the closest scrollable ancestor once on mount
  useEffect(() => {
    let el: HTMLElement | null = containerRef.current?.parentElement ?? null;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollParentRef.current = el;
        break;
      }
      el = el.parentElement;
    }
    if (!scrollParentRef.current) scrollParentRef.current = document.documentElement;
  }, []);

  // Attach scroll + resize listeners; measure initial offset
  useEffect(() => {
    const parent = scrollParentRef.current;
    if (!parent) return;

    const measure = () => {
      if (!containerRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const pRect = parent.getBoundingClientRect();
      // Distance from scroll-parent's content top to grid top (static px value)
      containerOffsetTopRef.current = parent.scrollTop + (cRect.top - pRect.top);
      setContainerHeight(parent.clientHeight);
      setScrollTop(parent.scrollTop);
    };

    const onScroll = () => setScrollTop(parent.scrollTop);
    const onResize = () => measure();

    parent.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    requestAnimationFrame(measure); // defer so layout is complete

    return () => {
      parent.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Re-measure when the product list changes (filter / search)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!containerRef.current || !scrollParentRef.current) return;
      const parent = scrollParentRef.current;
      const cRect = containerRef.current.getBoundingClientRect();
      const pRect = parent.getBoundingClientRect();
      containerOffsetTopRef.current = parent.scrollTop + (cRect.top - pRect.top);
    });
  }, [products]);

  // Compute which grid rows fall inside (or near) the viewport
  const { startRow, endRow } = useMemo(() => {
    const scrolledPast = scrollTop - containerOffsetTopRef.current;
    const firstVisible = scrolledPast > 0 ? Math.floor(scrolledPast / ROW_HEIGHT) : 0;
    const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT);
    return {
      startRow: Math.max(0, firstVisible - VIRTUAL_OVERSCAN),
      endRow: Math.min(totalRows - 1, firstVisible + visibleRows + VIRTUAL_OVERSCAN),
    };
  }, [scrollTop, containerHeight, totalRows, ROW_HEIGHT]);

  // Build the list of cards to actually render
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
    <div ref={containerRef} style={{ position: "relative", height: totalHeight }}>
      {visibleItems.map(({ product, index, top }) => {
        const col = index % columnsCount;
        // Equal-width columns with fixed px gaps
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
              showToast={showToast}
              onShowQR={(code: string) => onShowQR(code, product.id)}
            />
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
const AdminProducts = () => {
  const { currentUser, token } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "gold" | "silver" | "other">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [barcodeModal, setBarcodeModal] = useState<{
    image: string;
    productId: string;
    sku: string;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const columnsCount = useColumnsCount(gridRef);

  // ── data fetch ────────────────────────────────────────
  const fetchProducts = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && productsCache !== null) {
      setProducts(productsCache);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      let apiUrl = "https://suvarnagold-16e5.vercel.app/api/products/all";
      if (currentUser?.branchName) {
        apiUrl += `?branch=${encodeURIComponent(currentUser.branchName)}`;
      }
      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const fetched = data.products || [];
      productsCache = fetched;
      setProducts(fetched);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, token]);

  useEffect(() => { fetchProducts(); }, [currentUser]);

  // ── barcode handler (uses module-level cache) ─────────
  const handleShowBarcode = useCallback(async (sku: string, productId: string) => {
    if (barcodeCache[sku]) {
      setBarcodeModal({ image: barcodeCache[sku], productId, sku });
      return;
    }
    try {
      const res = await fetch(
        `https://suvarnagold-16e5.vercel.app/api/products/barcode/${sku}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) {
        barcodeCache[sku] = data.barcodeImage;
        setBarcodeModal({ image: data.barcodeImage, productId, sku });
      }
    } catch (err) {
      console.error("Barcode Fetch Failed", err);
    }
  }, [token]);

  // ── on-card-update callback ───────────────────────────
  const handleUpdated = useCallback(() => {
    productsCache = null;
    fetchProducts(true);
  }, [fetchProducts]);

  // ── stable toast setter ───────────────────────────────
  const handleToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  }, []);

  // ── filtering (memoised — no re-compute on unrelated state changes) ──
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      const matchesMetal = filter === "all" || p.metalType?.toLowerCase() === filter;
      const matchesSearch = !q ||
        p.name?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q);
      return matchesMetal && matchesSearch;
    });
  }, [products, filter, searchQuery]);

  const handleRefetch = useCallback(() => fetchProducts(true), [fetchProducts]);

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background font-sans text-foreground">
        <AdminSidebar />

        {/* BARCODE MODAL */}
        {barcodeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center space-y-6 animate-in zoom-in-95">
              <h2 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">
                Barcode Identity
              </h2>
              <div className="bg-muted/10 p-4 rounded-2xl border border-dashed border-gray-200">
                <img
                  src={barcodeModal.image}
                  alt="Barcode"
                  className="mx-auto mix-blend-multiply"
                />
                <p className="mt-4 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                  SKU: {barcodeModal.sku}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <a
                  href={barcodeModal.image}
                  download={`SKU-${barcodeModal.sku}.png`}
                  className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all"
                >
                  Download Label
                </a>
                <button
                  onClick={() => setBarcodeModal(null)}
                  className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto h-screen relative">
          {/* HEADER */}
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif font-bold text-amber-900 dark:text-amber-100">
                Inventory Catalog
              </h1>
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
                onClick={handleRefetch}
                className="h-11 w-11 rounded-xl border-gold/20 text-gold"
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
              </Button>
            </div>
          </header>

          <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* FILTER TABS */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-2 p-1.5 bg-muted/30 rounded-2xl border border-border/40 w-fit">
                {(["all", "gold", "silver", "other"] as const).map(t => (
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

              {/* Live product count */}
              <p className="text-sm font-bold text-muted-foreground">
                <span className="text-foreground font-black">{filteredProducts.length}</span> products
              </p>
            </div>

            <GoldDivider />

            {/* PRODUCT GRID */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
                <PackageOpen className="w-16 h-16 mb-4 text-amber-900" />
                <h3 className="text-xl font-serif font-bold">The registry is empty</h3>
                <p className="text-sm">Try refreshing the data or checking different filters.</p>
              </div>
            ) : (
              // VIRTUALISED GRID — only renders cards near the viewport
              <div ref={gridRef}>
                <VirtualGrid
                  products={filteredProducts}
                  columnsCount={columnsCount}
                  onUpdated={handleUpdated}
                  showToast={handleToast}
                  onShowQR={handleShowBarcode}
                />
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

export default AdminProducts;