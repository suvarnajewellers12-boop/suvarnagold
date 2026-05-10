"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, Lock, Trash2, Search, Plus,
  ChevronRight, ScanLine, User, Phone,
  Mail, MapPin, Landmark, ReceiptText, ArrowLeft,
  RefreshCcw, CheckCircle2, Percent, Edit3, Wallet, CreditCard, Banknote, Loader2, X, Printer, LayoutDashboard,
  ShieldCheck, History, UserPlus, Fingerprint, Coins, Scale
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SUVARNA LUXURY BILLING & POS SYSTEM 
 * Version: 2.5.0 (Enterprise Gold Edition - Multi-Metal Logic)
 * Enhanced Coupon Logic: 
 * - Cash: Universal Metal Application + Tax-only fallback
 * - Gold Wallet: 22K Restriction + VA Optimization
 */

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ==========================================
  // 1. PERSISTENT STATES & DATA INIT
  // ==========================================
  const getSaved = (key: string, fallback: any) => {
    if (typeof window === "undefined") return fallback;
    const saved = sessionStorage.getItem(key);
    try {
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [inventory, setInventory] = useState<any[]>([]);
  const [liveRates, setLiveRates] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [cart, setCart] = useState<any[]>(() => getSaved("pos_cart", []));
  const [customer, setCustomer] = useState(() => getSaved("pos_customer", { name: "", phone: "", email: "", address: "" }));
  const [couponData, setCouponData] = useState<any>(() => getSaved("pos_coupon", null));
  const [couponCode, setCouponCode] = useState(() => getSaved("pos_coupon_code", ""));
  const [managerDiscountPercent, setManagerDiscountPercent] = useState<number>(() => getSaved("pos_mgr_disc", 0));

  const [isOtpVerified, setIsOtpVerified] = useState(() => getSaved("pos_otp_verified", false));
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const [isExchangeApplied, setIsExchangeApplied] = useState(() => getSaved("pos_exchange_active", false));
  const [exchangeData, setExchangeData] = useState(() => getSaved("pos_exchange_data", { name: "", grams: 0, discount: 0 }));

  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [paymentMethods, setPaymentMethods] = useState({ cash: false, upi: false, card: false, cheque: false });
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: 0, upi: 0, card: 0, cheque: 0 });

  // ==========================================
  // 2. STATE CLEARANCE LOGIC
  // ==========================================

  const performHardReset = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("pos_cart_backup");
      localStorage.removeItem("last_customer_ref");
    }
    setCart([]);
    setCustomer({ name: "", phone: "", email: "", address: "" });
    setCheckoutStep(1);
    setCouponData(null);
    setCouponCode("");
    setManagerDiscountPercent(0);
    setIsOtpVerified(false);
    setIsOtpSent(false);
    setOtp("");
    setIsExchangeApplied(false);
    setExchangeData({ name: "", grams: 0, discount: 0 });
    setPaymentMethods({ cash: false, upi: false, card: false, cheque: false });
    setPaymentAmounts({ cash: 0, upi: 0, card: 0, cheque: 0 });
    setSearch("");
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
    sessionStorage.setItem("pos_customer", JSON.stringify(customer));
    sessionStorage.setItem("pos_coupon", JSON.stringify(couponData));
    sessionStorage.setItem("pos_coupon_code", JSON.stringify(couponCode));
    sessionStorage.setItem("pos_mgr_disc", JSON.stringify(managerDiscountPercent));
    sessionStorage.setItem("pos_otp_verified", JSON.stringify(isOtpVerified));
    sessionStorage.setItem("pos_exchange_active", JSON.stringify(isExchangeApplied));
    sessionStorage.setItem("pos_exchange_data", JSON.stringify(exchangeData));
  }, [cart, customer, couponData, couponCode, managerDiscountPercent, isOtpVerified, isExchangeApplied, exchangeData]);

  // ==========================================
  // 3. MATH HELPERS
  // ==========================================

  const checkIsSilver = useCallback((item: any) => {
    const metal = (item.metalType || "").toLowerCase();
    const carats = String(item.carats || "").toLowerCase();
    return metal === "silver" || carats.includes("silver") || carats.includes("925") || carats.includes("99");
  }, []);

  const checkIs22K = useCallback((item: any) => {
    return String(item.carats || "").includes("22") && !checkIsSilver(item);
  }, [checkIsSilver]);

  const getRateForItem = useCallback((item: any) => {
    if (!liveRates) return 0;
    if (checkIsSilver(item)) {
      const baseSilver = parseFloat(String(liveRates.silver).replace(/[^\d.-]/g, ''));
      const purity = parseFloat(item.purity || item.carats || 100);
      return (baseSilver * (purity / 100));
    } else {
      const carat = String(item.carats || "").replace(/\D/g, "");
      const rateKey = carat === "18" ? "gold18" : carat === "22" ? "gold22" : "gold24";
      const rawRate = liveRates[rateKey] || "0";
      return parseFloat(String(rawRate).replace(/[^\d.-]/g, ''));
    }
  }, [liveRates, checkIsSilver]);

  const getDynamicPrice = useCallback((item: any) => {
    if (item.manualPrice !== undefined && item.manualPrice !== null) return Number(item.manualPrice);
    if (!liveRates || !item.grams) return 0;
    const rate = getRateForItem(item);
    const base = rate * item.grams;
    const vaPercent = parseFloat(item.va || 0);
    return Math.round(base + (base * (vaPercent / 100)));
  }, [liveRates, getRateForItem]);

  const getItemCalculationDetail = (item: any) => {
    if (!liveRates) return (
      <div className="flex items-center gap-2">
        <Loader2 size={10} className="animate-spin" />
        <span className="text-[9px] uppercase">Retrieving Global Market Rates...</span>
      </div>
    );
    const rate = getRateForItem(item);
    const gross = item.grams * rate;
    const vaAmt = gross * (parseFloat(item.va || 0) / 100);
    const isGold22 = checkIs22K(item);

    return (
      <div className="space-y-1.5 mt-1 border-l-2 border-gold/20 pl-3">
        <p className="tracking-tight text-slate-500 text-[10px]">
          <span className="font-bold text-slate-700">Formula:</span> ({item.grams}g × ₹{rate.toLocaleString()}) + (VA {item.va}%: ₹{Math.round(vaAmt).toLocaleString()})
        </p>
        {!isGold22 && !checkIsSilver(item) && (
          <div className="flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-md w-fit">
            <Lock size={8} className="text-red-500" />
            <p className="text-red-500 text-[7px] font-black uppercase tracking-tighter">Gold Credit: Restricted to 22K Hallmarked Items Only</p>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 4. AGGREGATE CALCULATION (ENHANCED COUPON LOGIC)
  // ==========================================

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (getDynamicPrice(item) * item.quantity + item.stoneCost), 0);
  }, [cart, getDynamicPrice]);

  const couponAdjustments = useMemo(() => {
    if (!couponData || cart.length === 0 || !liveRates) return { goldCredit: 0, vaCredit: 0, cashCredit: 0 };

    // CASE A: CASH VOUCHER (Universal Application)
    if (couponData.type === "CASH") {
      // If coupon > subtotal, we cap at subtotal so user only pays taxes
      const appliedCash = Math.min(couponData.value, subtotal);
      return { goldCredit: 0, vaCredit: 0, cashCredit: appliedCash };
    }

    // CASE B: WEIGHT/GOLD WALLET VOUCHER (22K Restricted)
    const gold22Rate = parseFloat(String(liveRates.gold22 || "0").replace(/[^\d.-]/g, ''));
    let remainingGrams = couponData.value;
    let totalGoldSaved = 0;
    let totalVaSaved = 0;

    // Prioritize 22K items with highest VA to maximize customer benefit
    const eligible22K = cart
      .filter(item => checkIs22K(item))
      .sort((a, b) => parseFloat(b.va) - parseFloat(a.va));

    eligible22K.forEach((item) => {
      if (remainingGrams <= 0) return;
      const weightUsed = Math.min(item.grams, remainingGrams);
      const goldVal = weightUsed * gold22Rate;
      totalGoldSaved += goldVal;
      // VA is calculated ONLY on the 22K portion used
      totalVaSaved += goldVal * (parseFloat(item.va || 0) / 100);
      remainingGrams -= weightUsed;
    });

    // Note: Per user instruction, remaining weight from Gold Wallet is NOT applied to non-22K items
    return { goldCredit: totalGoldSaved, vaCredit: totalVaSaved, cashCredit: 0 };
  }, [couponData, cart, liveRates, subtotal, checkIs22K]);

  const cgst = subtotal * 0.015;
  const sgst = subtotal * 0.015;
  const managerWaiver = isOtpVerified ? (subtotal * (managerDiscountPercent / 100)) : 0;
  const exchangeDiscountValue = isExchangeApplied ? exchangeData.discount : 0;

  const goldCartWeight = cart.filter(i => !checkIsSilver(i)).reduce((acc, i) => acc + Number(i.grams || 0), 0);

  // Logic to determine overall discount including universal cash voucher
  const totalDeductions = (
    managerWaiver +
    exchangeDiscountValue +
    couponAdjustments.goldCredit +
    couponAdjustments.vaCredit +
    couponAdjustments.cashCredit
  );

  const total = Math.max(0, Math.round((subtotal + cgst + sgst) - totalDeductions));

  // ==========================================
  // 5. INTELLIGENT PAYMENT SPLITTING
  // ==========================================

  const handleMethodToggle = (method: string, isChecked: boolean) => {
    const updatedMethods = { ...paymentMethods, [method]: isChecked };
    setPaymentMethods(updatedMethods);
    const activeMethods = Object.keys(updatedMethods).filter(k => updatedMethods[k as keyof typeof paymentMethods]);
    const methodCount = activeMethods.length;

    if (methodCount === 0) {
      setPaymentAmounts({ cash: 0, upi: 0, card: 0, cheque: 0 });
    } else if (methodCount === 1) {
      const newAmounts = { cash: 0, upi: 0, card: 0, cheque: 0 };
      newAmounts[activeMethods[0] as keyof typeof paymentAmounts] = total;
      setPaymentAmounts(newAmounts);
    } else {
      const splitValue = Math.floor(total / methodCount);
      const remainder = total % methodCount;
      const newAmounts = { cash: 0, upi: 0, card: 0, cheque: 0 };
      activeMethods.forEach((m, idx) => {
        newAmounts[m as keyof typeof paymentAmounts] = splitValue + (idx === 0 ? remainder : 0);
      });
      setPaymentAmounts(newAmounts);
    }
  };

  const totalPaidSoFar = Object.values(paymentAmounts).reduce((a, b) => a + b, 0);
  const remainingToPay = Math.round(total - totalPaidSoFar);

  // ==========================================
  // 6. HANDLERS
  // ==========================================

  const addItemToCart = (product: any) => {
    if (cart.some(item => item.sku === product.sku)) {
      setToastMessage("Security: Item already present in Checkout Vault.");
      setShowToast(true);
      return;
    }
    if (product.isSold) {
      setToastMessage("Access Denied: Product is marked as SOLD.");
      setShowToast(true);
      return;
    }
    setCart(prev => [...prev, { ...product, quantity: 1 }]);
    setToastMessage(`${product.name} Secured`);
    setShowToast(true);
    setSearch("");
    setShowDropdown(false);
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const processScannedBarcode = (scannedValue: string) => {
    const skuCode = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;
    const product = inventory.find(p => p.sku === skuCode || p.barcode === skuCode);
    if (product) addItemToCart(product);
    else {
      setToastMessage("Inventory Error: Product not found in database.");
      setShowToast(true);
    }
  };

  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === "INPUT" && activeElement.id !== "search-input") return;
      if (Date.now() - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault();
        processScannedBarcode(barcodeBuffer);
        barcodeBuffer = "";
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      lastKeyTime = Date.now();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, inventory]);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsApplyingCoupon(true);
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        // FRONTEND CHECK: If coupon is weight-based (Gold Wallet), cart must have 22K
        if (data.type === "WEIGHT") {
          const has22K = cart.some(item => checkIs22K(item));
          if (!has22K) {
            setToastMessage("Restriction: Gold Wallet vouchers require 22K Gold in cart.");
            setShowToast(true);
            setIsApplyingCoupon(false);
            return;
          }
        }
        setCouponData(data);
      } else {
        setToastMessage(data.error || "Invalid Coupon Credentials");
        setShowToast(true);
      }
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRequestOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpSent(true);
        setToastMessage("Admin Verification OTP Sent");
        setShowToast(true);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      if ((await res.json()).success) {
        setIsOtpVerified(true);
        setToastMessage("Authorization Confirmed");
        setShowToast(true);
      }
    } finally { setOtpLoading(false); }
  };

  const handleCheckout = async () => {
    if (remainingToPay !== 0 || isFinalizing) {
      setToastMessage("Payment Mismatch: Please settle the full balance.");
      setShowToast(true);
      return;
    }
    setIsFinalizing(true);
    try {
      const response = await fetch("http://localhost:3000/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          purchaseData: {
            customerName: customer.name,
            phoneNumber: customer.phone,
            emailid: customer.email,
            Address: customer.address,
            totalAmount: subtotal,
            cgstAmount: cgst,
            sgstAmount: sgst,
            jewelleryexchangediscount: exchangeDiscountValue || 0,
            excahngejewellryname: isExchangeApplied ? exchangeData.name : null,
            excahngejewellrygrams: isExchangeApplied ? exchangeData.grams : null,
            discountAmount: managerWaiver || 0,
            finalAmount: total,
            couponDiscount: (couponAdjustments.goldCredit + couponAdjustments.vaCredit + couponAdjustments.cashCredit) || 0,
            items: cart.map(item => ({
              productId: item.id,
              name: item.name,
              sku: item.sku,
              grams: item.grams,
              cost: getDynamicPrice(item)
            })),
          },
          paymentBreakdown: {
            cash: paymentAmounts.cash,
            upi: paymentAmounts.upi,
            card: paymentAmounts.card,
            cheque: paymentAmounts.cheque
          }
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (couponData) {
          await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode}/used`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        setToastMessage("Purchase Completed Successfully.");
        setShowToast(true);
        performHardReset();
        setTimeout(() => { window.location.href = "admin/reports"; }, 2000);
      } else {
        throw new Error(data.error || "Verification failed on server side.");
      }
    } catch (e: any) {
      setToastMessage(e.message || "Checkout Failed");
      setShowToast(true);
    } finally {
      setIsFinalizing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [r, p] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setLiveRates(await r.json());
        const prodJson = await p.json();
        setInventory(prodJson.products || []);
      } catch (e) {
        console.error("Initialization Critical Error", e);
      }
    };
    if (token) init();
  }, [token]);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return inventory.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5);
  }, [search, inventory]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden print:bg-white selection:bg-gold/30">
        <div className="print:hidden">
          <AdminSidebar />
        </div>

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden print:h-auto">
          {/* HEADER SECTION */}
          <header className="px-10 py-4 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50 print:hidden shadow-sm">
            <div className="flex items-center gap-8 flex-1">
              <div className="flex items-center gap-3 border-r-2 border-gold/10 pr-10">
                <div className="bg-gold p-2 rounded-lg">
                  <Landmark className="text-white" size={24} />
                </div>
                <h1 className="text-xl font-serif font-black text-slate-900 tracking-tighter">
                  SUVARNA <span className="text-gold font-sans font-medium text-xs tracking-[0.3em] block">ENTERPRISE POS</span>
                </h1>
              </div>

              <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/60" />
                <Input
                  id="search-input"
                  placeholder="Universal Search: Scan Barcode or Type SKU..."
                  value={search}
                  autoComplete="off"
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  className="pl-12 h-12 rounded-xl bg-slate-50 border-gold/20 focus-visible:ring-gold transition-all focus:bg-white"
                />

                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gold/10 shadow-2xl rounded-2xl z-[100] overflow-hidden">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 border-b hover:bg-gold/5 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                            <Coins size={18} className="text-gold" />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-black uppercase tracking-tight ${p.isSold ? 'line-through text-gray-400' : 'text-slate-800'}`}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] border-gold/30 text-gold py-0 h-4">{p.sku}</Badge>
                              <span className="text-[10px] text-slate-400 font-bold">{p.grams}g • VA: {p.va}%</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          disabled={p.isSold || cart.some(i => i.sku === p.sku)}
                          onClick={() => addItemToCart(p)}
                          variant="gold" size="icon" className="h-9 w-9 rounded-full"
                        >
                          <Plus size={18} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end mr-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Gold 22K</p>
                <p className="text-sm font-serif font-black text-emerald-600">₹{liveRates?.gold22 || "0.00"}</p>
              </div>
              <div className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[11px] font-black uppercase tracking-[0.2em]">
                <ScanLine size={16} className="animate-pulse" /> Live
              </div>
              <Button onClick={() => window.location.href = "/dashboard/reports"} variant="ghost" className="h-11 rounded-full px-6 text-slate-600 hover:text-gold font-bold">
                <LayoutDashboard className="mr-2" size={18} /> Analytics
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-10 py-8 gap-8 print:block print:px-0">
            {/* LEFT SECTION: CART VAULT */}
            <div className="w-[62%] flex flex-col overflow-hidden print:w-full">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[3rem] bg-white border-2 border-gold/5 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                <div className="px-10 py-6 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                      <ShoppingCart className="text-gold" size={20} />
                    </div>
                    <h2 className="text-xl font-serif font-black text-slate-800">Secured Checkout Vault</h2>
                  </div>
                  <Badge className="bg-slate-900 text-gold rounded-xl px-4 py-1.5 text-[11px] font-black">
                    {cart.length} ITEMS
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar print:overflow-visible">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                      <div className="p-10 rounded-full bg-slate-50 border-2 border-dashed border-gold/20">
                        <Banknote size={80} className="text-gold" />
                      </div>
                      <p className="text-lg font-serif italic text-slate-500">Inventory Vault Standby</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="group relative flex justify-between items-center p-6 rounded-[2.5rem] border-2 border-gold/5 bg-white hover:border-gold/30 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-8">
                          <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-gold font-serif text-2xl font-black border-2 border-gold/10 group-hover:bg-gold group-hover:text-white transition-all shadow-inner">
                            {item.name.charAt(0)}
                          </div>
                          <div className="space-y-2">
                            <p className="text-base font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                            <div className="text-[10px] font-black text-slate-400 space-y-1.5 uppercase">
                              <div className="flex items-center gap-3">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">{item.carats}</span>
                                <span className="flex items-center gap-1"><Scale size={12} className="text-gold/50" /> {item.grams} Grams</span>
                                <span className="text-gold bg-gold/5 px-2 py-0.5 rounded border border-gold/10">VA: {item.va}%</span>
                              </div>
                              <div className="text-gold italic font-serif leading-relaxed drop-shadow-sm">{getItemCalculationDetail(item)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xl font-black text-slate-900 italic tracking-tighter">₹{(getDynamicPrice(item) * item.quantity+item.stoneCost).toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Item Cost</p>
                          </div>
                          <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="h-12 w-12 rounded-full text-slate-200 hover:text-red-500 transition-all print:hidden">
                            <Trash2 size={20} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-10 py-6 bg-slate-50 border-t border-gold/10 flex justify-between items-center print:hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Asset Verification: <span className="text-emerald-600">PASS</span></p>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-700">ENCRYPTED TRANSACTION</span>
                  </div>
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT SECTION: SETTLEMENT PANEL */}
            <div className="w-[38%] flex flex-col overflow-hidden h-full print:w-full">
              <LuxuryCard className="flex-1 flex flex-col p-8 bg-[#FDFCF9] border-t-[12px] border-t-gold rounded-[3rem] shadow-2xl overflow-hidden print:border-none relative">
                {checkoutStep === 1 ? (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center gap-4 border-b-2 border-gold/10 pb-5 mb-8">
                      <ReceiptText className="text-gold" size={24} />
                      <h3 className="font-serif font-black text-xl text-slate-800 tracking-tight">Price Settlement</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
                      {/* ADMIN OTP SECTION */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Administrative Bypass
                          </label>

                          {/* RESEND TRIGGER: Only visible if OTP was sent but not yet verified */}
                          {isOtpSent && !isOtpVerified && (
                            <button
                              onClick={handleRequestOTP}
                              disabled={otpLoading || resendCountdown > 0}
                              className={cn(
                                "text-[10px] font-black uppercase tracking-tighter transition-all duration-300",
                                resendCountdown > 0
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-gold hover:text-amber-600 underline underline-offset-4"
                              )}
                            >
                              {resendCountdown > 0
                                ? `Resend in ${resendCountdown}s`
                                : "Resend Code"}
                            </button>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={16} />
                            <Input
                              placeholder="ADMIN OTP"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              disabled={isOtpVerified}
                              className="h-14 pl-12 rounded-2xl text-center font-serif font-black text-lg tracking-[0.6em] border-2 border-gold/10 focus-visible:ring-gold bg-white"
                            />
                          </div>

                          <Button
                            onClick={!isOtpSent ? handleRequestOTP : handleVerifyOTP}
                            disabled={otpLoading || isOtpVerified}
                            variant="gold"
                            className="h-14 w-32 rounded-2xl shadow-lg transition-transform active:scale-95"
                          >
                            {otpLoading ? (
                              <Loader2 className="animate-spin w-5 h-5" />
                            ) : isOtpVerified ? (
                              <CheckCircle2 size={24} />
                            ) : isOtpSent ? (
                              "VERIFY"
                            ) : (
                              "GET OTP"
                            )}
                          </Button>
                        </div>

                        {/* PRIVILEGED DISCOUNT AREA */}
                        {isOtpVerified && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 duration-500">
                            <div className="relative">
                              <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                              <Input
                                type="number"
                                placeholder="SPECIAL DISCOUNT %"
                                value={managerDiscountPercent || ""}
                                onChange={(e) => setManagerDiscountPercent(Number(e.target.value))}
                                className="h-14 pl-12 rounded-xl text-center font-black text-xl text-emerald-700 bg-emerald-50 border-emerald-200"
                              />
                            </div>
                            <div className="flex items-center justify-center gap-2 py-1 bg-emerald-100/50 rounded-lg border border-emerald-100">
                              <CheckCircle2 size={10} className="text-emerald-600" />
                              <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">
                                Privileged Discount Unlocked
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* VOUCHER MODULE */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                          <Wallet size={12} className="text-gold" /> Rewards Voucher
                        </label>
                        <div className="flex gap-3">
                          <Input
                            placeholder="VOUCHER CODE"
                            value={couponCode}
                            disabled={!!couponData}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="h-12 rounded-2xl border-2 border-dashed border-gold/30 text-center font-black tracking-widest text-primary"
                          />
                          {!couponData ? (
                            <Button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} variant="gold" className="h-12 px-8 rounded-2xl shadow-md">Apply</Button>
                          ) : (
                            <Button onClick={() => { setCouponData(null); setCouponCode(""); }} variant="ghost" className="h-12 px-6 text-red-500 border-2 border-red-100 rounded-2xl hover:bg-red-50">Reset</Button>
                          )}
                        </div>
                        {couponData && (
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                            <p className="text-[10px] font-black text-blue-700 text-center uppercase tracking-tighter italic">
                              Voucher Type: {couponData.type} - {couponData.type === 'CASH' ? 'Applicable Globally' : '22K Gold Specific'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* EXCHANGE MODULE */}
                      <div className={cn(
                        "p-6 rounded-[2rem] border-2 transition-all duration-500",
                        isExchangeApplied ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-gold/5"
                      )}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <RefreshCcw className={cn("text-amber-600", isExchangeApplied && "animate-spin-slow")} size={18} />
                            <span className="text-[11px] font-black uppercase text-slate-700">Old Gold Exchange</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isExchangeApplied}
                            onChange={(e) => setIsExchangeApplied(e.target.checked)}
                            className="accent-gold h-5 w-5 cursor-pointer rounded"
                          />
                        </div>
                        {isExchangeApplied && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-3">
                            <div className="grid grid-cols-2 gap-3">
                              <Input placeholder="Description" value={exchangeData.name} onChange={(e) => setExchangeData({ ...exchangeData, name: e.target.value })} className="h-11 rounded-xl text-xs font-bold" />
                              <Input type="number" placeholder="Net Wt (g)" value={exchangeData.grams || ""} onChange={(e) => setExchangeData({ ...exchangeData, grams: Number(e.target.value) })} className="h-11 rounded-xl text-xs font-bold" />
                            </div>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold">₹</span>
                              <Input
                                type="number"
                                placeholder="Approved Exchange Value"
                                className="h-12 pl-10 rounded-xl font-black text-lg bg-white border-amber-200"
                                value={exchangeData.discount || ""}
                                onChange={(e) => setExchangeData({ ...exchangeData, discount: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* FINANCIALS */}
                      <div className="space-y-4 pt-6 border-t-2 border-gold/10">
                        <div className="flex justify-between text-[12px] font-black text-slate-500 uppercase">
                          <span>Jewelry Value</span>
                          <span className="text-slate-900">₹{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[12px] font-black text-slate-400 uppercase">
                          <span>Tax (GST 3%)</span>
                          <span>₹{(cgst + sgst).toLocaleString()}</span>
                        </div>

                        {/* Deductions breakdown */}
                        <div className="space-y-3">
                          {couponAdjustments.cashCredit > 0 && (
                            <div className="flex justify-between text-[11px] font-black text-emerald-600 uppercase bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                              <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Cash Voucher Benefit</span>
                              <span>-₹{couponAdjustments.cashCredit.toLocaleString()}</span>
                            </div>
                          )}
                          {couponAdjustments.goldCredit > 0 && (
                            <div className="flex justify-between text-[11px] font-black text-blue-600 uppercase bg-blue-50/50 px-4 py-2 rounded-xl border border-blue-100">
                              <span>Gold Wallet: Weight Credit</span>
                              <span>-₹{couponAdjustments.goldCredit.toLocaleString()}</span>
                            </div>
                          )}
                          {couponAdjustments.vaCredit > 0 && (
                            <div className="flex justify-between text-[11px] font-black text-blue-600 italic uppercase bg-blue-50/50 px-4 py-2 rounded-xl border border-blue-100">
                              <span>Gold Wallet: VA Credit</span>
                              <span>-₹{couponAdjustments.vaCredit.toLocaleString()}</span>
                            </div>
                          )}
                          {managerWaiver > 0 && <div className="flex justify-between text-[12px] font-black text-emerald-600 uppercase"><span>Manager Waiver</span><span>-₹{managerWaiver.toLocaleString()}</span></div>}
                          {exchangeDiscountValue > 0 && <div className="flex justify-between text-[12px] font-black text-amber-600 uppercase"><span>Exchange Value</span><span>-₹{exchangeDiscountValue.toLocaleString()}</span></div>}
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 mt-4 border-t-4 border-gold/10">
                      <div className="flex justify-between items-center mb-6 px-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Net Payable</span>
                        <p className="text-4xl font-serif font-black text-slate-900 italic tracking-tighter">₹{total.toLocaleString()}</p>
                      </div>
                      <Button
                        disabled={cart.length === 0}
                        onClick={() => setCheckoutStep(2)}
                        variant="gold"
                        className="w-full h-16 rounded-[1.5rem] shadow-xl text-lg font-black uppercase tracking-widest"
                      >
                        SETTLE BALANCE <ChevronRight size={22} className="ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-3 text-gold text-xs font-black uppercase mb-8 hover:underline tracking-widest">
                      <ArrowLeft size={20} /> REVISE PRICING
                    </button>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                          <User size={14} /> Client Identity
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input placeholder="Client Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-14 rounded-2xl" />
                          <Input placeholder="Phone Number" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "") })} className="h-14 rounded-2xl" />
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <Input placeholder="Email Address" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="h-14 pl-12 rounded-2xl" />
                        </div>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <Input placeholder="Permanent Address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="h-14 pl-12 rounded-2xl" />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                          <CreditCard size={14} /> Payment Allocation
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.keys(paymentMethods).map((method) => (
                            <div
                              key={method}
                              className={cn(
                                "p-5 rounded-3xl border-4 transition-all duration-300",
                                paymentMethods[method as keyof typeof paymentMethods] ? "border-gold bg-white shadow-lg" : "opacity-40 bg-slate-100 border-transparent"
                              )}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={paymentMethods[method as keyof typeof paymentMethods]}
                                    onChange={(e) => handleMethodToggle(method, e.target.checked)}
                                    className="accent-gold h-5 w-5 cursor-pointer"
                                  />
                                  <span className="text-[10px] font-black uppercase tracking-tighter">{method}</span>
                                </div>
                              </div>
                              {paymentMethods[method as keyof typeof paymentMethods] && (
                                <div className="relative animate-in zoom-in-95">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold font-bold text-xs">₹</span>
                                  <Input
                                    type="number"
                                    className="h-12 pl-7 text-right font-black text-base rounded-xl border-gold/20"
                                    value={paymentAmounts[method as keyof typeof paymentAmounts] || ""}
                                    onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [method]: Number(e.target.value) })}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 mt-4 border-t-4 border-slate-100 bg-white -mx-8 px-8 py-6 shadow-2xl">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Amount Paid</span>
                          <span className="text-2xl font-black italic">₹{totalPaidSoFar.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Balance Dues</span>
                          <span className={cn(
                            "text-2xl font-black italic transition-colors duration-500",
                            remainingToPay === 0 ? "text-emerald-600" : "text-red-500 animate-pulse"
                          )}>₹{remainingToPay.toLocaleString()}</span>
                        </div>
                      </div>
                      <Button
                        onClick={handleCheckout}
                        variant="gold"
                        className="w-full h-18 rounded-3xl text-xl font-black uppercase tracking-widest py-8"
                        disabled={remainingToPay !== 0 || !customer.name || !customer.phone || isFinalizing}
                      >
                        {isFinalizing ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="animate-spin w-6 h-6" />
                            <span>GENERATING INVOICE...</span>
                          </div>
                        ) : "FINALIZE PURCHASE"}
                      </Button>
                    </div>
                  </div>
                )}
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      {/* FOOTER SCANNER STATUS */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 pointer-events-none print:hidden">
        <div className="bg-slate-900/80 backdrop-blur-md text-gold px-6 py-2 rounded-full flex items-center gap-3 border border-gold/20 shadow-2xl">
          <ScanLine size={14} className="animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Scanner Core Optimized - V2.5.0</span>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default BillingPOS;