"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Edit2, Save, X, QrCode, Anchor, Weight, Fingerprint,
  Layers, IndianRupee, Loader2, Check, Trash2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  metalType: string; 
  grams: number;
  carats: string;
  itemCode?: string;
  stoneWeight: number;
  netWeight: number;
  category: string;
  bodyPart: string;
  manufactureDate: string;
  sku: string;
  stoneCost: number;
  va: number;
  pieceCost: number; // <-- Added Piece Cost
}

interface ProductCardProps {
  product: Product;
  onUpdated?: () => void;
  showToast?: (msg: string) => void;
  onShowQR?: (code: string) => void;
  onDeleted?: () => void;
  isSelected?: boolean;
  onToggle?: (product: Product) => void;
  productIndex?: number;
  onSelectRow?: (index: number) => void;
  onRemoveRow?: (index: number) => void;
}

const TYPE_COLORS: Record<string, string> = {
  gold:   "from-amber-600 to-yellow-400 text-amber-950",
  silver: "from-slate-400 to-slate-200 text-slate-900",
  other:  "from-rose-700 to-rose-500 text-white",
};

const resolveTypeColor = (metalType: string): string => {
  const key = metalType?.trim().toLowerCase();
  return TYPE_COLORS[key] ?? TYPE_COLORS["other"];
};

