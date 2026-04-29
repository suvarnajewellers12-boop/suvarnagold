"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
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
  RefreshCcw, CheckCircle2, Percent, Edit3, Wallet, CreditCard, Banknote, Loader2, X, Printer, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ==========================================
  // 1. PERSISTENT STATES & DATA INIT
  // ==========================================
  const getSaved = (key: string, fallback: any) => {
    if (typeof window === "undefined") return fallback;
    const saved = sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
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
  const [isExchangeApplied, setIsExchangeApplied] = useState(() => getSaved("pos_exchange_active", false));
  const [exchangeData, setExchangeData] = useState(() => getSaved("pos_exchange_data", { name: "", grams: 0, discount: 0 }));

  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // PAYMENT STATES
  const [paymentMethods, setPaymentMethods] = useState({ cash: false, upi: false, card: false, cheque: false });
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: 0, upi: 0, card: 0, cheque: 0 });

  // Sync Logic
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
  // 2. MATH HELPERS (Metal + VA + Logic)
  // ==========================================

  const checkIsSilver = useCallback((item: any) => {
    const metal = (item.metalType || "").toLowerCase();
    const carats = String(item.carats || "").toLowerCase();
    return metal === "silver" || carats.includes("silver") || carats.includes("925") || carats.includes("99");
  }, []);

  const getRateForItem = useCallback((item: any) => {
    if (!liveRates) return 0;
    if (checkIsSilver(item)) {
      const baseSilver = parseFloat(String(liveRates.silver).replace(/[^\d.-]/g, ''));
      const purity = parseFloat(item.purity || item.carats || 100);
      return (baseSilver * (purity/100));
    } else {
      const carat = String(item.carats || "").replace(/\D/g, "");
      const rateKey = carat === "18" ? "gold18" : carat === "22" ? "gold22" : "gold24";
      return parseFloat(String(liveRates[rateKey] || "0").replace(/[^\d.-]/g, ''));
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
    if (!liveRates) return "Syncing Live Rates...";
    const rate = getRateForItem(item);
    const gross = item.grams * rate;
    const vaAmt = gross * (parseFloat(item.va || 0) / 100);
    const isGold22 = String(item.carats).includes("22") && !checkIsSilver(item);
    return (
      <div className="space-y-1">
        <p className="tracking-tight text-slate-500">({item.grams}g × ₹{rate.toLocaleString()}) + (VA: ₹{Math.round(vaAmt).toLocaleString()})</p>
        {!isGold22 && !checkIsSilver(item) && <p className="text-red-500 text-[7px] font-bold uppercase tracking-tighter">Gold Credit: Restricted to 22K Hallmarked Items Only</p>}
      </div>
    );
  };

  // ==========================================
  // 3. AGGREGATE CALCULATION & VA OPTIMIZATION
  // ==========================================

  const couponAdjustments = useMemo(() => {
    if (!couponData || cart.length === 0 || !liveRates) return { goldCredit: 0, vaCredit: 0 };
    const gold22Rate = parseFloat(String(liveRates.gold22 || "0").replace(/[^\d.-]/g, ''));
    if (couponData.type === "CASH") return { goldCredit: couponData.value, vaCredit: 0 };

    let remainingGrams = couponData.value;
    let totalGoldSaved = 0;
    let totalVaSaved = 0;

    const eligible22K = cart
      .filter(item => String(item.carats).includes("22") && !checkIsSilver(item))
      .sort((a, b) => parseFloat(b.va) - parseFloat(a.va));

    eligible22K.forEach((item) => {
      if (remainingGrams <= 0) return;
      const weightUsed = Math.min(item.grams, remainingGrams);
      const goldVal = weightUsed * gold22Rate;
      totalGoldSaved += goldVal;
      totalVaSaved += goldVal * (parseFloat(item.va || 0) / 100);
      remainingGrams -= weightUsed;
    });

    if (remainingGrams > 0) {
      cart.filter(item => !String(item.carats).includes("22") && !checkIsSilver(item)).forEach(item => {
        if (remainingGrams <= 0) return;
        const weightUsed = Math.min(item.grams, remainingGrams);
        totalGoldSaved += (weightUsed * gold22Rate);
        remainingGrams -= weightUsed;
      });
    }
    return { goldCredit: totalGoldSaved, vaCredit: totalVaSaved };
  }, [couponData, cart, liveRates, checkIsSilver]);

  const subtotal = cart.reduce((acc, item) => acc + (getDynamicPrice(item) * item.quantity), 0);
  const cgst = subtotal * 0.015;
  const sgst = subtotal * 0.015;
  const managerWaiver = isOtpVerified ? (subtotal * (managerDiscountPercent / 100)) : 0;
  const exchangeDiscountValue = isExchangeApplied ? exchangeData.discount : 0;
  
  const goldCartWeight = cart.filter(i => !checkIsSilver(i)).reduce((acc, i) => acc + Number(i.grams || 0), 0);
  const isFullyCovered = couponData?.type === "WEIGHT" && couponData.value >= goldCartWeight && goldCartWeight > 0;

  const overallDiscount = isFullyCovered 
    ? cart.filter(i => !checkIsSilver(i)).reduce((acc, i) => acc + getDynamicPrice(i), 0) + managerWaiver + exchangeDiscountValue
    : (managerWaiver + exchangeDiscountValue + couponAdjustments.goldCredit + couponAdjustments.vaCredit);

  const total = Math.max(0, Math.round((subtotal + cgst + sgst) - overallDiscount));

  // ==========================================
  // 4. INTELLIGENT PAYMENT SPLITTING
  // ==========================================

  const handleMethodToggle = (method: string, isChecked: boolean) => {
    const updatedMethods = { ...paymentMethods, [method]: isChecked };
    setPaymentMethods(updatedMethods);

    // Filter which methods are active
    const activeMethods = Object.keys(updatedMethods).filter(k => updatedMethods[k as keyof typeof paymentMethods]);
    const methodCount = activeMethods.length;

    if (methodCount === 0) {
      setPaymentAmounts({ cash: 0, upi: 0, card: 0, cheque: 0 });
    } else if (methodCount === 1) {
      // Assign full amount to the single selected method
      const newAmounts = { cash: 0, upi: 0, card: 0, cheque: 0 };
      newAmounts[activeMethods[0] as keyof typeof paymentAmounts] = total;
      setPaymentAmounts(newAmounts);
    } else {
      // Split equally among selected methods
      const splitValue = Math.floor(total / methodCount);
      const remainder = total % methodCount;
      const newAmounts = { cash: 0, upi: 0, card: 0, cheque: 0 };
      
      activeMethods.forEach((m, idx) => {
        // Add remainder to the first selected method to ensure mathematical accuracy
        newAmounts[m as keyof typeof paymentAmounts] = splitValue + (idx === 0 ? remainder : 0);
      });
      setPaymentAmounts(newAmounts);
    }
  };

  const totalPaidSoFar = Object.values(paymentAmounts).reduce((a, b) => a + b, 0);
  const remainingToPay = Math.round(total - totalPaidSoFar);

  // ==========================================
  // 5. HANDLERS (SCANNER & DUPLICATE BLOCKING)
  // ==========================================

  const addItemToCart = (product: any) => {
    // DUPLICATE CHECK: Strictly block if SKU already in cart
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
    let barcodeBuffer = ""; let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === "INPUT" && activeElement.id !== "search-input") return;
      if (Date.now() - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault(); 
        processScannedBarcode(barcodeBuffer); 
        barcodeBuffer = "";
      } else if (e.key.length === 1) barcodeBuffer += e.key;
      lastKeyTime = Date.now();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, inventory]);

  // ==========================================
  // 6. FINALIZATION & NAVIGATION
  // ==========================================

  const handleCheckout = async () => {
    if (remainingToPay !== 0 || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const response = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/verify", {
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
            jewelleryexchangediscount: exchangeDiscountValue,
            excahngejewellryname: isExchangeApplied ? exchangeData.name : null,
            excahngejewellrygrams: isExchangeApplied ? exchangeData.grams : null,
            discountAmount: isFullyCovered ? subtotal : overallDiscount,
            finalAmount: total,
            items: cart.map(item => ({ productId: item.id, name: item.name, sku: item.sku, grams: item.grams, cost: getDynamicPrice(item) })),
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
        if (couponData) await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode}/used`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        
        // CLEAR SESSION DATA
        sessionStorage.clear();
        setCart([]);
        setCouponData(null);
        setToastMessage("Purchase Finalized Successfully.");
        setShowToast(true);

        // NAVIGATION: Redirect to Reports with cache refresh
        setTimeout(() => {
          window.location.href = "/dashboard/reports";
        }, 1500);
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) { 
      setToastMessage(e.message || "Checkout Failed"); 
      setShowToast(true); 
    } finally { 
      setIsFinalizing(false); 
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const has22K = cart.some(item => String(item.carats).includes("22") && !checkIsSilver(item));
    if (!has22K) {
      setToastMessage("Wastage Error: Cart must contain 22K Gold ornaments to apply benefit.");
      setShowToast(true); return;
    }
    setIsApplyingCoupon(true);
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setCouponData(data);
      else { setToastMessage(data.error || "Invalid Coupon Credentials"); setShowToast(true); }
    } finally { setIsApplyingCoupon(false); }
  };

  const handleRequestOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/generate", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if ((await res.json()).success) { setIsOtpSent(true); setToastMessage("Admin Verification OTP Sent"); setShowToast(true); }
    } finally { setOtpLoading(false); }
  };

  const handleVerifyOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      if ((await res.json()).success) { setIsOtpVerified(true); setToastMessage("Authorization Confirmed"); setShowToast(true); }
    } finally { setOtpLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [r, p] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setLiveRates(await r.json());
        setInventory((await p.json()).products || []);
      } catch (e) { console.error("Initialization Critical Error", e); }
    }; init();
  }, [token]);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return inventory.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).slice(0, 5);
  }, [search, inventory]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden print:bg-white">
        <div className="print:hidden"><DashboardSidebar /></div>
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden print:h-auto">
          
          <header className="px-10 py-4 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50 print:hidden shadow-sm">
            <div className="flex items-center gap-8 flex-1">
              <h1 className="text-xl font-serif font-black text-slate-900 flex items-center gap-3 border-r-2 border-gold/10 pr-10">
                <Landmark className="text-gold" size={22} /> SUVARNA POS
              </h1>
              <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/60" />
                <Input
                  id="search-input" 
                  placeholder="Scan or Search Product SKU..." 
                  value={search}
                  autoComplete="off"
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  className="pl-12 h-12 rounded-xl bg-slate-50 border-gold/20 focus-visible:ring-gold"
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gold/10 shadow-2xl rounded-2xl z-[100] overflow-hidden">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gold/5 transition-colors">
                        <div className="flex flex-col">
                          <span className={`text-xs font-black uppercase tracking-tight ${p.isSold ? 'line-through text-gray-400' : 'text-slate-800'}`}>
                            {p.name}
                          </span>
                          <span className="text-[10px] text-gold font-bold uppercase">{p.sku} • {p.grams}g • VA: {p.va}%</span>
                        </div>
                        <Button 
                          disabled={p.isSold || cart.some(i => i.sku === p.sku)} 
                          onClick={() => addItemToCart(p)} 
                          variant="gold" size="icon" className="h-9 w-9 rounded-full shadow-md"
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
              <div className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-sm">
                <ScanLine size={16} className="animate-pulse" /> Scanner Ready
              </div>
              <Button onClick={() => window.location.href="/dashboard/reports"} variant="ghost" className="h-11 rounded-full px-6 text-gold font-bold">
                <LayoutDashboard className="mr-2" size={18} /> Reports
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-10 py-8 gap-8 print:block print:px-0">
            {/* LEFT SECTION: CHECKOUT VAULT */}
            <div className="w-[62%] flex flex-col overflow-hidden print:w-full">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[3rem] bg-white border-2 border-gold/5 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                <div className="px-10 py-6 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9] print:bg-white">
                  <h2 className="text-xl font-serif font-black text-slate-800 flex items-center gap-3">
                    <ShoppingCart className="text-gold" size={24} /> Secured Checkout
                  </h2>
                  <Badge className="bg-slate-900 text-gold rounded-xl px-4 py-1.5 text-[11px] font-black print:hidden">
                    {cart.length} UNIQUE ITEMS
                  </Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar print:overflow-visible">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                       <Banknote size={80} className="mb-4 text-gold" />
                       <p className="text-lg font-serif italic text-slate-400">Vault is Empty. Scan products to begin.</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="group relative flex justify-between items-center p-6 rounded-[2.5rem] border-2 border-gold/5 bg-white hover:border-gold/30 hover:shadow-xl transition-all duration-300 print:border-b print:rounded-none">
                        <div className="flex items-center gap-8">
                          <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-gold font-serif text-xl font-black border-2 border-gold/10 group-hover:bg-gold group-hover:text-white transition-colors">
                            {item.name.charAt(0)}
                          </div>
                          <div className="space-y-2">
                            <p className="text-base font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                            <div className="text-[10px] font-black text-slate-400 space-y-1.5 uppercase">
                              <p className="flex items-center gap-2">
                                <span className="bg-slate-100 px-2 py-0.5 rounded">{item.carats}</span>
                                <span>{item.grams} Grams</span>
                                <span className="text-gold">Wastage: {item.va}%</span>
                              </p>
                              <div className="text-gold italic font-serif leading-relaxed drop-shadow-sm">{getItemCalculationDetail(item)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                             <p className="text-lg font-black text-slate-900 italic">₹{getDynamicPrice(item).toLocaleString()}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Item Cost</p>
                          </div>
                          <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="h-12 w-12 rounded-full text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all print:hidden">
                            <Trash2 size={20} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT SECTION: SETTLEMENT PANEL */}
            <div className="w-[38%] flex flex-col overflow-hidden h-full print:w-full print:mt-10">
              <LuxuryCard className="flex-1 flex flex-col p-8 bg-[#FDFCF9] border-t-[12px] border-t-gold rounded-[3rem] shadow-2xl overflow-hidden print:border-none print:shadow-none">
                
                {checkoutStep === 1 ? (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center gap-4 border-b-2 border-gold/10 pb-5 mb-8">
                       <ReceiptText className="text-gold" size={24} /> 
                       <h3 className="font-serif font-black text-xl text-slate-800 tracking-tight">Price Settlement</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2 print:overflow-visible">
                      {/* OTP & MANAGER SECTION */}
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={16} />
                             <Input 
                                placeholder="ADMIN AUTHORIZATION" 
                                value={otp} 
                                onChange={(e) => setOtp(e.target.value)} 
                                disabled={isOtpVerified} 
                                className="h-14 pl-12 rounded-2xl text-center font-serif font-black text-lg tracking-[0.6em] border-2 border-gold/10 focus-visible:ring-gold" 
                             />
                          </div>
                          <Button 
                            onClick={!isOtpSent ? handleRequestOTP : handleVerifyOTP} 
                            disabled={otpLoading || isOtpVerified} 
                            variant="gold" 
                            className="h-14 w-32 rounded-2xl shadow-lg"
                          >
                            {otpLoading ? <Loader2 className="animate-spin" /> : (isOtpVerified ? <CheckCircle2 size={24} /> : (isOtpSent ? "VERIFY" : "GET OTP"))}
                          </Button>
                        </div>
                        {isOtpVerified && (
                           <div className="relative animate-in zoom-in-95 duration-300">
                              <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                              <Input 
                                 type="number" 
                                 placeholder="SPECIAL DISCOUNT %" 
                                 value={managerDiscountPercent || ""} 
                                 onChange={(e) => setManagerDiscountPercent(Number(e.target.value))} 
                                 className="h-12 pl-12 rounded-xl text-center font-black text-xl text-emerald-700 bg-emerald-50 border-emerald-200" 
                              />
                           </div>
                        )}
                      </div>

                      {/* COUPON WALLET */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                          <Wallet size={12} className="text-gold" /> Rewards Voucher
                        </label>
                        <div className="flex gap-3">
                          <Input 
                             placeholder="ENTER VOUCHER CODE" 
                             value={couponCode} 
                             disabled={!!couponData} 
                             onChange={(e) => setCouponCode(e.target.value.toUpperCase())} 
                             className="h-12 rounded-2xl border-2 border-dashed border-gold/30 text-center font-black tracking-widest text-primary" 
                          />
                          {!couponData ? (
                            <Button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} variant="gold" className="h-12 px-8 rounded-2xl shadow-md">Apply</Button>
                          ) : (
                            <Button onClick={() => { setCouponData(null); setCouponCode(""); }} variant="ghost" className="h-12 px-6 text-red-500 border-2 border-red-100 rounded-2xl">Reset</Button>
                          )}
                        </div>
                      </div>

                      {/* EXCHANGE LOGIC */}
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
                               <Input placeholder="Jewelry Description" value={exchangeData.name} onChange={(e) => setExchangeData({ ...exchangeData, name: e.target.value })} className="h-11 rounded-xl text-xs font-bold" />
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

                      {/* SUMMARY TABLE */}
                      <div className="space-y-4 pt-6 border-t-2 border-gold/10">
                        <div className="flex justify-between text-[12px] font-black text-slate-500 uppercase tracking-tight"><span>Jewelry Base Value</span><span className="text-slate-900">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[12px] font-black text-slate-400 uppercase tracking-tight"><span>Tax (GST 3%)</span><span>₹{(cgst + sgst).toLocaleString()}</span></div>
                        
                        {isFullyCovered ? (
                           <div className="flex justify-between text-[11px] font-black text-emerald-600 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 uppercase italic shadow-inner">
                              <span className="flex items-center gap-2"><CheckCircle2 size={14} /> Full Gold Cover Benefit</span>
                              <span>-₹{(subtotal - managerWaiver).toLocaleString()}</span>
                           </div>
                        ) : (
                          <div className="space-y-3">
                            {couponAdjustments.goldCredit > 0 && <div className="flex justify-between text-[11px] font-black text-blue-600 uppercase bg-blue-50/50 px-4 py-2 rounded-xl"><span>Voucher: Gold Credit</span><span>-₹{couponAdjustments.goldCredit.toLocaleString()}</span></div>}
                            {couponAdjustments.vaCredit > 0 && <div className="flex justify-between text-[11px] font-black text-blue-600 italic uppercase bg-blue-50/50 px-4 py-2 rounded-xl"><span>Voucher: Wastage (VA) Off</span><span>-₹{couponAdjustments.vaCredit.toLocaleString()}</span></div>}
                          </div>
                        )}
                        {managerWaiver > 0 && <div className="flex justify-between text-[12px] font-black text-emerald-600 uppercase"><span>Manager Loyalty Waiver</span><span>-₹{managerWaiver.toLocaleString()}</span></div>}
                        {exchangeDiscountValue > 0 && <div className="flex justify-between text-[12px] font-black text-amber-600 uppercase"><span>Exchange Value Credit</span><span>-₹{exchangeDiscountValue.toLocaleString()}</span></div>}
                      </div>
                    </div>

                    <div className="pt-8 mt-4 border-t-4 border-gold/10 print:mt-12">
                      <div className="flex justify-between items-center mb-6 px-2">
                         <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Net Payable Amount</span>
                         <p className="text-4xl font-serif font-black text-slate-900 italic tracking-tighter drop-shadow-sm">₹{total.toLocaleString()}</p>
                      </div>
                      <Button 
                        disabled={cart.length === 0} 
                        onClick={() => setCheckoutStep(2)} 
                        variant="gold" 
                        className="w-full h-16 rounded-[1.5rem] shadow-xl text-lg font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
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
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 border-b pb-2">Client Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                           <Input placeholder="Client Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-14 rounded-2xl border-2" />
                           <Input placeholder="Phone Number" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "") })} className="h-14 rounded-2xl border-2" />
                        </div>
                        <Input placeholder="Email Address (Optional)" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="h-14 rounded-2xl border-2" />
                        <Input placeholder="Complete Address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="h-14 rounded-2xl border-2" />
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 border-b pb-2">Payment Settlement & Splitting</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.keys(paymentMethods).map((method) => (
                            <div 
                              key={method} 
                              className={cn(
                                "p-5 rounded-3xl border-4 transition-all duration-300",
                                paymentMethods[method as keyof typeof paymentMethods] ? "border-gold bg-white shadow-lg" : "opacity-40 bg-slate-100 border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-3 mb-4">
                                 <input 
                                    type="checkbox" 
                                    checked={paymentMethods[method as keyof typeof paymentMethods]} 
                                    onChange={(e) => handleMethodToggle(method, e.target.checked)} 
                                    className="accent-gold h-5 w-5 cursor-pointer" 
                                 />
                                 <span className="text-xs font-black uppercase tracking-tighter">{method}</span>
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

                    <div className="pt-8 mt-4 border-t-4 border-slate-100 bg-white -mx-8 px-8 py-6">
                      <div className="flex justify-between items-center mb-6">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Collected</span>
                            <span className="text-2xl font-black italic">₹{totalPaidSoFar.toLocaleString()}</span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance Dues</span>
                            <span className={cn(
                               "text-2xl font-black italic",
                               remainingToPay === 0 ? "text-emerald-600" : "text-red-500 animate-pulse"
                            )}>₹{remainingToPay.toLocaleString()}</span>
                         </div>
                      </div>
                      <Button 
                         onClick={handleCheckout} 
                         variant="gold" 
                         className="w-full h-16 rounded-3xl shadow-2xl text-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all" 
                         disabled={remainingToPay !== 0 || !customer.name || !customer.phone || isFinalizing}
                      >
                         {isFinalizing ? <Loader2 className="animate-spin w-8 h-8" /> : "FINALIZE PURCHASE"}
                      </Button>
                    </div>
                  </div>
                )}
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>
      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default BillingPOS;