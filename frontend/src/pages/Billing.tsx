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
  RefreshCcw, CheckCircle2, Percent, Edit3, Wallet, CreditCard, Banknote, Loader2, X, Printer
} from "lucide-react";

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ==========================================
  // 1. PERSISTENT STATES (Sync with SessionStorage)
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

  // Core Persistent States
  const [cart, setCart] = useState<any[]>(() => getSaved("pos_cart", []));
  const [customer, setCustomer] = useState(() => getSaved("pos_customer", { name: "", phone: "", email: "", address: "" }));
  const [couponData, setCouponData] = useState<any>(() => getSaved("pos_coupon", null));
  const [couponCode, setCouponCode] = useState(() => getSaved("pos_coupon_code", ""));
  const [managerDiscountPercent, setManagerDiscountPercent] = useState<number>(() => getSaved("pos_mgr_disc", 0));
  const [isOtpVerified, setIsOtpVerified] = useState(() => getSaved("pos_otp_verified", false));
  const [isExchangeApplied, setIsExchangeApplied] = useState(() => getSaved("pos_exchange_active", false));
  const [exchangeData, setExchangeData] = useState(() => getSaved("pos_exchange_data", { name: "", grams: 0, discount: 0 }));

  // Non-persistent UI states
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [paymentMethods, setPaymentMethods] = useState({ cash: false, upi: false, card: false, cheque: false });
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: 0, upi: 0, card: 0, cheque: 0 });
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Auto-Sync Effect
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
  // 2. HELPERS: SILVER MATH & DYNAMIC PRICING
  // ==========================================

  const checkIsSilver = useCallback((item: any) => {
    const metal = (item.metalType || "").toLowerCase();
    const carats = String(item.carats || "").toLowerCase();
    return metal === "silver" || carats.includes("silver") || carats.includes("925") || carats.includes("99");
  }, []);

  const getRateForItem = useCallback((item: any) => {
    if (!liveRates) return 0;
    if (checkIsSilver(item)) {
      // REQUIREMENT: silver rate = live rate * purity / 100
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
    if (!liveRates) return "Loading Rates...";
    const rate = getRateForItem(item);
    const gross = item.grams * rate;
    const vaAmt = gross * (parseFloat(item.va || 0) / 100);
    const isGold22 = String(item.carats).includes("22") && !checkIsSilver(item);
    return (
      <div className="space-y-1">
        <p>({item.grams}g × ₹${rate.toLocaleString()}) + (${item.va}% VA: ₹${Math.round(vaAmt).toLocaleString()})</p>
        {!isGold22 && !checkIsSilver(item) && <p className="text-red-500 text-[7px] font-bold uppercase">* VA Not Eligible for Wallet Discount (22K Gold Only)</p>}
      </div>
    );
  };

  // ==========================================
  // 3. CORE CALC: VA-OPTIMIZED (22K HIGH-TO-LOW)
  // ==========================================

  const couponAdjustments = useMemo(() => {
    if (!couponData || cart.length === 0 || !liveRates) return { goldCredit: 0, vaCredit: 0 };
    const gold22Rate = parseFloat(String(liveRates.gold22 || "0").replace(/[^\d.-]/g, ''));
    if (couponData.type === "CASH") return { goldCredit: couponData.value, vaCredit: 0 };

    let remainingGrams = couponData.value;
    let totalGoldSaved = 0;
    let totalVaSaved = 0;

    // Filter 22K Gold items, sorted by highest VA first
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

    // Remainder applied to non-22K Gold (Gold credit only, no VA credit)
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
  const totalPaidSoFar = Object.values(paymentAmounts).reduce((a, b) => a + b, 0);
  const remainingToPay = Math.round(total - totalPaidSoFar);

  // ==========================================
  // 4. HANDLERS (HARDWARE/API)
  // ==========================================

   const processScannedBarcode = (scannedValue: string) => {
    if (isProcessingScan || !scannedValue) return;
    setIsProcessingScan(true);
    const skuCode = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;
    const product = inventory.find(p => p.sku === skuCode || p.barcode === skuCode);
    if (product) {
      if (product.isSold) setToastMessage("Item already SOLD.");
      else if (cart.some(item => item.sku === product.sku)) setToastMessage("Security Alert: Item in vault.");
      else {
        setCart(prev => [...prev, { ...product, quantity: 1 }]);
        setToastMessage(`${product.name} Added`);
      }
    } else { setToastMessage("Product not found."); }
    setShowToast(true); setIsProcessingScan(false);
  };

  useEffect(() => {
    let barcodeBuffer = ""; let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === "INPUT" && activeElement.id !== "search-input") return;
      if (Date.now() - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault(); processScannedBarcode(barcodeBuffer); barcodeBuffer = "";
      } else if (e.key.length === 1) barcodeBuffer += e.key;
      lastKeyTime = Date.now();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, inventory, isProcessingScan]);


  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const has22K = cart.some(item => String(item.carats).includes("22") && !checkIsSilver(item));
    if (!has22K) {
      setToastMessage("Coupon rejected: Cart must contain 22K Gold ornaments.");
      setShowToast(true); return;
    }
    setIsApplyingCoupon(true);
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setCouponData(data);
      else { setToastMessage(data.error || "Invalid Coupon"); setShowToast(true); }
    } finally { setIsApplyingCoupon(false); }
  };

  const handleCheckout = async () => {
    if (remainingToPay !== 0 || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const response = await fetch("http://localhost:3000/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
 purchaseData: {
            customerName: customer.name, phoneNumber: customer.phone, emailid: customer.email, Address: customer.address,
            totalAmount: subtotal, cgstAmount: cgst, sgstAmount: sgst,
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
        
        sessionStorage.clear();
        setCart([]);
        setCouponData(null);
        setToastMessage("Generating Bill...");
        setTimeout(() => window.print(), 1000);
      }
    } catch (e) { setToastMessage("Checkout Failed"); setShowToast(true); }
    finally { setIsFinalizing(false); }
  };

  const handleRequestOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/generate", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if ((await res.json()).success) { setIsOtpSent(true); setToastMessage("OTP Sent"); setShowToast(true); }
    } finally { setOtpLoading(false); }
  };

  const handleVerifyOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      if ((await res.json()).success) { setIsOtpVerified(true); setToastMessage("Verified"); setShowToast(true); }
    } finally { setOtpLoading(false); }
  };

  // Hardware Scanner Restoration
  useEffect(() => {
    let barcodeBuffer = ""; let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl.tagName === "INPUT" && activeEl.id !== "search-input") return;
      if (Date.now() - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault();
        const sku = barcodeBuffer.includes('/') ? barcodeBuffer.split('/').pop() : barcodeBuffer;
        const p = inventory.find(i => i.sku === sku || i.barcode === sku);
        if (p && !p.isSold) {
          setCart(prev => [...prev, { ...p, quantity: 1 }]);
          setToastMessage(`${p.name} added via scan`);
          setShowToast(true);
        }
        barcodeBuffer = "";
      } else if (e.key.length === 1) barcodeBuffer += e.key;
      lastKeyTime = Date.now();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inventory]);

  useEffect(() => {
    const init = async () => {
      try {
        const [r, p] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setLiveRates(await r.json());
        setInventory((await p.json()).products || []);
      } catch (e) { console.error("API Init Error", e); }
    }; init();
  }, [token]);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return inventory.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).slice(0, 5);
  }, [search, inventory]);

  const updateManualPrice = (id: string, newPrice: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, manualPrice: newPrice === "" ? undefined : Number(newPrice) } : item));
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden print:bg-white">
        <div className="print:hidden"><DashboardSidebar /></div>
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden print:h-auto print:overflow-visible">
          
          <header className="px-10 py-3 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50 print:hidden">
            <div className="flex items-center gap-8 flex-1">
              <h1 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2 border-r border-gold/20 pr-8">
                <Landmark className="text-gold" size={18} /> Terminal
              </h1>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                <Input
                  id="search-input" placeholder="Quick Search..." value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-gold/10"
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gold/10 shadow-2xl rounded-xl z-[100]">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 border-b hover:bg-gold/5">
                        <div className="flex flex-col"><span className={`text-xs font-bold uppercase ${p.isSold ? 'line-through text-gray-400' : ''}`}>{p.name}</span><span className="text-[9px] text-gold font-bold">{p.sku} | VA: {p.va}%</span></div>
                        <Button disabled={p.isSold} onClick={() => { setCart([...cart, { ...p, quantity: 1 }]); setSearch(""); setShowDropdown(false); }} variant="gold" size="icon" className="h-7 w-7"><Plus size={14} /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-widest"><ScanLine size={14} className="animate-pulse" /> Scanner Active</div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6 print:block print:px-0">
            <div className="w-[60%] flex flex-col overflow-hidden print:w-full">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[2rem] bg-white print:border-none print:shadow-none">
                <div className="px-8 py-5 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9] print:bg-white">
                  <h2 className="text-lg font-serif font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="text-gold" size={20} /> Checkout Vault</h2>
                  <Badge className="bg-slate-900 text-gold rounded-md px-3 py-1 text-[10px] font-bold print:hidden">{cart.length} ITEMS</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar print:overflow-visible">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-5 rounded-[2rem] border border-gold/5 bg-white hover:shadow-md transition-all print:border-b print:rounded-none">
                      <div className="flex items-center gap-6">
                        <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-gold font-serif border border-gold/10 print:hidden">{item.name.charAt(0)}</div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800 uppercase">{item.name}</p>
                          <div className="text-[9px] font-bold text-slate-400 space-y-1 uppercase">
                            <p>{item.carats} | {item.grams}g | VA: {item.va}%</p>
                            <div className="text-gold italic font-serif leading-none">{getItemCalculationDetail(item)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right font-bold text-xs text-slate-900">₹{getDynamicPrice(item).toLocaleString()}</div>
                        <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="text-slate-300 hover:text-red-500 print:hidden"><Trash2 size={18} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </div>

            <div className="w-[40%] flex flex-col overflow-hidden h-full print:w-full print:mt-10">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-t-8 border-t-gold rounded-[2rem] overflow-hidden print:border-none print:shadow-none">
                {checkoutStep === 1 ? (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-6"><ReceiptText className="text-gold" size={20} /> <h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1 print:overflow-visible">
                      <div className="space-y-3 print:hidden">
                        <div className="flex gap-2">
                          <Input placeholder="ADMIN OTP" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={isOtpVerified} className="h-12 text-center font-bold tracking-[0.4em]" />
                          <Button onClick={!isOtpSent ? handleRequestOTP : handleVerifyOTP} disabled={otpLoading || isOtpVerified} variant="gold" className="h-12 w-24">
                            {otpLoading ? <Loader2 className="animate-spin" /> : (isOtpVerified ? <CheckCircle2 /> : (isOtpSent ? "Verify" : "OTP"))}
                          </Button>
                          {isOtpSent && !isOtpVerified && <Button onClick={handleRequestOTP} variant="ghost" className="h-12 text-gold"><RefreshCcw size={16} /></Button>}
                        </div>
                        {isOtpVerified && <Input type="number" placeholder="Discount %" value={managerDiscountPercent} onChange={(e) => setManagerDiscountPercent(Number(e.target.value))} className="h-10 text-center font-bold text-lg animate-in fade-in" />}
                      </div>

                      <div className="space-y-2 print:hidden">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gold Reward Coupon</label>
                        <div className="flex gap-2">
                          <Input placeholder="COUPON CODE" value={couponCode} disabled={!!couponData} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="h-11 rounded-xl border-2 border-dashed border-gold/20 text-center font-bold" />
                          {!couponData ? (
                            <Button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} variant="gold" className="h-11 px-6">{isApplyingCoupon ? <Loader2 className="animate-spin" /> : "Apply"}</Button>
                          ) : (
                            <Button onClick={() => { setCouponData(null); setCouponCode(""); }} variant="ghost" className="h-11 text-red-500 border border-red-200">Remove</Button>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50/50 rounded-2xl border border-gold/20 print:bg-white">
                        <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold uppercase text-slate-600">Old Gold Exchange</span><input type="checkbox" checked={isExchangeApplied} onChange={(e) => setIsExchangeApplied(e.target.checked)} className="accent-gold h-4 w-4 cursor-pointer print:hidden" /></div>
                        {isExchangeApplied && (
                          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                            <Input placeholder="Item Name" value={exchangeData.name} onChange={(e) => setExchangeData({ ...exchangeData, name: e.target.value })} className="h-10 text-xs" />
                            <Input type="number" placeholder="Grams" value={exchangeData.grams || ""} onChange={(e) => setExchangeData({ ...exchangeData, grams: Number(e.target.value) })} className="h-10 text-xs" />
                            <Input type="number" placeholder="Value (₹)" className="col-span-2 h-10 font-bold" value={exchangeData.discount || ""} onChange={(e) => setExchangeData({ ...exchangeData, discount: Number(e.target.value) })} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gold/10">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Gross Jewelry Value</span><span className="text-slate-900">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>GST (3%)</span><span>₹{(cgst + sgst).toLocaleString()}</span></div>
                        {isFullyCovered ? (
                           <div className="flex justify-between text-[11px] font-bold text-emerald-600 border-y border-emerald-100 py-2 uppercase italic"><span>Full Gold Benefit Applied</span><span>-₹{(subtotal - managerWaiver).toLocaleString()}</span></div>
                        ) : (
                          <>
                            {couponAdjustments.goldCredit > 0 && <div className="flex justify-between text-[11px] font-bold text-blue-600 uppercase"><span>Wallet Credit (22K)</span><span>-₹{couponAdjustments.goldCredit.toLocaleString()}</span></div>}
                            {couponAdjustments.vaCredit > 0 && <div className="flex justify-between text-[11px] font-bold text-blue-600 italic uppercase"><span>Wallet VA Discount (22K)</span><span>-₹{couponAdjustments.vaCredit.toLocaleString()}</span></div>}
                          </>
                        )}
                        {managerWaiver > 0 && <div className="flex justify-between text-[11px] font-bold text-emerald-600"><span>Manager Waiver</span><span>-₹{managerWaiver.toLocaleString()}</span></div>}
                        {exchangeDiscountValue > 0 && <div className="flex justify-between text-[11px] font-bold text-amber-600"><span>Exchange Value</span><span>-₹{exchangeDiscountValue.toLocaleString()}</span></div>}
                        {couponData && <div className="flex justify-between text-[11px] font-black text-slate-900 uppercase bg-gold/5 p-3 rounded-xl border border-gold/10 mt-2"><span>Overall Saving Applied</span><span>-₹{overallDiscount.toLocaleString()}</span></div>}
                      </div>
                    </div>
                    <div className="pt-6 mt-2 border-t border-gold/10 print:mt-10">
                      <div className="flex justify-between items-end mb-4"><span className="text-[10px] font-bold text-slate-400 uppercase">Final Payable {isFullyCovered && "(Taxes + Silver)"}</span><p className="text-3xl font-serif font-bold text-slate-900">₹{total.toLocaleString()}</p></div>
                      <Button disabled={cart.length === 0} onClick={() => setCheckoutStep(2)} variant="gold" className="w-full h-14 rounded-xl shadow-lg print:hidden">Record Details & Payment <ChevronRight size={18} className="ml-2" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase mb-4 hover:underline"><ArrowLeft size={16} /> Back to Summary</button>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
                      <div className="grid grid-cols-2 gap-3"><Input placeholder="Full Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-11 rounded-xl" /><Input placeholder="Phone Number" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "") })} className="h-11 rounded-xl" /></div>
                      <Input placeholder="Email Address" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="h-11 rounded-xl" />
                      <GoldDivider opacity={10} />
                      <div className="grid grid-cols-2 gap-3">
                        {Object.keys(paymentMethods).map((method) => (
                          <div key={method} className={`p-3 rounded-xl border-2 transition-all ${paymentMethods[method as keyof typeof paymentMethods] ? 'border-gold bg-white' : 'opacity-60 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2"><input type="checkbox" checked={paymentMethods[method as keyof typeof paymentMethods]} onChange={(e) => setPaymentMethods({ ...paymentMethods, [method]: e.target.checked })} className="accent-gold h-4 w-4" /><span className="text-[10px] font-bold uppercase">{method}</span></div>
                            {paymentMethods[method as keyof typeof paymentMethods] && <Input type="number" className="h-8 text-right text-xs" value={paymentAmounts[method as keyof typeof paymentAmounts]} onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [method]: Number(e.target.value) })} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 mt-2 border-t bg-slate-50 -mx-6 px-6 py-4">
                      <div className="flex justify-between items-center mb-2 px-1"><div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Paid Total</span><span className="text-sm font-bold">₹{totalPaidSoFar.toLocaleString()}</span></div><div className="flex flex-col items-end"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Remaining</span><span className={`text-sm font-bold ${remainingToPay === 0 ? 'text-emerald-600' : 'text-red-500'}`}>₹{remainingToPay.toLocaleString()}</span></div></div>
                      <Button 
                         onClick={handleCheckout} 
                         variant="gold" 
                         className="w-full h-14 rounded-xl shadow-lg" 
                         disabled={remainingToPay !== 0 || !customer.name || !customer.phone || isFinalizing}
                      >
                         {isFinalizing ? <Loader2 className="animate-spin" /> : "Finalize & Record Purchase"}
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