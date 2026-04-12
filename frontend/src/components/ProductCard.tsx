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
import { Edit2, Save, X, QrCode, Anchor, Weight, Fingerprint, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  metalType: "gold" | "silver" | "other";
  grams: number;
  carats: string; 
  huid?: string;
  stoneWeight: number;
  netWeight: number;
  category: string;
  bodyPart: string;
  manufactureDate: string;
  sku: string;
}

interface ProductCardProps {
  product: Product;
  onUpdated?: () => void;
  showToast?: (msg: string) => void;
  onShowQR?: (code: string) => void;
}

export const ProductCard = ({
  product,
  onUpdated,
  showToast,
  onShowQR
}: ProductCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState(product);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Auto-calculate Net Weight on the edit side if values change
  useEffect(() => {
    const total = (Number(editedProduct.grams) + Number(editedProduct.stoneWeight)).toFixed(3);
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
            huid: editedProduct.huid,
            category: editedProduct.category,
            bodyPart: editedProduct.bodyPart,
            carats: editedProduct.carats,
            metalType: editedProduct.metalType
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

  const typeColors = {
    gold: "from-amber-600 to-yellow-400 text-amber-950",
    silver: "from-slate-400 to-slate-200 text-slate-900",
    other: "from-rose-700 to-rose-500 text-white",
  };

  return (
    <div className="flip-card h-[400px] w-full group">
      <div
        className={cn(
          "flip-card-inner relative w-full h-full transition-all duration-700",
          isEditing && "flipped"
        )}
      >
        {/* FRONT: PREMIUM DISPLAY */}
        <div className="flip-card-front absolute w-full h-full">
          <div className="card-luxury h-full p-6 flex flex-col bg-white border border-amber-100 shadow-xl rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm bg-gradient-to-r",
                typeColors[product.metalType]
              )}>
                {product.metalType} • {product.carats}
              </div>
              <Button variant="ghost" size="icon" className="hover:bg-amber-50 rounded-full" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 text-amber-700" />
              </Button>
            </div>

            <div className="mb-4">
              <h3 className="font-serif text-2xl font-bold text-gray-900 leading-tight">{product.name}</h3>
              <p className="text-[10px] text-amber-600 font-mono tracking-tighter uppercase">SKU: {product.sku}</p>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-amber-50 pt-4">
              <div className="flex items-center gap-2">
                <Weight className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">Metal Grams</p>
                  <p className="text-sm font-semibold">{product.grams}g</p>
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
                <Fingerprint className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground font-bold">HUID</p>
                  <p className="text-sm font-semibold">{product.huid || "N/A"}</p>
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

            <div className="mt-auto pt-4 flex items-end justify-between border-t border-amber-100">
              <div className="bg-amber-50 px-3 py-2 rounded-2xl border border-amber-200/50">
                <p className="text-[9px] font-bold text-amber-600 uppercase">Total Net Weight</p>
                <p className="text-xl font-mono font-black text-amber-900">{product.netWeight}g</p>
              </div>
              <Button variant="gold" size="icon" className="rounded-2xl shadow-lg shadow-amber-200" disabled={isLoadingQR} onClick={async () => {
                  setIsLoadingQR(true);
                  try { await onShowQR?.(product.sku); } finally { setIsLoadingQR(false); }
                }}>
                {isLoadingQR ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* BACK: PREMIUM EDIT MODE (NOW SUPPORTS ALL FIELDS) */}
        <div className="flip-card-back absolute w-full h-full">
          <div className="card-luxury h-full p-5 flex flex-col bg-[#1a0f0f] border border-red-900/30 rounded-3xl shadow-2xl">
            <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
              <h4 className="font-serif font-bold text-amber-200 uppercase tracking-widest text-xs">Edit Masterpiece</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400" onClick={handleSave}><Save className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { setIsEditing(false); setEditedProduct(product); }}><X className="w-4 h-4" /></Button>
              </div>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar text-left">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Title</label>
                <Input className="bg-white/5 border-white/10 text-white h-7 text-xs" value={editedProduct.name} onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })} />
              </div>

              {/* Placement & Category */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Placement</label>
                  <Select value={editedProduct.bodyPart} onValueChange={(v)=>setEditedProduct({...editedProduct, bodyPart: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["head", "ears", "nose", "neck", "wrist", "fingers", "waist", "foot", "arms"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Type</label>
                  <Select value={editedProduct.category} onValueChange={(v)=>setEditedProduct({...editedProduct, category: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["rings", "earrings", "necklaces", "bangles", "pendants", "nosepins", "anklets", "mangalsutra", "coins", "other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quality (Carats/Purity) */}
              <div className="space-y-1">
                <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Quality / Carats</label>
                <Select value={editedProduct.carats} onValueChange={(v)=>setEditedProduct({...editedProduct, carats: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editedProduct.metalType === "gold" ? 
                      ["24K", "22K", "18K", "16K", "9K"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>) :
                      ["99.9%", "95.0%", "92.5%"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Weights */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Grams</label>
                  <Input type="number" className="bg-white/5 border-white/10 text-white h-7 text-xs" value={editedProduct.grams} onChange={(e) => setEditedProduct({ ...editedProduct, grams: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-white/40 uppercase font-bold ml-1">Stone Wt</label>
                  <Input type="number" className="bg-white/5 border-white/10 text-white h-7 text-xs" value={editedProduct.stoneWeight} onChange={(e) => setEditedProduct({ ...editedProduct, stoneWeight: Number(e.target.value) })} />
                </div>
              </div>

              {/* HUID */}
              <div className="space-y-1">
                <label className="text-[8px] text-white/40 uppercase font-bold ml-1">HUID Tag</label>
                <Input className="bg-white/5 border-white/10 text-white h-7 text-xs" value={editedProduct.huid || ""} onChange={(e) => setEditedProduct({ ...editedProduct, huid: e.target.value })} />
              </div>

              {/* Calculated View */}
              <div className="bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
                <p className="text-[8px] text-amber-400/60 uppercase font-bold">Auto-calculated Net</p>
                <p className="text-sm font-mono text-amber-400 font-bold">{editedProduct.netWeight}g</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  
};