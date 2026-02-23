import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StatCard } from "@/components/StatCard";
import { ProductCard } from "@/components/ProductCard";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Users,
  TrendingUp,
  Wallet,
  Plus,
  Search,
} from "lucide-react";

const sampleProducts = [
  {
    id: "GC-001",
    name: "Royal Necklace",
    type: "gold" as const,
    grams: 25,
    carats: 22,
    cost: 125000,
    quantity: 5,
    manufactureDate: "2024-01-15",
  },
  {
    id: "GC-002",
    name: "Elegant Bracelet",
    type: "gold" as const,
    grams: 12,
    carats: 18,
    cost: 58000,
    quantity: 12,
    manufactureDate: "2024-02-20",
  },
  {
    id: "SC-001",
    name: "Silver Anklet",
    type: "silver" as const,
    grams: 30,
    carats: 0,
    cost: 4500,
    quantity: 25,
    manufactureDate: "2024-03-10",
  },
  {
    id: "GC-003",
    name: "Diamond Ring",
    type: "other" as const,
    grams: 8,
    carats: 18,
    cost: 85000,
    quantity: 8,
    manufactureDate: "2024-01-28",
  },
];

const Dashboard = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleProductSave = () => {
    setToastMessage("Product updated successfully!");
    setShowToast(true);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        
        <main className="flex-1 overflow-auto">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">
                  Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, Super Admin
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="gold">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </div>
          </header>

          <div className="p-6 space-y-8">
            {/* Stats Grid */}
            <section>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Products"
                  value={1247}
                  icon={Package}
                  trend={{ value: 12, isPositive: true }}
                  delay={0}
                />
                <StatCard
                  title="Active Admins"
                  value={24}
                  icon={Users}
                  trend={{ value: 8, isPositive: true }}
                  delay={100}
                />
                <StatCard
                  title="Monthly Revenue"
                  value={4580000}
                  prefix="₹"
                  icon={TrendingUp}
                  trend={{ value: 23, isPositive: true }}
                  delay={200}
                />
                <StatCard
                  title="Active Schemes"
                  value={156}
                  icon={Wallet}
                  trend={{ value: 5, isPositive: false }}
                  delay={300}
                />
              </div>
            </section>

            <GoldDivider />

            {/* Products Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-serif font-bold text-foreground">
                    Recent Products
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Manage and track your inventory
                  </p>
                </div>
                <Button variant="gold-outline">View All</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {sampleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSave={handleProductSave}
                  />
                ))}
              </div>
            </section>

            <GoldDivider />

            {/* Quick Actions */}
            <section>
              <h2 className="text-xl font-serif font-bold text-foreground mb-6">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LuxuryCard delay={0}>
                  <div className="text-center py-4">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-gold rounded-full flex items-center justify-center shadow-gold">
                      <Users className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">Create Admin</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add new branch administrators
                    </p>
                    <Button variant="gold-outline" className="w-full">
                      Create Now
                    </Button>
                  </div>
                </LuxuryCard>

                <LuxuryCard delay={100}>
                  <div className="text-center py-4">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-luxury rounded-full flex items-center justify-center shadow-gold">
                      <Package className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">Add Product</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Register new jewelry items
                    </p>
                    <Button variant="gold-outline" className="w-full">
                      Add Product
                    </Button>
                  </div>
                </LuxuryCard>

                <LuxuryCard delay={200}>
                  <div className="text-center py-4">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-maroon rounded-full flex items-center justify-center shadow-gold">
                      <TrendingUp className="w-7 h-7 text-secondary-foreground" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">View Reports</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Analyze sales and performance
                    </p>
                    <Button variant="gold-outline" className="w-full">
                      View Reports
                    </Button>
                  </div>
                </LuxuryCard>
              </div>
            </section>
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

export default Dashboard;
