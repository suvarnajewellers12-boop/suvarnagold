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
  RefreshCcw, CheckCircle2, Percent
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

  // OTP & DYNAMIC DISCOUNT STATES
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [isDiscountUnlocked, setIsDiscountUnlocked] = useState(false);
  const [otp, setOtp] = useState("");
  const [managerDiscountPercent, setManagerDiscountPercent] = useState<number>(0);

  // EXCHANGE JEWELLERY STATES
  const [isExchangeApplied, setIsExchangeApplied] = useState(false);
  const [exchangeData, setExchangeData] = useState({
    name: "",
    grams: 0,
    discount: 0
  });

  // LIVE DATA & CUSTOMER
  const [liveRates, setLiveRates] = useState<any>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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

  const getDynamicPrice = (item: any) => {
    if (!liveRates || !item.grams) return item.cost || 0;
    const metal = (item.metal || "gold").toLowerCase();
    const carat = String(item.carat || "22").replace(/\D/g, "");

    let rateKey = "gold22";
    if (metal === "silver") rateKey = "silver";
    else if (carat === "18") rateKey = "gold18";
    else if (carat === "24") rateKey = "gold24";

    const rateString = liveRates[rateKey];
    if (!rateString) return item.cost || 0;

    const rateValue = parseFloat(String(rateString).replace(/[^\d.-]/g, ''));
    const baseMetalPrice = rateValue * item.grams;
    const vaPercent = parseFloat(item.va || 0);
    const makingCharges = baseMetalPrice * (vaPercent / 100);

    return Math.round(baseMetalPrice + makingCharges);
  };

  const processScannedBarcode = (scannedValue: string) => {
    if (isProcessingScan || !scannedValue) return;
    setIsProcessingScan(true);

    const skuCode = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;
    const product = inventory.find(p => p.sku === skuCode || p.barcode === skuCode);

    if (product) {
      if (product.isSold) {
        setToastMessage("Access Denied: Item already SOLD.");
      } else if (cart.some(item => item.sku === product.sku)) {
        setToastMessage("Security Alert: Item already in vault.");
      } else {
        setCart(prev => [...prev, { ...product, quantity: 1 }]);
        setToastMessage(`${product.name} Added`);
      }
    } else {
      setToastMessage("Product not found in local cache.");
    }
    setShowToast(true);
    setIsProcessingScan(false);
  };

  const handleSearch = (query: string) => {
    setSearch(query);
    if (!query) {
      setFilteredProducts([]);
      setShowDropdown(false);
      return;
    }
    const filtered = inventory.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredProducts(filtered.slice(0, 5));
    setShowDropdown(true);
  };

  // FINANCIAL CALCULATIONS
  const subtotal = cart.reduce((acc, item) => acc + (getDynamicPrice(item) * item.quantity), 0);
  const cgst = subtotal * 0.015;
  const sgst = subtotal * 0.015;
  const managerWaiver = isDiscountUnlocked ? (subtotal * (managerDiscountPercent / 100)) : 0;
  const exchangeDiscountValue = isExchangeApplied ? exchangeData.discount : 0;
  
  // Final Total = Subtotal + GST - Manager Waiver - Coupon - Exchange
  const total = Math.max(0, subtotal + cgst + sgst - managerWaiver - couponDiscount - exchangeDiscountValue);

  const handleCheckout = async () => {
    if (cart.length === 0 || !customer.name || !customer.phone) {
      setToastMessage("Check cart and customer details");
      setShowToast(true);
      return;
    }
    try {
      const orderRes = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: Math.ceil(total),
          customerName: customer.name,
          phoneNumber: customer.phone,
          emailid: customer.email,
          Address: customer.address,
        }),
      });
      const orderData = await orderRes.json();
      const order = orderData.order;

      const options = {
        key: "rzp_test_SQBmMDbmpm3m0D",
        amount: order.amount,
        currency: "INR",
        name: "Suvarna Jewellery",
        order_id: order.id,
        handler: async function (response: any) {
          const verifyRes = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
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
                discountAmount: managerWaiver ,
                finalAmount: total,
                items: cart.map((item) => ({
                  productId: item.id,
                  name: item.name,
                  sku: item.sku,
                  grams: item.grams,
                  cost: getDynamicPrice(item),
                })),
              },
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setToastMessage("Payment Successful");
            setShowToast(true);
            setCart([]);
            localStorage.removeItem("suvarna_pos_cart");
            setCustomer({ name: "", phone: "", email: "", address: "" });
            setExchangeData({ name: "", grams: 0, discount: 0 });
            setIsExchangeApplied(false);
            setCheckoutStep(1);
          }
        },
        prefill: { name: customer.name, contact: customer.phone, email: customer.email },
        theme: { color: "#C6A25D" },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      setToastMessage("Payment initialization failed");
      setShowToast(true);
    }
  };

  const handleRequestOTP = async () => {
    if (cart.length === 0) return;
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
    if (!otp) return;
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
        setSearch("");
      } else if (e.key.length === 1) barcodeBuffer += e.key;
      lastKeyTime = currentTime;
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, inventory, isProcessingScan]);

  const removeItem = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          <header className="px-10 py-3 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50">
            <div className="flex items-center gap-8 flex-1">
              <div className="border-r border-gold/20 pr-8">
                <h1 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="text-gold" size={18} /> Billing Terminal
                </h1>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                <Input
                  id="search-input"
                  placeholder="Search SKU or Name..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-gold/10 font-serif italic"
                />
                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gold/10 shadow-2xl rounded-xl overflow-hidden z-[100]">
                    {filteredProducts.map((p) => (
                      <div key={p.id} className={`flex items-center justify-between p-3 border-b border-gold/5 ${p.isSold ? 'bg-gray-50' : 'hover:bg-gold/5'}`}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase ${p.isSold ? 'text-gray-400 line-through' : 'text-slate-800'}`}>{p.name}</span>
                            {p.isSold && <Badge className="bg-red-100 text-red-600 text-[8px] border-none">SOLD</Badge>}
                          </div>
                          <span className="text-[9px] text-gold font-bold uppercase tracking-widest">{p.sku} | VA: {p.va}%</span>
                        </div>
                        <Button
                          disabled={p.isSold}
                          onClick={() => {
                            if (cart.some(item => item.sku === p.sku)) {
                              setToastMessage("Security Alert: Item already in vault.");
                              setShowToast(true);
                            } else {
                              setCart(prev => [...prev, { ...p, quantity: 1 }]);
                            }
                            setSearch(""); setShowDropdown(false);
                          }}
                          variant="gold" size="icon" className="h-7 w-7"
                        >
                          {p.isSold ? <Lock size={12} className="text-gray-400" /> : <Plus size={14} />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6">
              {liveRates && (
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live 22K Rate</span>
                  <p className="text-xs font-serif font-bold text-slate-900">₹{liveRates.gold22}/g</p>
                </div>
              )}
              <div className="flex items-center gap-2 px-6 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                <ScanLine size={14} className="animate-pulse" /> Scanner Ready
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6">
            <div className="w-[62%] flex flex-col overflow-hidden relative">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[2rem] border-gold/10 shadow-xl overflow-hidden bg-white">
                <div className="px-8 py-5 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9]">
                  <h2 className="text-lg font-serif font-bold italic text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="text-gold" size={20} /> Transaction Vault
                  </h2>
                  <Badge className="bg-slate-900 text-gold border border-gold/20 rounded-md px-3 py-1 text-[10px] font-bold tracking-[0.1em]">{cart.length} ITEMS</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10">
                      <Landmark size={100} className="mb-4 text-gold" strokeWidth={0.5} />
                      <p className="text-sm uppercase font-bold tracking-[0.8em] italic">Vault Empty</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-6 rounded-[1.5rem] bg-white border border-gold/5 hover:border-gold/30 hover:shadow-lg transition-all">
                        <div className="flex items-center gap-6">
                          <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-gold font-serif text-xl border-2 border-gold/5">{item.name.charAt(0)}</div>
                          <div className="space-y-1">
                            <p className="text-lg font-serif font-bold text-slate-800 uppercase tracking-tight leading-none">{item.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.grams}g | {item.carat || "22K"} | VA: {item.va}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-xl font-serif font-bold text-slate-900 leading-none">₹{getDynamicPrice(item).toLocaleString()}</p>
                          </div>
                          <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="h-10 w-10 text-slate-200 hover:text-red-500"><Trash2 size={20} /></Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </LuxuryCard>
            </div>

            <div className="w-[38%] flex flex-col overflow-hidden h-full">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-gold/20 rounded-[2rem] shadow-xl border-t-8 border-t-gold overflow-hidden">
                {checkoutStep === 1 ? (
                  <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-6">
                      <ReceiptText className="text-gold" size={20} />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3>
                    </div>
                    <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      
                      {/* OTP & Manager Discount */}
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="ADMIN OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            disabled={!isOtpSent || isDiscountUnlocked}
                            className="h-12 rounded-xl bg-white border-2 border-gold/10 text-center tracking-[0.4em] font-bold"
                          />
                          <Button onClick={isOtpSent ? handleVerifyOTP : handleRequestOTP} disabled={otpLoading || isDiscountUnlocked} variant="gold" className="rounded-xl h-12">
                            {otpLoading ? <RefreshCcw className="animate-spin" /> : (isDiscountUnlocked ? <CheckCircle2 /> : (isOtpSent ? "Verify" : "Get OTP"))}
                          </Button>
                        </div>
                        {isDiscountUnlocked && (
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <label className="text-[10px] font-bold text-emerald-700 uppercase mb-2 block">Manager Discount %</label>
                            <Input type="number" value={managerDiscountPercent} onChange={(e) => setManagerDiscountPercent(Number(e.target.value))} className="h-11 bg-white text-center text-lg font-serif font-bold" />
                          </div>
                        )}
                      </div>

                      {/* Coupon Section */}
                      <div className="flex gap-2">
                        <Input placeholder="REWARD CODE" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="h-12 rounded-xl border-2 border-dashed border-gold/10 text-center font-bold" />
                        <Button onClick={() => { if (coupon === "HERITAGE2026") setCouponDiscount(1000); }} variant="gold" className="h-12">Apply</Button>
                      </div>

                      {/* EXCHANGE SECTION */}
                      <div className="space-y-3 p-4 bg-amber-50/50 rounded-2xl border border-gold/20">
                        <div className="flex items-center gap-2 mb-1">
                          <RefreshCcw size={14} className="text-gold" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Exchange Old Jewellery</span>
                          <input 
                            type="checkbox" 
                            checked={isExchangeApplied} 
                            onChange={(e) => setIsExchangeApplied(e.target.checked)}
                            className="ml-auto accent-gold h-4 w-4"
                          />
                        </div>

                        {isExchangeApplied && (
                          <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Input 
                              placeholder="Item Name" 
                              value={exchangeData.name}
                              onChange={(e) => setExchangeData({...exchangeData, name: e.target.value})}
                              className="h-10 text-xs bg-white border-gold/10"
                            />
                            <Input 
                              type="number" 
                              placeholder="Grams" 
                              value={exchangeData.grams || ""}
                              onChange={(e) => setExchangeData({...exchangeData, grams: Number(e.target.value)})}
                              className="h-10 text-xs bg-white border-gold/10"
                            />
                            <Input 
                              type="number" 
                              placeholder="Exchange Value (₹)" 
                              value={exchangeData.discount || ""}
                              className="h-10 text-xs bg-white col-span-2 border-gold/30 font-bold"
                              onChange={(e) => setExchangeData({...exchangeData, discount: Number(e.target.value)})}
                            />
                          </div>
                        )}
                      </div>

                      <GoldDivider opacity={30} />

                      {/* Final Price Breakdown */}
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>Gross Value</span><span className="text-slate-900 font-serif text-lg">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>CGST (1.5%)</span><span className="text-slate-900 font-serif text-lg">₹{cgst.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>SGST (1.5%)</span><span className="text-slate-900 font-serif text-lg">₹{sgst.toLocaleString()}</span></div>
                        
                        {managerWaiver > 0 && (
                          <div className="flex justify-between text-[10px] font-bold text-emerald-600 italic bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <span>Manager Waiver ({managerDiscountPercent}%)</span>
                            <span>-₹{managerWaiver.toLocaleString()}</span>
                          </div>
                        )}

                        {isExchangeApplied && exchangeData.discount > 0 && (
                          <div className="flex justify-between text-[10px] font-bold text-amber-600 italic bg-amber-50 p-3 rounded-xl border border-amber-100">
                            <span className="flex items-center gap-1"><RefreshCcw size={10} /> Exchange: {exchangeData.name}</span>
                            <span>-₹{exchangeData.discount.toLocaleString()}</span>
                          </div>
                        )}

                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-[10px] font-bold text-blue-600 italic bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <span>Coupon Applied</span>
                            <span>-₹{couponDiscount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-gold/10">
                      <p className="text-4xl font-serif font-bold text-slate-900">₹{total.toLocaleString()}</p>
                      <Button disabled={cart.length === 0} onClick={() => setCheckoutStep(2)} variant="gold" className="w-full h-14 mt-4">Proceed to Customer <ChevronRight className="ml-2" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase mb-6"><ArrowLeft size={16} /> Return to Summary</button>
                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Customer Details</label>
                        <Input placeholder="Full Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-11 rounded-xl" />
                      </div>
                      <Input placeholder="Contact Phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="h-11 rounded-xl" />
                      <Input placeholder="Email Address" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="h-11 rounded-xl" />
                      <textarea placeholder="Shipping/Billing Address" rows={3} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="w-full p-4 rounded-xl border border-gold/10 text-sm outline-none bg-white focus:border-gold/40 transition-all" />
                    </div>
                    <div className="pt-6 mt-4 border-t border-gold/10">
                      <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Final Amount</span>
                        <span className="text-2xl font-serif font-bold text-slate-900">₹{total.toLocaleString()}</span>
                      </div>
                      <Button onClick={handleCheckout} variant="gold" className="w-full h-16 rounded-[1.5rem]">Complete Payment</Button>
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