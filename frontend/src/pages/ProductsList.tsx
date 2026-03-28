"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Trash2, Edit3, Plus, Image as ImageIcon, X } from "lucide-react";

type Product = {
  id: string;
  title: string;
  description: string;
  weight: number;
  metalType: string;
  carats: string;
  image?: string;
};

/* ─── Module-level cache (survives re-renders AND route navigation) ── */
const productCache = {
  data: null as Product[] | null,
  timestamp: 0,
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — adjust as needed

const isCacheValid = () =>
  productCache.data !== null &&
  Date.now() - productCache.timestamp < CACHE_TTL_MS;

const invalidateCache = () => {
  productCache.data = null;
  productCache.timestamp = 0;
};

/* ─── Constants ──────────────────────────────────────────────────── */
const METAL_TYPES = ["Gold", "Silver", "Others"];
const CARATS = ["18K", "22K", "24K"];
const PURITY = ["92.5%", "99.9%", "95%", "Others"];

const isCaratMetal = (metal: string) => metal === "Gold";
const getOptions = (metal: string) => (isCaratMetal(metal) ? CARATS : PURITY);
const getDefault = (metal: string) => (isCaratMetal(metal) ? "22K" : "92.5%");
const getLabel = (metal: string) => (isCaratMetal(metal) ? "Carats" : "Purity");

/* ─── Skeleton Card ─────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-square w-full bg-slate-200" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between gap-2">
          <div className="h-5 bg-slate-200 rounded-md w-2/3" />
          <div className="h-5 bg-slate-200 rounded-md w-12" />
        </div>
        <div className="h-4 bg-slate-200 rounded-md w-full" />
        <div className="h-4 bg-slate-200 rounded-md w-3/4" />
        <div className="flex gap-2 pt-1">
          <div className="h-10 bg-slate-200 rounded-xl flex-1" />
          <div className="h-10 bg-slate-200 rounded-xl w-12" />
        </div>
      </div>
    </div>
  );
}

/* ─── Product Card ──────────────────────────────────────────────── */
function ProductCard({
  product,
  onDelete,
  onEdit,
}: {
  product: Product;
  onDelete: (id: string) => void;
  onEdit: (p: Product) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.title}"?`)) return;
    setDeleting(true);
    const token = localStorage.getItem("token");
    const res = await fetch(
      `https://suvarnagold-16e5.vercel.app/api/productsimgs/delete/${product.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    setDeleting(false);
    if (res.ok) {
      invalidateCache(); // ✅ bust cache so next fetch is fresh
      onDelete(product.id);
    } else {
      alert("Delete failed ❌");
    }
  };

  return (
    <div className="group bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-yellow-500/50">
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs uppercase tracking-widest font-medium opacity-50">No Image</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="bg-black/70 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-tight">
            {product.metalType}
          </span>
          <span className="bg-yellow-500 text-black text-[10px] px-2.5 py-1 rounded-lg font-bold">
            {product.carats}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-lg leading-tight truncate">{product.title}</h3>
          <span className="text-sm font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
            {product.weight}g
          </span>
        </div>
        <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">{product.description}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onEdit(product)}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm py-2.5 rounded-xl font-semibold transition-all"
          >
            <Edit3 size={14} /> Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center w-12 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-all disabled:opacity-40"
          >
            {deleting ? "…" : <Trash2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─────────────────────────────────────────────────── */
function EditModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [weight, setWeight] = useState(String(product.weight));
  const [metalType, setMetalType] = useState(product.metalType);
  const [carats, setCarats] = useState(product.carats);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product.image || null);
  const [saving, setSaving] = useState(false);

  const handleMetalChange = (val: string) => {
    setMetalType(val);
    setCarats(getDefault(val));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("weight", weight);
    formData.append("metalType", metalType);
    formData.append("carats", carats);
    if (file) formData.append("image", file);

    const res = await fetch(
      `https://suvarnagold-16e5.vercel.app/api/productsimgs/edit/${product.id}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      }
    );

    setSaving(false);
    if (res.ok) {
      invalidateCache(); // ✅ bust cache so next fetch reflects the edit
      onSaved();
    } else {
      alert("Update failed ❌");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border p-8 space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black tracking-tight">Edit Product</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {preview && (
          <img src={preview} alt="preview" className="w-full h-48 object-cover rounded-2xl border" />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Title</label>
            <input
              className="w-full border rounded-xl p-3 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Weight (g)</label>
            <input
              type="number"
              className="w-full border rounded-xl p-3 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-yellow-500 transition-all"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Metal Type</label>
            <select
              className="w-full border rounded-xl p-3 bg-slate-50 outline-none focus:ring-2 focus:ring-yellow-500"
              value={metalType}
              onChange={(e) => handleMetalChange(e.target.value)}
            >
              {METAL_TYPES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">{getLabel(metalType)}</label>
            <select
              className="w-full border rounded-xl p-3 bg-slate-50 outline-none focus:ring-2 focus:ring-yellow-500"
              value={carats}
              onChange={(e) => setCarats(e.target.value)}
            >
              {getOptions(metalType).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Description</label>
          <textarea
            className="w-full border rounded-xl p-3 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-yellow-500 h-28 resize-none transition-all"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Replace Image (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 cursor-pointer"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-yellow-500 text-black font-black rounded-xl hover:bg-yellow-400 shadow-lg shadow-yellow-200 transition-all active:scale-95 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!isCacheValid()); // ✅ skip loading if cache is warm
  const [editTarget, setEditTarget] = useState<Product | null>(null);

  // Upload form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [metalType, setMetalType] = useState("Gold");
  const [carats, setCarats] = useState("22K");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── fetchProducts: reads from cache if valid, else hits the API ──
  const fetchProducts = useCallback(async (forceRefresh = false) => {
    // ✅ Serve from cache if valid and no forced refresh
    if (!forceRefresh && isCacheValid()) {
      setProducts(productCache.data!);
      setLoading(false);
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/productsimgs/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Product[] = await res.json();
        if (Array.isArray(data)) {
          // ✅ Populate cache
          productCache.data = data;
          productCache.timestamp = Date.now();
          setProducts(data);
        }
      }
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []); // no deps — module-level cache needs no closure over state

  // ─── On mount: load from cache instantly, then validate in background ──
  useEffect(() => {
    if (isCacheValid()) {
      // Hydrate UI instantly from cache
      setProducts(productCache.data!);
      setLoading(false);
    } else {
      // Cache cold or expired — fetch from API
      fetchProducts();
    }
  }, [fetchProducts]);

  const handleMetalChange = (val: string) => {
    setMetalType(val);
    setCarats(getDefault(val));
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select an image first");
    setUploading(true);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("weight", weight);
    formData.append("metalType", metalType);
    formData.append("carats", carats);
    formData.append("image", file);

    const res = await fetch("https://suvarnagold-16e5.vercel.app/api/productsimgs/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    setUploading(false);

    if (res.ok) {
      setTitle(""); setDescription(""); setWeight("");
      setMetalType("Gold"); setCarats("22K"); setFile(null);
      invalidateCache();          // ✅ bust cache
      fetchProducts(true);        // ✅ force API fetch to get the new product
    } else {
      alert("Upload failed ❌");
    }
  };

  // ✅ Optimistic delete: remove from UI + cache instantly, no extra fetch needed
  const handleDelete = useCallback((id: string) => {
    const updated = (productCache.data ?? products).filter((p) => p.id !== id);
    productCache.data = updated;          // keep cache in sync
    productCache.timestamp = Date.now();  // refresh TTL
    setProducts(updated);                 // update UI instantly
  }, [products]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#f8f9fa] overflow-hidden">
        <DashboardSidebar />

        <div className="flex-1 flex flex-col min-h-0">

          {/* Sticky header */}
          <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b px-6 md:px-10 py-4 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Products Images</h1>
              <p className="text-sm text-slate-500">Manage your jewelry Photo collection.</p>
            </div>
            <span className="text-xs bg-slate-100 border px-3 py-1.5 rounded-full font-mono text-slate-500">
              {loading ? "Loading…" : `${products.length} items`}
            </span>
          </header>

          {/* Scrollable body */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">

              {/* Upload Panel */}
              <section className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm space-y-6">
                <div className="flex items-center gap-2 text-yellow-600 font-bold uppercase text-xs tracking-widest">
                  <Plus size={16} /> Add New Item
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <input
                      placeholder="Product Title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Weight (g)"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full border p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={metalType}
                      onChange={(e) => handleMetalChange(e.target.value)}
                      className="w-full border px-3 py-3 rounded-xl bg-slate-50 outline-none"
                    >
                      {METAL_TYPES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <select
                      value={carats}
                      onChange={(e) => setCarats(e.target.value)}
                      className="w-full border px-3 py-3 rounded-xl bg-slate-50 outline-none"
                    >
                      {getOptions(metalType).map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <textarea
                  placeholder="Product description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border p-3 rounded-xl bg-slate-50 min-h-[100px] outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                />

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-2 border-dashed rounded-2xl bg-slate-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 cursor-pointer"
                  />
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full md:w-auto bg-black text-white px-10 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Publish Product"}
                  </button>
                </div>
              </section>

              {/* Products Grid */}
              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  Live Products
                  <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full font-mono">
                    {loading ? "…" : products.length}
                  </span>
                </h2>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No products yet. Add your first piece above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onDelete={handleDelete}
                        onEdit={(p) => setEditTarget(p)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>

        {/* Edit Modal */}
        {editTarget && (
          <EditModal
            product={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={() => {
              setEditTarget(null);
              fetchProducts(true); // ✅ force refresh after edit
            }}
          />
        )}
      </div>
    </SidebarProvider>
  );
}