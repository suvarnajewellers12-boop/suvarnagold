import React, { useEffect, useState } from "react";
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
  RefreshCcw, CheckCircle2, Percent, Edit3, Wallet, CreditCard, Banknote
} from "lucide-react";

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // INVENTORY & CART STATES
  const [inventory, setInventory] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("suvarna_pos_cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });

  // UI & SCAN STATES
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);

  // OTP & DISCOUNT STATES
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [isDiscountUnlocked, setIsDiscountUnlocked] = useState(false);
  const [otp, setOtp] = useState("");
  const [managerDiscountPercent, setManagerDiscountPercent] = useState<number>(0);

  // EXCHANGE JEWELLERY STATES
  const [isExchangeApplied, setIsExchangeApplied] = useState(false);
  const [exchangeData, setExchangeData] = useState({ name: "", grams: 0, discount: 0 });

  // NEW: MULTI-MODAL PAYMENT STATES
  const [paymentMethods, setPaymentMethods] = useState({
    cash: false,
    upi: false,
    card: false,
    cheque: false
  });
  const [paymentAmounts, setPaymentAmounts] = useState({
    cash: 0,
    upi: 0,
    card: 0,
    cheque: 0
  });

  // LIVE DATA & CUSTOMER
  const [liveRates, setLiveRates] = useState<any>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // CALCULATIONS
  const subtotal = cart.reduce((acc, item) => acc + (getDynamicPrice(item) * item.quantity), 0);
  const cgst = subtotal * 0.015;
  const sgst = subtotal * 0.015;
  const managerWaiver = isDiscountUnlocked ? (subtotal * (managerDiscountPercent / 100)) : 0;
  const exchangeDiscountValue = isExchangeApplied ? exchangeData.discount : 0;
  const total = Math.max(0, subtotal + cgst + sgst - managerWaiver - couponDiscount - exchangeDiscountValue);

  const totalPaidSoFar = Object.values(paymentAmounts).reduce((a, b) => a + b, 0);
  const remainingToPay = Math.round(total - totalPaidSoFar);

  useEffect(() => {
    localStorage.setItem("suvarna_pos_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const initializeTerminal = async () => {
      try {
        const [ratesRes, productsRes] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        const ratesData = await ratesRes.json();
        const productsData = await productsRes.json();
        setLiveRates(ratesData);
        setInventory(productsData.products || []);
      } catch (error) {
        console.error("Initialization failed", error);
      }
    };
    initializeTerminal();
  }, [token]);

  function getDynamicPrice(item: any) {
    if (item.manualPrice !== undefined && item.manualPrice !== null) return Number(item.manualPrice);
    if (!liveRates || !item.grams) return 0;
    const metal = (item.metal || "gold").toLowerCase();
    const carat = String(item.carats || "").replace(/\D/g, "");
    if (metal === "silver") return 0;
    let rateKey = carat === "18" ? "gold18" : carat === "22" ? "gold22" : carat === "24" ? "gold24" : "";
    const rateString = liveRates[rateKey];
    if (!rateKey || !rateString) return 0;
    const rateValue = parseFloat(String(rateString).replace(/[^\d.-]/g, ''));
    const baseMetalPrice = rateValue * item.grams;
    const vaPercent = parseFloat(item.va || 0);
    const makingCharges = baseMetalPrice * (vaPercent / 100);
    return Math.round(baseMetalPrice + makingCharges);
  }

  const updateManualPrice = (id: string, newPrice: string) => {
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, manualPrice: newPrice === "" ? undefined : Number(newPrice) } : item
    ));
  };

  // HARDWARE SCANNER LOGIC
  const processScannedBarcode = (scannedValue: string) => {
    if (isProcessingScan || !scannedValue) return;
    setIsProcessingScan(true);
    const skuCode = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;
    const product = inventory.find(p => p.sku === skuCode || p.barcode === skuCode);
    if (product) {
      if (product.isSold) setToastMessage("Access Denied: Item already SOLD.");
      else if (cart.some(item => item.sku === product.sku)) setToastMessage("Security Alert: Item in vault.");
      else {
        setCart(prev => [...prev, { ...product, quantity: 1 }]);
        setToastMessage(`${product.name} Added`);
      }
    } else {
      setToastMessage("Product not found in local cache.");
    }
    setShowToast(true);
    setIsProcessingScan(false);
  };

  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === "INPUT" && activeElement.id !== "search-input") return;
      if (currentTime - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault();
        processScannedBarcode(barcodeBuffer);
        barcodeBuffer = "";
      } else if (e.key.length === 1) barcodeBuffer += e.key;
      lastKeyTime = currentTime;
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, inventory, isProcessingScan]);

  const handleCheckout = async () => {
    if (remainingToPay !== 0) {
      setToastMessage(`Balance Error: ₹${remainingToPay} remaining`);
      setShowToast(true);
      return;
    }

    try {
      const response = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paymentBreakdown: paymentAmounts,
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
            discountAmount: managerWaiver,
            finalAmount: total,
            items: cart.map(item => ({
              productId: item.id,
              name: item.name,
              sku: item.sku,
              grams: item.grams,
              cost: getDynamicPrice(item),
            })),
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setToastMessage("Transaction Successful");
        setShowToast(true);
        // Reset Everything
        setCart([]);
        localStorage.removeItem("suvarna_pos_cart");
        setCustomer({ name: "", phone: "", email: "", address: "" });
        setPaymentAmounts({ cash: 0, upi: 0, card: 0, cheque: 0 });
        setPaymentMethods({ cash: false, upi: false, card: false, cheque: false });
        setCheckoutStep(1);
      }
    } catch (error) {
      setToastMessage("Server connection failed");
      setShowToast(true);
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
      if (data.success) setIsOtpSent(true);
    } catch (e) { setToastMessage("Connection error"); }
    finally { setOtpLoading(false); setShowToast(true); }
  };

  const handleVerifyOTP = async () => {
    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) setIsDiscountUnlocked(true);
    } catch (e) { setToastMessage("Verification failed"); }
    finally { setOtpLoading(false); setShowToast(true); }
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

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
                  id="search-input"
                  placeholder="Search SKU or Name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    const filtered = inventory.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase()) || p.sku?.toLowerCase().includes(e.target.value.toLowerCase()));
                    setFilteredProducts(filtered.slice(0, 5));
                    setShowDropdown(!!e.target.value);
                  }}
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-gold/10"
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gold/10 shadow-2xl rounded-xl z-[100]">
                    {filteredProducts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 border-b hover:bg-gold/5">
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold uppercase ${p.isSold ? 'text-gray-400 line-through' : ''}`}>{p.name}</span>
                          <span className="text-[9px] text-gold font-bold uppercase">{p.sku} | VA: {p.va}%</span>
                        </div>
                        <Button disabled={p.isSold} onClick={() => { setCart(prev => [...prev, { ...p, quantity: 1 }]); setSearch(""); setShowDropdown(false); }} variant="gold" size="icon" className="h-7 w-7"><Plus size={14} /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-6 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                <ScanLine size={14} className="animate-pulse" /> Scanner Ready
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6">
            {/* LEFT: CART */}
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
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{item.grams}g | {item.carats} | VA: {item.va}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">₹</span>
                          <Input
                            type="number"
                            className="h-9 w-28 pl-5 text-right font-bold text-xs"
                            value={item.manualPrice ?? getDynamicPrice(item)}
                            onChange={(e) => updateManualPrice(item.id, e.target.value)}
                          />
                        </div>
                        <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT: CHECKOUT */}
            {/* RIGHT: CHECKOUT & FINANCIALS */}
            <div className="w-[40%] flex flex-col overflow-hidden h-full">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-t-8 border-t-gold rounded-[2rem] overflow-hidden">
                {checkoutStep === 1 ? (
                  /* STEP 1: FINANCIAL SUMMARY & DISCOUNTS */
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-6">
                      <ReceiptText className="text-gold" size={20} />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                      {/* OTP & Manager Discount Approval */}
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input placeholder="ADMIN OTP" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={!isOtpSent || isDiscountUnlocked} className="h-12 text-center font-bold tracking-[0.4em]" />
                          <Button onClick={isOtpSent ? handleVerifyOTP : handleRequestOTP} disabled={otpLoading || isDiscountUnlocked} variant="gold" className="h-12">
                            {otpLoading ? <RefreshCcw className="animate-spin" /> : (isDiscountUnlocked ? <CheckCircle2 /> : "OTP")}
                          </Button>
                        </div>
                        {isDiscountUnlocked && (
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 animate-in zoom-in-95">
                            <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Manager Discount %</label>
                            <Input type="number" value={managerDiscountPercent} onChange={(e) => setManagerDiscountPercent(Number(e.target.value))} className="h-10 text-center font-bold text-lg" />
                          </div>
                        )}
                      </div>

                      {/* COUPON / REWARD CODE */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reward Coupon</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="ENTER CODE"
                            value={coupon}
                            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                            className="h-11 rounded-xl border-2 border-dashed border-gold/20 text-center font-bold"
                          />
                          <Button
                            onClick={() => {
                              if (coupon === "HERITAGE2026") {
                                setCouponDiscount(1000);
                                setToastMessage("₹1000 Coupon Applied!");
                                setShowToast(true);
                              } else {
                                setToastMessage("Invalid Code");
                                setShowToast(true);
                              }
                            }}
                            variant="gold"
                            className="h-11 px-6"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>

                      {/* OLD GOLD EXCHANGE SECTION */}
                      <div className="p-4 bg-amber-50/50 rounded-2xl border border-gold/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase text-slate-600">Exchange Old Jewellery</span>
                          <input type="checkbox" checked={isExchangeApplied} onChange={(e) => setIsExchangeApplied(e.target.checked)} className="accent-gold h-4 w-4 cursor-pointer" />
                        </div>
                        {isExchangeApplied && (
                          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                            <Input placeholder="Item Name" value={exchangeData.name} onChange={(e) => setExchangeData({ ...exchangeData, name: e.target.value })} className="h-10 text-xs" />
                            <Input type="number" placeholder="Grams" value={exchangeData.grams || ""} onChange={(e) => setExchangeData({ ...exchangeData, grams: Number(e.target.value) })} className="h-10 text-xs" />
                            <Input type="number" placeholder="Value (₹)" className="col-span-2 h-10 font-bold" value={exchangeData.discount || ""} onChange={(e) => setExchangeData({ ...exchangeData, discount: Number(e.target.value) })} />
                          </div>
                        )}
                      </div>

                      {/* DETAILED PRICE BREAKDOWN (FOR DB ENTRY) */}
                      <div className="space-y-3 pt-4 border-t border-gold/10">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Gross Value</span><span className="text-slate-900">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>CGST (1.5%)</span><span>₹{cgst.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase"><span>SGST (1.5%)</span><span>₹{sgst.toLocaleString()}</span></div>

                        {managerWaiver > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-emerald-600">
                            <span>Manager Waiver ({managerDiscountPercent}%)</span>
                            <span>-₹{managerWaiver.toLocaleString()}</span>
                          </div>
                        )}
                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-blue-600">
                            <span>Coupon Discount</span>
                            <span>-₹{couponDiscount.toLocaleString()}</span>
                          </div>
                        )}
                        {exchangeDiscountValue > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-amber-600">
                            <span>Exchange Value</span>
                            <span>-₹{exchangeDiscountValue.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 mt-2 border-t border-gold/10">
                      <div className="flex justify-between items-end mb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Final Payable</span>
                        <p className="text-3xl font-serif font-bold text-slate-900">₹{total.toLocaleString()}</p>
                      </div>
                      <Button disabled={cart.length === 0} onClick={() => setCheckoutStep(2)} variant="gold" className="w-full h-14">
                        Collect Details & Payment <ChevronRight size={18} className="ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* STEP 2: CUSTOMER CRM & MULTI-MODAL PAYMENT BREAKDOWN */
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase mb-4 hover:underline">
                      <ArrowLeft size={16} /> Return to Summary
                    </button>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
                      {/* CUSTOMER PROFILE (DB FIELDS) */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Customer CRM</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="Full Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-11 rounded-xl" />
                          <Input placeholder="Phone Number" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "") })} className="h-11 rounded-xl" />
                        </div>
                        <Input type="email" placeholder="Email Address (Optional)" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="h-11 rounded-xl" />
                        <textarea
                          placeholder="Full Billing & Shipping Address"
                          rows={2}
                          value={customer.address}
                          onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                          className="w-full p-4 rounded-xl border border-gold/10 text-sm outline-none bg-white focus:border-gold/30 transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <GoldDivider opacity={10} />

                      {/* MULTI-MODAL PAYMENT (FORM DATA MAPPING) */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Payment Breakdown</h4>
                          <Badge variant="outline" className="border-gold/20 text-gold text-[9px]">MANUAL ENTRY</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {Object.keys(paymentMethods).map((method) => {
                            const icons = {
                              cash: <Banknote size={14} className="text-emerald-600" />,
                              upi: <Phone size={14} className="text-blue-500" />,
                              card: <CreditCard size={14} className="text-purple-500" />,
                              cheque: <Landmark size={14} className="text-slate-500" />
                            };
                            const isActive = paymentMethods[method as keyof typeof paymentMethods];

                            return (
                              <div key={method} className={`p-3 rounded-xl border-2 transition-all ${isActive ? 'border-gold bg-white shadow-sm' : 'border-slate-100 opacity-60 bg-slate-50/30'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    className="accent-gold h-4 w-4 cursor-pointer"
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPaymentMethods(p => ({ ...p, [method]: checked }));
                                      if (!checked) setPaymentAmounts(p => ({ ...p, [method]: 0 }));
                                    }}
                                  />
                                  <span className="text-[10px] font-bold uppercase flex items-center gap-1.5 text-slate-700">
                                    {icons[method as keyof typeof icons]} {method}
                                  </span>
                                </div>
                                {isActive && (
                                  <div className="relative animate-in zoom-in-95 duration-150">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
                                    <Input
                                      type="number"
                                      placeholder="0"
                                      className="h-9 font-bold text-right pl-5 bg-slate-50/50 border-gold/10"
                                      value={paymentAmounts[method as keyof typeof paymentAmounts] || ""}
                                      onChange={(e) => {
                                        const val = Math.max(0, Number(e.target.value));
                                        setPaymentAmounts(p => ({ ...p, [method]: val }));
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* FOOTER TOTALS & SUBMIT */}
                    <div className="pt-4 mt-2 border-t bg-slate-50 -mx-6 px-6 py-4">
                      <div className="flex justify-between items-center mb-2 px-1">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Paid Total</span>
                          <span className="text-sm font-serif font-bold text-slate-900">₹{totalPaidSoFar.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Remaining Balance</span>
                          <span className={`text-sm font-bold ${remainingToPay === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ₹{remainingToPay.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={handleCheckout}
                        variant="gold"
                        className="w-full h-14 rounded-xl shadow-lg"
                        disabled={remainingToPay !== 0 || !customer.name || !customer.phone}
                      >
                        {remainingToPay === 0 ? "Finalize & Record Purchase" : `Wait: ₹${remainingToPay} Left`}
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