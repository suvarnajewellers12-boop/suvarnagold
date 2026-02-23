import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Save, X, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  metalType: "gold" | "silver" | "other";
  grams: number;
  carats: number;
  cost: number;
  manufactureDate: string;
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
  const [qrModal, setQrModal] = useState<{
    image: string;
    productId: string;
  } | null>(null);


  const token = localStorage.getItem("token");

  const handleSave = async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/api/products/update/${product.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: editedProduct.name,
            grams: editedProduct.grams,
            cost: editedProduct.cost,
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        showToast?.("Product updated successfully!");
        setIsEditing(false);   // 🔥 Flip back
        onUpdated?.();        // 🔥 Refresh list
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    console.log("QR Modal changed:", qrModal);
  }, [qrModal]);

  const typeColors = {
    gold: "from-yellow-600 to-yellow-400",
    silver: "from-gray-400 to-gray-200",
    other: "from-amber-700 to-amber-500",
  };

  return (
    <div className="flip-card h-[320px]">
      <div
        className={cn(
          "flip-card-inner relative w-full h-full",
          isEditing && "flipped"
        )}
      >
        {/* FRONT */}
        <div className="flip-card-front absolute w-full h-full">
          <div className="card-luxury h-full p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r uppercase tracking-wide",
                  typeColors[product.metalType]
                )}
              >
                {product.metalType}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>

            <h3 className="font-serif text-xl font-bold mb-3">
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
            </div>

            <div className="flex items-center justify-between pt-4 border-t mt-auto">
              <p className="text-xl font-bold text-gradient-gold">
                ₹{product.cost.toLocaleString()}
              </p>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  console.log("QR button clicked", product.uniqueCode);
                  onShowQR?.(product.uniqueCode); // ✅ only UUID
                }}              >
                <QrCode className="w-5 h-5 text-primary" />
              </Button>

            </div>
          </div>
        </div>

        {/* BACK (EDIT) */}
        <div className="flip-card-back absolute w-full h-full">
          <div className="card-luxury h-full p-5 flex flex-col gradient-maroon">
            <div className="flex justify-between mb-4">
              <h4 className="font-serif font-bold text-white">
                Edit Product
              </h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={handleSave}>
                  <Save className="w-4 h-4 text-white" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                value={editedProduct.name}
                onChange={(e) =>
                  setEditedProduct({
                    ...editedProduct,
                    name: e.target.value,
                  })
                }
              />

              <Input
                type="number"
                value={editedProduct.grams}
                onChange={(e) =>
                  setEditedProduct({
                    ...editedProduct,
                    grams: Number(e.target.value),
                  })
                }
              />

              <Input
                type="number"
                value={editedProduct.cost}
                onChange={(e) =>
                  setEditedProduct({
                    ...editedProduct,
                    cost: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