export const ProductCard = ({
  product,
  onUpdated,
  showToast,
  onShowQR,
  onDeleted,
  isSelected = false,
  onToggle,
  productIndex = 0,
  onSelectRow,
  onRemoveRow,
}: ProductCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState(product);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Auto-calculate net weight when grams or stoneWeight change
  useEffect(() => {
    const total = (Number(editedProduct.grams || 0) + Number(editedProduct.stoneWeight || 0)).toFixed(3);
    setEditedProduct(prev => ({ ...prev, netWeight: Number(total) }));
  }, [editedProduct.grams, editedProduct.stoneWeight]);

  const handleSave = async () => {
    try {
      const res = await fetch(
        `https://suvarnagold-16e5.vercel.app/api/products/update/${product.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: editedProduct.name,
            grams: editedProduct.grams,
            stoneWeight: editedProduct.stoneWeight,
            netWeight: editedProduct.netWeight,
            itemCode: editedProduct.itemCode,
            category: editedProduct.category,
            bodyPart: editedProduct.bodyPart,
            carats: editedProduct.carats,
            metalType: editedProduct.metalType,
            stoneCost: editedProduct.stoneCost,
            va: editedProduct.va,
            pieceCost: Number(editedProduct.pieceCost || 0),
          }),
        }
      );

      if (res.ok) {
        showToast?.("Collection updated successfully!");
        setIsEditing(false);
        onUpdated?.();
      } else {
        const data = await res.json();
        alert(data.error || "Update failed");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `https://suvarnagold-16e5.vercel.app/api/products/delete/${product.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        showToast?.("Product deleted successfully!");
        setShowDeleteConfirm(false);
        onDeleted?.();
      } else {
        const data = await res.json();
        alert(data.error || "Delete failed");
      }
    } catch (error) {
      console.error(error);
      alert("Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const badgeColor = resolveTypeColor(product.metalType);
  const metalLabel = product.metalType
    ? product.metalType.charAt(0).toUpperCase() + product.metalType.slice(1).toLowerCase()
    : "Other";

  const handleRowClick = () => {
    if (isSelected && onRemoveRow) {
      onRemoveRow(productIndex);
    } else {
      onSelectRow?.(productIndex);
    }
  };

  // Condition to check if this item uses Piece Pricing
  const isPieceMode = product.metalType?.toLowerCase() === "silver" && (!product.grams || product.grams === 0);

  return (
    <div className={cn(
      "flip-card h-[400px] w-full group relative transition-all duration-300",
      isSelected && "scale-[0.98]"
    )}>

      {/* ROW SELECTION BUTTON */}
      {!isEditing && (onSelectRow || onRemoveRow) && (
        <div onClick={handleRowClick} className="absolute top-0 left-0 z-40 cursor-pointer">
          <div className={cn(
            "px-4 py-2 rounded-br-2xl border-r-2 border-b-2 flex items-center gap-2 transition-all shadow-md",
            isSelected
              ? "bg-orange-500 border-orange-600 hover:bg-orange-600 shadow-lg shadow-orange-200"
              : "bg-blue-500 border-blue-600 hover:bg-blue-600 shadow-lg shadow-blue-200"
          )}>
            <div className="w-4 h-4 rounded-sm border-2 border-white flex items-center justify-center bg-transparent">
              {isSelected
                ? <X className="w-3 h-3 text-white stroke-[3px]" />
                : <div className="w-2 h-2 bg-white rounded-sm" />
              }
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-white">
              {isSelected ? "Deselect" : "Row"}
            </span>
          </div>
        </div>
      )}

      {/* INDIVIDUAL SELECTION CHECKBOX */}
      {!isEditing && onToggle && (
        <div onClick={() => onToggle(product)} className="absolute bottom-0 right-0 z-40 cursor-pointer">
          <div className={cn(
            "px-4 py-2 rounded-tl-2xl border-l-2 border-t-2 flex items-center gap-2 transition-all shadow-md",
            isSelected
              ? "bg-emerald-500 border-emerald-600 shadow-lg shadow-emerald-300"
              : "bg-white border-amber-200 hover:border-amber-400 hover:shadow-lg"
          )}>
            <span className={cn(
              "text-[11px] font-black uppercase tracking-wider transition-all",
              isSelected ? "text-white" : "text-amber-700"
            )}>
              {isSelected ? "✓ Selected" : "Select"}
            </span>
            <div className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
              isSelected
                ? "bg-white border-white"
                : "bg-transparent border-amber-400 hover:border-emerald-500"
            )}>
              {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[3px]" />}
            </div>
          </div>
        </div>
      )}

      <div className={cn("flip-card-inner relative w-full h-full transition-all duration-700", isEditing && "flipped")}>

        {/* ── FRONT: DISPLAY ── */}
        <div className="flip-card-front absolute w-full h-full">
          <div className={cn(
            "card-luxury h-full p-6 flex flex-col bg-white border shadow-xl rounded-3xl overflow-hidden transition-colors",
            isSelected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-amber-100"
          )}>

            {/* Header row */}
            <div className="flex items-center justify-between mb-4 pl-8">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm bg-gradient-to-r",
                badgeColor
              )}>
                {metalLabel} • {product.carats}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="hover:bg-red-50 rounded-full" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
                <Button variant="ghost" size="icon" className="hover:bg-amber-50 rounded-full" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 text-amber-700" />
                </Button>
              </div>
            </div>

            {/* Name + SKU */}
            <div className="mb-4">
              <h3 className="font-serif text-2xl font-bold text-gray-900 leading-tight">
                {product.name}
              </h3>
              <p className="text-[10px] text-amber-600 font-mono tracking-tighter uppercase">
                SKU: {product.sku}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-amber-50 pt-4">
              
              {/* Dynamic Weight or Piece Cost */}
              <div className="flex items-center gap-2">
                {isPieceMode ? <IndianRupee className="w-3.5 h-3.5 text-amber-500" /> : <Weight className="w-3.5 h-3.5 text-amber-500" />}
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">
                    {isPieceMode ? "Piece Price" : "Metal Grams"}
                  </p>
                  <p className="text-sm font-semibold">
                    {isPieceMode ? `₹${product.pieceCost?.toLocaleString('en-IN') || 0}` : `${product.grams}g`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-amber-50 pl-2">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">Stone</p>
                  <p className="text-sm font-semibold">{product.stoneWeight}g</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BadgePercent className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">VA (Wastage)</p>
                  <p className="text-sm font-semibold">{product.va}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 border-l border-amber-50 pl-2">
                <IndianRupee className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">Stone Cost</p>
                  <p className="text-sm font-semibold">₹{product.stoneCost}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Fingerprint className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">HUID</p>
                  <p className="text-sm font-semibold">{product.itemCode || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 border-l border-amber-50 pl-2">
                <Anchor className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">Placement</p>
                  <p className="text-sm font-semibold capitalize">{product.bodyPart}</p>
                </div>
              </div>
            </div>

            {/* Footer: Dynamic net weight / Fixed Price + QR */}
            <div className="mt-auto pt-4 flex items-end justify-between border-t border-amber-100">
              <div className="bg-amber-50 px-3 py-2 rounded-2xl border border-amber-200/50">
                <p className="text-[9px] font-bold text-amber-600 uppercase">
                  {isPieceMode ? "Fixed Pricing" : "Total Net Weight"}
                </p>
                <p className="text-xl font-mono font-black text-amber-900">
                  {isPieceMode 
                    ? `₹${product.pieceCost?.toLocaleString('en-IN') || 0}`
                    : `${Number((product.grams || 0) - (product.stoneWeight || 0)).toFixed(3)}g`
                  }
                </p>
              </div>
              <Button
                variant="gold"
                size="icon"
                className="rounded-2xl shadow-lg shadow-amber-200"
                disabled={isLoadingQR}
                onClick={async () => {
                  setIsLoadingQR(true);
                  try { await onShowQR?.(product.sku); }
                  finally { setIsLoadingQR(false); }
                }}
              >
                {isLoadingQR
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <QrCode className="w-5 h-5" />
                }
              </Button>
            </div>
          </div>
        </div>

        {/* ── BACK: EDIT MODE ── */}
        <div className="flip-card-back absolute w-full h-full">
          <div className="card-luxury h-full p-5 flex flex-col bg-[#1a0f0f] border border-red-900/30 rounded-3xl shadow-2xl">
            <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
              <h4 className="font-serif font-bold text-amber-200 uppercase tracking-widest text-xs">
                Edit Masterpiece
              </h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400 hover:bg-white/5" onClick={handleSave}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-white/5" onClick={() => { setIsEditing(false); setEditedProduct(product); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar text-left">
              <div className="space-y-1">
                <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Title</label>
                <Input
                  className="bg-white/5 border-white/10 text-white h-7 text-xs"
                  value={editedProduct.name}
                  onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Placement</label>
                  <Select value={editedProduct.bodyPart} onValueChange={(v) => setEditedProduct({ ...editedProduct, bodyPart: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["head", "ears", "nose", "neck", "wrist", "fingers", "waist", "foot", "arms"].map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Type</label>
                  <Select value={editedProduct.category} onValueChange={(v) => setEditedProduct({ ...editedProduct, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["rings", "earrings", "necklaces", "bangles", "pendants", "nosepins", "anklets", "mangalsutra", "coins", "other"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Grams</label>
                  <Input
                    type="number" min="0"
                    className="bg-white/5 border-white/10 text-white h-7 text-xs"
                    value={editedProduct.grams}
                    onChange={(e) => setEditedProduct({ ...editedProduct, grams: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Stone Wt</label>
                  <Input
                    type="number" min="0"
                    className="bg-white/5 border-white/10 text-white h-7 text-xs"
                    value={editedProduct.stoneWeight}
                    onChange={(e) => setEditedProduct({ ...editedProduct, stoneWeight: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">VA %</label>
                  <Input
                    type="number" min="0"
                    className="bg-white/5 border-white/10 text-white h-7 text-xs"
                    value={editedProduct.va}
                    onChange={(e) => setEditedProduct({ ...editedProduct, va: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Stone Cost</label>
                  <Input
                    type="number" min="0"
                    className="bg-white/5 border-white/10 text-white h-7 text-xs"
                    value={editedProduct.stoneCost}
                    onChange={(e) => setEditedProduct({ ...editedProduct, stoneCost: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Dynamic row: HUID Tag and Piece Cost (if Silver) */}
              <div className={cn("grid gap-2", editedProduct.metalType?.toLowerCase() === "silver" ? "grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">HUID Tag</label>
                  <Input
                    className="bg-white/5 border-white/10 text-white h-7 text-xs"
                    value={editedProduct.itemCode || ""}
                    onChange={(e) => setEditedProduct({ ...editedProduct, itemCode: e.target.value })}
                  />
                </div>
                {editedProduct.metalType?.toLowerCase() === "silver" && (
                  <div className="space-y-1">
                    <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Pc Cost (₹)</label>
                    <Input
                      type="number" min="0"
                      className="bg-white/5 border-white/10 text-white h-7 text-xs"
                      value={editedProduct.pieceCost || 0}
                      onChange={(e) => setEditedProduct({ ...editedProduct, pieceCost: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div className="bg-amber-400/10 p-2 rounded-lg border border-amber-400/20 mt-1">
                <p className="text-[8px] text-amber-400/60 uppercase font-bold">Auto Net (G+SW)</p>
                <p className="text-sm font-mono text-amber-400 font-bold">{editedProduct.netWeight}g</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Delete Product?</h2>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{product.name}</span>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BadgePercent = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg" width="24" height="24"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={className}
  >
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
    <line x1="9" y1="15" x2="15" y2="9"/>
    <circle cx="9.5" cy="9.5" r=".5" fill="currentColor"/>
    <circle cx="14.5" cy="14.5" r=".5" fill="currentColor"/>
  </svg>
);