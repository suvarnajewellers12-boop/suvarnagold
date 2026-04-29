import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useSpeech } from "@/hooks/useSpeech";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAccessibility, AccessibilityProvider } from "./components/context/AccessibilityContext";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import EstimationTerminal from "./pages/EstimationTerminal";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminManagement from "./pages/AdminManagement";
import Products from "./pages/Products";
import Store from "./pages/Store";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SuperAdminCreateScheme from "./pages/CreateScheme";
import GoldJobWorkPage from "./pages/GoldJobWorkPage";
import GoldPurchasePage from "./pages/GoldPurchasePage";
import SuperadminCustomerMangement from "./pages/Customers";
import CreditNote from "./pages/CreditNote";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import CustomerManagement from "./pages/admin/AdminCustomer";
import StaffManagement from "./pages/staff";
import ProductsList from "./pages/ProductsList";
import AdminCreateScheme from "./pages/admin/AdminCreateSchemes";

const queryClient = new QueryClient();

/* ============================
   🔊 ROUTE ANNOUNCER
============================ */

const RouteAnnouncer = () => {
  const location = useLocation();
  const { speak, stop } = useSpeech();
  const { isEnabled } = useAccessibility();

  const previousPathRef = useRef<string | null>(null);
  const isFirstLoadRef = useRef(true);
  const isSpeechUnlockedRef = useRef(false);
  const pendingMessageRef = useRef<string | null>(null);

  // 🔥 Keyboard shortcuts
  useKeyboardShortcuts();

  // 🔓 Unlock speech (browser restriction workaround)
  useEffect(() => {
    if (!isEnabled) return;

    const unlockSpeech = () => {
      console.log("🔓 User interaction → unlocking speech");

      isSpeechUnlockedRef.current = true;

      if (pendingMessageRef.current) {
        speak(pendingMessageRef.current);
        pendingMessageRef.current = null;
      }

      window.removeEventListener("click", unlockSpeech);
      window.removeEventListener("keydown", unlockSpeech);
    };

    window.addEventListener("click", unlockSpeech);
    window.addEventListener("keydown", unlockSpeech);

    return () => {
      window.removeEventListener("click", unlockSpeech);
      window.removeEventListener("keydown", unlockSpeech);
    };
  }, [isEnabled, speak]);

  useEffect(() => {
    if (!isEnabled) return;

    const getReadablePageName = (path: string) => {
      if (path === "/") return "home page";
      if (path === "/login") return "login page";

      const cleanPath = path.replace(/^\/+/, "");
      return cleanPath.split("/").join(" ") + " page";
    };

    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    let message = "";

    if (isFirstLoadRef.current) {
      message =
        currentPath === "/"
          ? "Welcome Venky to the Suvarna portal."
          : `You opened ${getReadablePageName(currentPath)}`;

      isFirstLoadRef.current = false;
    } else if (currentPath === "/" && previousPath !== "/") {
      message = "Back to home page.";
    } else {
      message = `You opened ${getReadablePageName(currentPath)}`;
    }

    const triggerSpeech = () => {
      stop();

      if (!isSpeechUnlockedRef.current) {
        pendingMessageRef.current = message;
        return;
      }

      speak(message);
    };

    const timeout = setTimeout(triggerSpeech, 600);

    previousPathRef.current = currentPath;

    return () => clearTimeout(timeout);
  }, [location.pathname, speak, stop, isEnabled]);

  return null;
};

/* ============================
   🔥 MAIN APP
============================ */

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <AccessibilityProvider>
        <BrowserRouter>
          {/* 🔊 Accessibility Controller */}
          <RouteAnnouncer />

          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />

            {/* Super Admin Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/photos" element={<ProductsList />} />
            <Route path="/dashboard/admins" element={<AdminManagement />} />
            <Route path="/dashboard/products" element={<Products />} />
            <Route path="/dashboard/store" element={<Store />} />
            <Route path="/dashboard/billing" element={<Billing />} />
            <Route path="/dashboard/reports" element={<Reports />} />
            <Route path="/dashboard/credit-notes" element={<CreditNote />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/estimation-terminal" element={<EstimationTerminal />} />
            <Route path="/dashboard/create-scheme" element={<SuperAdminCreateScheme />} />
            <Route path="/dashboard/customers" element={<SuperadminCustomerMangement />} />
            <Route path="/dashboard/staff" element={<StaffManagement />} />
            <Route path="/dashboard/jobwork" element={<GoldJobWorkPage />} />
            <Route path="/dashboard/gold-purchase" element={<GoldPurchasePage />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/create-scheme" element={<AdminCreateScheme />} />
            <Route path="/admin/customers" element={<CustomerManagement />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AccessibilityProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;