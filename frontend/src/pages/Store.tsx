import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Store as StoreIcon, Search, MapPin, Phone, Clock } from "lucide-react";

const stores = [
  { id: 1, name: "Mumbai Central", address: "123 Gold Street, Mumbai", phone: "+91 98765 43210", hours: "10 AM - 9 PM", status: "open" },
  { id: 2, name: "Delhi Main", address: "456 Jewel Avenue, Delhi", phone: "+91 98765 43211", hours: "10 AM - 8 PM", status: "open" },
  { id: 3, name: "Chennai South", address: "789 Diamond Road, Chennai", phone: "+91 98765 43212", hours: "11 AM - 9 PM", status: "closed" },
  { id: 4, name: "Kolkata East", address: "321 Pearl Lane, Kolkata", phone: "+91 98765 43213", hours: "10 AM - 8 PM", status: "open" },
];

const Store = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground">Store Management</h1>
                <p className="text-sm text-muted-foreground">Manage your branch stores</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search stores..." className="pl-9 w-64" />
              </div>
            </div>
          </header>

          <div className="p-6 space-y-8">
            <GoldDivider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stores.map((store, index) => (
                <LuxuryCard key={store.id} delay={index * 100}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 gradient-gold rounded-full flex items-center justify-center shadow-gold">
                      <StoreIcon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      store.status === "open" 
                        ? "bg-green-500/20 text-green-400" 
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {store.status === "open" ? "Open" : "Closed"}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-lg mb-3">{store.name}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{store.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{store.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{store.hours}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="gold-outline" size="sm" className="flex-1">Edit</Button>
                    <Button variant="gold-outline" size="sm" className="flex-1">View Details</Button>
                  </div>
                </LuxuryCard>
              ))}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Store;
