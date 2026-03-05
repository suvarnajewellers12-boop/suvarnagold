import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminManagement from "./pages/AdminManagement";
import Products from "./pages/Products";
import Store from "./pages/Store";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SuperAdminCreateScheme from "./pages/admin/AdminCreateSchemes";
import GoldJobWorkPage from "./pages/GoldJobWorkPage";
import GoldPurchasePage from "./pages/GoldPurchasePage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSchemesView from "./pages/admin/AdminCreateSchemes";
import CustomerManagement from "./pages/admin/AdminCustomer";
import StaffManagement from "./pages/staff";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          
          {/* Super Admin Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/admins" element={<AdminManagement />} />
          <Route path="/dashboard/products" element={<Products />} />
          <Route path="/dashboard/store" element={<Store />} />
          <Route path="/dashboard/billing" element={<Billing />} />
          <Route path="/dashboard/reports" element={<Reports />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/dashboard/create-scheme" element={<AdminSchemesView />} />
          <Route path="/dashboard/customers" element={<CustomerManagement />} />
          <Route path="/dashboard/staff" element={<StaffManagement />} />
          <Route path="/dashboard/jobwork" element={<GoldJobWorkPage />} />
          <Route path="/dashboard/gold-purchase" element={<GoldPurchasePage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/billing" element={<AdminBilling />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/create-scheme" element={<SuperAdminCreateScheme />} />
          <Route path="/admin/customers" element={<CustomerManagement />} />
          
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
