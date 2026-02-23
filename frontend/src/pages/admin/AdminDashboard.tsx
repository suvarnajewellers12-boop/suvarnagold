import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { StatCard } from "@/components/StatCard";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import {
  Package,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";

const AdminDashboard = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, Branch Admin
              </p>
            </div>
          </header>

          <div className="p-6 space-y-8">
            {/* Stats Grid */}
            <section>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Today's Sales"
                  value={156000}
                  prefix="₹"
                  icon={TrendingUp}
                  trend={{ value: 8, isPositive: true }}
                  delay={0}
                />
                <StatCard
                  title="Products Sold"
                  value={12}
                  icon={Package}
                  trend={{ value: 15, isPositive: true }}
                  delay={100}
                />
                <StatCard
                  title="Active Schemes"
                  value={45}
                  icon={Wallet}
                  trend={{ value: 3, isPositive: true }}
                  delay={200}
                />
                <StatCard
                  title="Pending Bills"
                  value={3}
                  icon={Receipt}
                  trend={{ value: 2, isPositive: false }}
                  delay={300}
                />
              </div>
            </section>

            <GoldDivider />

            {/* Quick Actions */}
            <section>
              <h2 className="text-xl font-serif font-bold text-foreground mb-6">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LuxuryCard delay={0}>
                  <div className="text-center py-6">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-gold rounded-full flex items-center justify-center shadow-gold">
                      <Receipt className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">New Bill</h3>
                    <p className="text-sm text-muted-foreground">
                      Create a new customer bill
                    </p>
                  </div>
                </LuxuryCard>

                <LuxuryCard delay={100}>
                  <div className="text-center py-6">
                    <div className="w-14 h-14 mx-auto mb-4 gradient-luxury rounded-full flex items-center justify-center shadow-gold">
                      <TrendingUp className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">View Reports</h3>
                    <p className="text-sm text-muted-foreground">
                      Check sales and analytics
                    </p>
                  </div>
                </LuxuryCard>
              </div>
            </section>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
