import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface BillingProductCardProps {
  product: {
    id: string;
    name: string;
    metalType: string;
    grams: number;
    carats: number;
    cost: number;
    manufactureDate: string;
    stock?: number;
  };
  onAdd: (product: any) => void;
}

export const BillingProductCard = ({
  product,
  onAdd,
}: BillingProductCardProps) => {
  return (
    <div className="bg-card border border-primary/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-yellow-600 to-yellow-400 text-white uppercase">
          {product.metalType}
        </span>
        <span className="text-sm text-muted-foreground">
          {new Date(product.manufactureDate).toLocaleDateString()}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-serif text-xl font-bold text-foreground mb-4">
        {product.name}
      </h3>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-muted-foreground">Weight</p>
          <p className="font-semibold">{product.grams}g</p>
        </div>
        <div>
          <p className="text-muted-foreground">Carats</p>
          <p className="font-semibold">{product.carats}K</p>
        </div>
        <div>
          <p className="text-muted-foreground">Stock</p>
          <p className="font-semibold">
            {product.stock ?? 1} pcs
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">ID</p>
          <p className="font-semibold text-xs">{product.id}</p>
        </div>
      </div>

      <hr className="border-border mb-4" />

      {/* Footer */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-muted-foreground text-xs">Price</p>
          <p className="text-xl font-serif font-bold text-gradient-gold">
            ₹{product.cost.toLocaleString()}
          </p>
        </div>

        <Button
          size="icon"
          variant="outline"
          className="border-primary/30 hover:bg-primary/10"
          onClick={() => onAdd(product)}
        >
          <Plus className="w-5 h-5 text-primary" />
        </Button>
      </div>
    </div>
  );
};
