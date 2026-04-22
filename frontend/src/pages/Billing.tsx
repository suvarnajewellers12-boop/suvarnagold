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
  RefreshCcw, CheckCircle2, Percent, Edit3, Wallet, CreditCard, Banknote, Loader2, X
} from "lucide-react";

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // INVENTORY & RATE DATA (CACHED)
  const [inventory, setInventory] = useState<any[]>([]);
  const [liveRates, setLiveRates] = useState<any>(null);

  // SEARCH & UI STATES
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  // CART STATE
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("suvarna_pos_cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });

  // OTP & DISCOUNT STATES
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [managerDiscountPercent, setManagerDiscountPercent] = useState<number>(0);

  // EXCHANGE JEWELLERY STATES
  const [isExchangeApplied, setIsExchangeApplied] = useState(false);
  const [exchangeData, setExchangeData] = useState({ name: "", grams: 0, discount: 0 });

  // MULTI-MODAL PAYMENT STATES
  const [paymentMethods, setPaymentMethods] = useState({ cash: false, upi: false, card: false, cheque: false });
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: 0, upi: 0, card: 0, cheque: 0 });

  // CUSTOMER & COUPON STATES
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState<{ type: "CASH" | "WEIGHT"; value: number } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ==========================================
  // HELPERS: PRICING & FORMULAS
  // ==========================================

  const checkIsSilver = useCallback((item: any) => {
    const metal = (item.metal || "").toLowerCase();
    const carats = String(item.carats || "").toLowerCase();
    return metal === "silver" || carats.includes("99") || carats.includes("silver");
  }, []);

  const getRateForItem = useCallback((item: any) => {
    if (!liveRates) return 0;
    if (checkIsSilver(item)) {
      const baseMarketRate = parseFloat(String(liveRates.silver).replace(/[^\d.-]/g, ''));
      const purity = parseFloat(item.purity || item.carats || 0);
      return (baseMarketRate / 99.9) * purity;
    } else {
      const carat = String(item.carats || "").replace(/\D/g, "");
      const rateKey = carat === "18" ? "gold18" : carat === "22" ? "gold22" : "gold24";
      return parseFloat(String(liveRates[rateKey] || "0").replace(/[^\d.-]/g, ''));
    }
  }, [liveRates, checkIsSilver]);

  const getItemVAAmt = useCallback((item: any) => {
    const rate = getRateForItem(item);
    return Math.round((item.grams * rate) * (parseFloat(item.va || 0) / 100));
  }, [getRateForItem]);

  const getItemCalculationDetail = (item: any) => {
    if (!liveRates) return "Loading rates...";
    const rate = getRateForItem(item);
    const vaAmt = getItemVAAmt(item);
    return `(${item.grams}g × ₹${rate.toLocaleString()}) + (${item.va}% VA: ₹${vaAmt.toLocaleString()})`;
  };

  const getDynamicPrice = useCallback((item: any) => {
    if (item.manualPrice !== undefined && item.manualPrice !== null) return Number(item.manualPrice);
    if (!liveRates || !item.grams) return 0;
    const rate = getRateForItem(item);
    const base = rate * item.grams;
    return Math.round(base + (base * (parseFloat(item.va || 0) / 100)));
  }, [liveRates, getRateForItem]);

  // ==========================================
  // CORE CALCULATIONS (MEMOIZED)
  // ==========================================

  const couponAdjustments = useMemo(() => {
  if (!couponData || cart.length === 0 || !liveRates) return { goldCredit: 0, vaCredit: 0 };
  
  // Get the specific 22K rate for the coupon discount calculation
  const gold22Rate = parseFloat(String(liveRates.gold22 || "0").replace(/[^\d.-]/g, ''));

  if (couponData.type === "CASH") {
    return { goldCredit: couponData.value, vaCredit: 0 };
  }

  let remainingGrams = couponData.value;
  let totalGoldSaved = 0;
  let totalVaSaved = 0;

  // Filter only Gold items (Silver is excluded from coupon benefits)
  const goldItems = cart.filter(item => !checkIsSilver(item));
  
  // Sort items by VA% Descending (High to Low) to maximize savings
  const sortedGoldItems = [...goldItems].sort((a, b) => parseFloat(b.va) - parseFloat(a.va));

  sortedGoldItems.forEach((item) => {
    if (remainingGrams <= 0) return;

    const weightToCover = Math.min(item.grams, remainingGrams);
    
    /** * TARGET REQUIREMENT: Coupon discount amount comes from 22K rate 
     * We use gold22Rate instead of the item's dynamic rate for the savings value
     */
    const goldVal = weightToCover * gold22Rate;
    
    totalGoldSaved += goldVal;
    
    // VA reduction is calculated based on the 22K rate value applied to this item
    totalVaSaved += goldVal * (parseFloat(item.va || 0) / 100);
    
    remainingGrams -= weightToCover;
  });

  return { goldCredit: totalGoldSaved, vaCredit: totalVaSaved };
}, [couponData, cart, liveRates, checkIsSilver]);
  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku?.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5);
  }, [search, inventory]);

  const subtotal = cart.reduce((acc, item) => acc + (getDynamicPrice(item) * item.quantity), 0);
  const cgst = subtotal * 0.015;
  const sgst = subtotal * 0.015;
  const managerWaiver = isOtpVerified ? (subtotal * (managerDiscountPercent / 100)) : 0;
  const exchangeDiscountValue = isExchangeApplied ? exchangeData.discount : 0;
  
  const goldCartWeight = cart.filter(i => !checkIsSilver(i)).reduce((acc, i) => acc + Number(i.grams || 0), 0);
  const isFullyCovered = couponData?.type === "WEIGHT" && couponData.value >= goldCartWeight && goldCartWeight > 0;

  const overallDiscount = isFullyCovered 
    ? cart.filter(i => !checkIsSilver(i)).reduce((acc, i) => acc + getDynamicPrice(i), 0)
    : (managerWaiver + exchangeDiscountValue + couponAdjustments.goldCredit + couponAdjustments.vaCredit);

  const total = Math.max(0, Math.round((subtotal + cgst + sgst) - overallDiscount));
  const totalPaidSoFar = Object.values(paymentAmounts).reduce((a, b) => a + b, 0);
  const remainingToPay = Math.round(total - totalPaidSoFar);

  // ==========================================
  // HARDWARE SCANNER & EVENT LISTENERS
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

  // ==========================================
  // API ACTIONS
  // ==========================================

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const hasGold = cart.some(item => !checkIsSilver(item));
    if (!hasGold) {
      setToastMessage("Coupon will be applied on only gold products.");
      setShowToast(true); return;
    }
    setIsApplyingCoupon(true);
    try {
      const res = await fetch(`http://localhost:3000/api/payment/coupon/${couponCode.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) { setCouponData(data); setToastMessage("Coupon Applied Successfully"); }
      else { setToastMessage(data.error || "Invalid Coupon"); }
    } catch (e) { setToastMessage("Connection error"); }
    finally { setIsApplyingCoupon(false); setShowToast(true); }
  };

  const handleRequestOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/generate", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if ((await res.json()).success) { setIsOtpSent(true); setToastMessage("OTP Sent"); }
    } finally { setOtpLoading(false); setShowToast(true); }
  };

  const handleVerifyOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      if ((await res.json()).success) { setIsOtpVerified(true); setToastMessage("Verified"); }
    } finally { setOtpLoading(false); setShowToast(true); }
  };

  const handleCheckout = async () => {
    if (remainingToPay !== 0) return;
    try {
      const response = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paymentBreakdown: paymentAmounts,
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
        }),
      });
      if ((await response.json()).success) {
        if (couponData) await fetch(`http://localhost:3000/api/payment/coupon/${couponCode}/used`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        setToastMessage("Sale Recorded Successfully"); setShowToast(true); setCart([]); setCouponData(null); setCheckoutStep(1);
      }
    } catch (e) { setToastMessage("Error finishing checkout"); setShowToast(true); }
  };

  useEffect(() => {
    const init = async () => {
      const [r, p] = await Promise.all([
        fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
        fetch("https://suvarnagold-16e5.vercel.app/api/products/all", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setLiveRates(await r.json()); setInventory((await p.json()).products || []);
    }; init();
  }, [token]);

  const removeItem = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  const updateManualPrice = (id: string, newPrice: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, manualPrice: newPrice === "" ? undefined : Number(newPrice) } : item));
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          <header className="px-10 py-3 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50">
            <div className="flex items-center gap-8 flex-1">
              <h1 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2 border-r border-gold/20 pr-8">
                <Landmark className="text-gold" size={18} /> Billing Terminal
              </h1>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                <Input
                  id="search-input" placeholder="Search SKU or Name..." value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-gold/10"
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gold/10 shadow-2xl rounded-xl z-[100]">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 border-b hover:bg-gold/5">
                        <div className="flex flex-col"><span className="text-xs font-bold uppercase">{p.name}</span><span className="text-[9px] text-gold font-bold">{p.sku}</span></div>
                        <Button disabled={p.isSold} onClick={() => { setCart([...cart, { ...p, quantity: 1 }]); setSearch(""); setShowDropdown(false); }} variant="gold" size="icon" className="h-7 w-7"><Plus size={14} /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6"><div className="flex items-center gap-2 px-6 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase"><ScanLine size={14} className="animate-pulse" /> Scanner Ready</div></div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6">
            <div className="w-[60%] flex flex-col overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[2rem] bg-white">
                <div className="px-8 py-5 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9]">
                  <h2 className="text-lg font-serif font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="text-gold" size={20} /> Transaction Vault</h2>
                  <Badge className="bg-slate-900 text-gold rounded-md px-3 py-1 text-[10px] font-bold">{cart.length} ITEMS</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-5 rounded-[2rem] border border-gold/5 bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-6">
                        <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-gold font-serif border border-gold/10">{item.name.charAt(0)}</div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800 uppercase">{item.name}</p>
                          <div className="text-[9px] font-bold text-slate-400 space-y-1 uppercase">
                            <p>{item.grams}g | {item.carats} | VA: {item.va}%</p>
                            <p className="text-gold italic font-serif">Formula: {getItemCalculationDetail(item)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Input type="number" className="h-9 w-28 text-right font-bold text-xs" value={item.manualPrice ?? getDynamicPrice(item)} onChange={(e) => updateManualPrice(item.id, e.target.value)} />
                        <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </div>

            <div className="w-[40%] flex flex-col overflow-hidden h-full">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-t-8 border-t-gold rounded-[2rem] overflow-hidden">
                {checkoutStep === 1 ? (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-6"><ReceiptText className="text-gold" size={20} /> <h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input placeholder="ADMIN OTP" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={isOtpVerified} className="h-12 text-center font-bold tracking-[0.4em]" />
                          <Button onClick={!isOtpSent ? handleRequestOTP : handleVerifyOTP} disabled={otpLoading || isOtpVerified} variant="gold" className="h-12 w-24">
                            {otpLoading ? <Loader2 className="animate-spin" /> : (isOtpVerified ? <CheckCircle2 /> : (isOtpSent ? "Verify" : "OTP"))}
                          </Button>
                          {isOtpSent && !isOtpVerified && <Button onClick={handleRequestOTP} variant="ghost" className="h-12 text-gold"><RefreshCcw size={16} /></Button>}
                        </div>
                        {isOtpVerified && <Input type="number" placeholder="Discount %" value={managerDiscountPercent} onChange={(e) => setManagerDiscountPercent(Number(e.target.value))} className="h-10 text-center font-bold text-lg" />}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Scheme Reward Coupon</label>
                        <div className="flex gap-2">
                          <Input placeholder="COUPON CODE" value={couponCode} disabled={!!couponData} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="h-11 rounded-xl border-2 border-dashed border-gold/20 text-center font-bold" />
                          {!couponData ? (
                            <Button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} variant="gold" className="h-11 px-6">{isApplyingCoupon ? <Loader2 className="animate-spin" /> : "Apply"}</Button>
                          ) : (
                            <Button onClick={() => { setCouponData(null); setCouponCode(""); }} variant="ghost" className="h-11 text-red-500 border border-red-200">Remove</Button>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50/50 rounded-2xl border border-gold/20">
                        <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold uppercase text-slate-600">Old Jewellery Exchange</span><input type="checkbox" checked={isExchangeApplied} onChange={(e) => setIsExchangeApplied(e.target.checked)} className="accent-gold h-4 w-4 cursor-pointer" /></div>
                        {isExchangeApplied && (
                          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                            <Input placeholder="Item Name" value={exchangeData.name} onChange={(e) => setExchangeData({ ...exchangeData, name: e.target.value })} className="h-10 text-xs" />
                            <Input type="number" placeholder="Grams" value={exchangeData.grams || ""} onChange={(e) => setExchangeData({ ...exchangeData, grams: Number(e.target.value) })} className="h-10 text-xs" />
                            <Input type="number" placeholder="Value (₹)" className="col-span-2 h-10 font-bold" value={exchangeData.discount || ""} onChange={(e) => setExchangeData({ ...exchangeData, discount: Number(e.target.value) })} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gold/10">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Gross Value</span><span className="text-slate-900">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>GST (3%)</span><span>₹{(cgst + sgst).toLocaleString()}</span></div>
                        {isFullyCovered ? (
                           <div className="flex justify-between text-[11px] font-bold text-emerald-600"><span>Full Weight Credit Benefit</span><span>-₹{(subtotal - managerWaiver).toLocaleString()}</span></div>
                        ) : (
                          <>
                            {couponAdjustments.goldCredit > 0 && <div className="flex justify-between text-[11px] font-bold text-blue-600"><span>Scheme Gold Credit</span><span>-₹{couponAdjustments.goldCredit.toLocaleString()}</span></div>}
                            {couponAdjustments.vaCredit > 0 && <div className="flex justify-between text-[11px] font-bold text-blue-600 italic"><span>Scheme VA Reduction</span><span>-₹{couponAdjustments.vaCredit.toLocaleString()}</span></div>}
                          </>
                        )}
                        {managerWaiver > 0 && <div className="flex justify-between text-[11px] font-bold text-emerald-600"><span>Manager Waiver</span><span>-₹{managerWaiver.toLocaleString()}</span></div>}
                        {exchangeDiscountValue > 0 && <div className="flex justify-between text-[11px] font-bold text-amber-600"><span>Exchange Value</span><span>-₹{exchangeDiscountValue.toLocaleString()}</span></div>}
                        {couponData && <div className="flex justify-between text-[11px] font-black text-slate-900 uppercase bg-gold/5 p-3 rounded-xl border border-gold/10"><span>Overall Discount Applied</span><span>-₹{overallDiscount.toLocaleString()}</span></div>}
                      </div>
                    </div>
                    <div className="pt-6 mt-2 border-t border-gold/10">
                      <div className="flex justify-between items-end mb-4"><span className="text-[10px] font-bold text-slate-400 uppercase">Final Payable {isFullyCovered && "(GST only)"}</span><p className="text-3xl font-serif font-bold text-slate-900">₹{total.toLocaleString()}</p></div>
                      <Button disabled={cart.length === 0} onClick={() => setCheckoutStep(2)} variant="gold" className="w-full h-14">Details & Payment <ChevronRight size={18} className="ml-2" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase mb-4 hover:underline"><ArrowLeft size={16} /> Summary</button>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
                      <div className="grid grid-cols-2 gap-3"><Input placeholder="Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-11 rounded-xl" /><Input placeholder="Phone" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="h-11 rounded-xl" /></div>
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
                      <div className="flex justify-between items-center mb-2 px-1"><div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Paid Total</span><span className="text-sm font-bold">₹{totalPaidSoFar.toLocaleString()}</span></div><div className="flex flex-col items-end"><span className="text-[9px] font-bold text-slate-400 uppercase">Remaining</span><span className={`text-sm font-bold ${remainingToPay === 0 ? 'text-emerald-600' : 'text-red-500'}`}>₹{remainingToPay.toLocaleString()}</span></div></div>
                      <Button onClick={handleCheckout} variant="gold" className="w-full h-14 rounded-xl shadow-lg" disabled={remainingToPay !== 0 || !customer.name || !customer.phone}>Finalize & Record Purchase</Button>
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