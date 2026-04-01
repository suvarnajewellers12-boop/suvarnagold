import React, { useEffect, useState, useRef } from "react";
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
  Landmark, ReceiptText, ArrowLeft, RefreshCcw, CreditCard,
  CheckCircle2
} from "lucide-react";

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Core State
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);

  // Live Rates State
  const [liveRates, setLiveRates] = useState<any>(null);

  // Customer & Discount State
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [isDiscountUnlocked, setIsDiscountUnlocked] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  
  // UI State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 1. Setup: Load Razorpay & Click-Outside Listener
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  // 2. Fetch Live Rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("https://suvarnagold-16e5.vercel.app/api/rates");
        const data = await res.json();
        setLiveRates(data);
      } catch (error) {
        console.error("Failed to fetch live rates", error);
      }
    };
    fetchRates();
  }, []);

  // 3. OTP Logic (Request & Verify)
  const handleRequestOTP = async () => {
    if (cart.length === 0) {
      setToastMessage("Add items to vault first");
      setShowToast(true);
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/otp/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          discountPercent: 5,
          customerName: customer.name || "Walk-in Customer",
          adminName: "Store Admin"
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpSent(true);
        setToastMessage("OTP Requested Successfully");
      } else {
        setToastMessage(data.error || "Request failed");
      }
    } catch (error) {
      setToastMessage("Connection error");
    } finally {
      setOtpLoading(false);
      setShowToast(true);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) return;
    setOtpLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) {
        setIsDiscountUnlocked(true);
        setToastMessage("Manager Waiver Applied");
      } else {
        setToastMessage(data.error || "Invalid OTP");
      }
    } catch (error) {
      setToastMessage("Verification failed");
    } finally {
      setOtpLoading(false);
      setShowToast(true);
    }
  };

  // 4. Price Logic
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
    return Math.round(rateValue * item.grams);
  };

  const fetchProducts = async (query = "") => {
    if (!query || query.length < 1) { 
      setProducts([]); 
      setShowDropdown(false);
      return; 
    }
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const results = data.products || [];
      setProducts(results);
      setShowDropdown(results.length > 0);
    } catch (error) { console.error("Search Error:", error); }
  };

  const processScannedBarcode = async (scannedValue: string) => {
    if (isProcessingScan || !scannedValue) return;
    setIsProcessingScan(true);
    const productId = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;
    if (cart.some(item => String(item.id) === productId)) {
      setToastMessage("Item already in vault.");
      setShowToast(true);
      setIsProcessingScan(false);
      return;
    }
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/scan/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const product = await res.json();
        setCart(prev => [...prev, { ...product, quantity: 1 }]);
        setToastMessage(`${product.name} Added`);
        setShowToast(true);
      }
    } finally {
      setIsProcessingScan(false);
    }
  };

  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA") {
        if (activeElement.id !== "search-input") return; 
      }
      if (currentTime - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault(); 
        processScannedBarcode(barcodeBuffer);
        barcodeBuffer = "";
        if (activeElement.id === "search-input") {
          setSearch("");
          setShowDropdown(false);
          activeElement.blur();
        }
      } else if (e.key.length === 1) barcodeBuffer += e.key;
      lastKeyTime = currentTime;
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, isProcessingScan]);

  const subtotal = cart.reduce((acc, item) => acc + (getDynamicPrice(item) * (item.quantity || 1)), 0);
  const gst = subtotal * 0.03;
  const managerWaiver = isDiscountUnlocked ? subtotal * 0.05 : 0;
  const total = Math.max(0, subtotal + gst - managerWaiver - couponDiscount);

  const applyCoupon = () => {
    if (coupon.toUpperCase() === "HERITAGE2026") {
      setCouponDiscount(1000);
      setToastMessage("Coupon Applied: ₹1,000");
    } else {
      setCouponDiscount(0);
      setToastMessage("Invalid Code");
    }
    setShowToast(true);
  };

  const handlePayment = async () => {
    try {
      const orderRes = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: total, customerName: customer.name, phoneNumber: customer.phone }),
      });
      const { order } = await orderRes.json();
      const options = {
        key: "rzp_test_SQBmMDbmpm3m0D",
        amount: order.amount,
        currency: "INR",
        name: "Suvarna Jewellery",
        order_id: order.id,
        handler: async (response: any) => {
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
                totalAmount: subtotal,
                gstAmount: gst,
                discountAmount: managerWaiver + couponDiscount,
                finalAmount: total,
                items: cart.map(item => ({ productId: item.id, name: item.name, grams: item.grams, cost: getDynamicPrice(item) }))
              }
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setToastMessage("Sale Recorded Successfully");
            setShowToast(true);
            setCart([]);
            setCustomer({ name: "", phone: "", email: "", address: "" });
            setCheckoutStep(1);
          }
        },
        prefill: { name: customer.name, contact: customer.phone, email: customer.email },
        theme: { color: "#C6A25D" },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      setToastMessage("Payment Engine Failure");
      setShowToast(true);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          
          <header className="px-10 py-3 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-[100] shadow-sm">
            <div className="flex items-center gap-8 flex-1">
              <div className="border-r border-gold/20 pr-8">
                <h1 className="text-lg font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2 leading-none">
                  <Landmark className="text-gold" size={18} /> Terminal
                </h1>
              </div>

              <div className="relative w-full max-w-sm" ref={searchContainerRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                <Input 
                  id="search-input"
                  placeholder="Search Design..." 
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); fetchProducts(e.target.value); }}
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-gold/10 font-serif italic text-sm"
                />
                {showDropdown && products.length > 0 && (
                  <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border-2 border-gold/20 shadow-2xl rounded-2xl overflow-hidden z-[999]">
                    <div className="max-h-[300px] overflow-y-auto">
                      {products.map((p) => (
                        <div key={p.id} className="flex justify-between items-center p-4 hover:bg-gold/5 border-b border-gold/5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{p.name}</span>
                            <span className="text-[9px] text-gold font-bold uppercase tracking-widest">{p.grams}G | {p.carat || "22K"}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-serif font-bold text-slate-900">₹{getDynamicPrice(p).toLocaleString()}</span>
                            <Button onClick={() => { setCart(prev => [...prev, { ...p, quantity: 1 }]); setSearch(""); setShowDropdown(false); }} variant="gold" size="icon" className="h-7 w-7"><Plus size={14} /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {liveRates ? (
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live 22K Rate</span>
                  <span className="text-xs font-serif font-bold text-slate-900 leading-none">{liveRates.gold22}/g</span>
                </div>
              ) : <RefreshCcw size={14} className="animate-spin text-gold/50" />}
              <div className="flex items-center gap-2 px-6 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em]">
                <ScanLine size={14} className="animate-pulse" /> Scanner Ready
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6">
            <div className="w-[62%] flex flex-col overflow-hidden relative">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[2rem] border-gold/10 shadow-xl overflow-hidden bg-white">
                <div className="px-8 py-5 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9]">
                  <h2 className="text-lg font-serif font-bold italic text-slate-800 flex items-center gap-2"><ShoppingCart size={20} /> Vault</h2>
                  <Badge className="bg-slate-900 text-gold border border-gold/20 px-3 py-1 text-[10px]">{cart.length} ITEMS</Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10"><Landmark size={100} className="mb-4 text-gold" /><p className="text-sm uppercase font-bold tracking-[0.8em]">Vault Empty</p></div>
                  ) : cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-6 rounded-[1.5rem] bg-white border border-gold/5 hover:shadow-lg transition-all">
                      <div className="flex items-center gap-6">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-gold font-serif text-xl border-2 border-gold/5">{item.name.charAt(0)}</div>
                        <div className="space-y-1">
                          <p className="text-lg font-serif font-bold text-slate-800 uppercase leading-none">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.grams}G | {item.carat || "22K"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[9px] uppercase font-bold text-slate-300 mb-1">Total</p>
                          <p className="text-xl font-serif font-bold text-slate-900">₹{getDynamicPrice(item).toLocaleString()}</p>
                        </div>
                        <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="h-10 w-10 text-slate-200 hover:text-red-500"><Trash2 size={20} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </div>

            <div className="w-[38%] flex flex-col h-full overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-gold/20 rounded-[2rem] shadow-xl border-t-8 border-t-gold overflow-hidden">
                {checkoutStep === 1 ? (
                  <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-6"><ReceiptText className="text-gold" size={20} /><h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3></div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
                      {/* OTP DYNAMIC SECTION */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none pl-1">Manager Approval</label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="ADMIN OTP" 
                            value={otp} 
                            onChange={(e) => setOtp(e.target.value)} 
                            disabled={!isOtpSent || isDiscountUnlocked}
                            className="h-12 rounded-xl bg-white border-2 border-gold/10 text-center tracking-[0.4em] font-bold text-md" 
                          />
                          <Button 
                            onClick={isOtpSent ? handleVerifyOTP : handleRequestOTP} 
                            disabled={otpLoading || isDiscountUnlocked}
                            variant={isDiscountUnlocked ? "outline" : "gold"}
                            className={`rounded-xl h-12 px-4 min-w-[100px] font-bold text-[10px] uppercase tracking-widest ${isDiscountUnlocked ? 'border-emerald-500 text-emerald-600' : ''}`}
                          >
                            {otpLoading ? <RefreshCcw size={16} className="animate-spin" /> : isDiscountUnlocked ? <CheckCircle2 size={18} /> : isOtpSent ? "Verify" : "Get OTP"}
                          </Button>
                        </div>
                        {isOtpSent && !isDiscountUnlocked && <p className="text-[9px] text-gold font-bold uppercase tracking-tight text-center animate-pulse">OTP Delivered to Super Admin</p>}
                      </div>

                      <div className="flex gap-2">
                        <Input placeholder="REWARD CODE" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="h-12 rounded-xl bg-white border-2 border-dashed border-gold/10 text-center font-bold" />
                        <Button onClick={applyCoupon} variant="gold" className="h-12 px-6 rounded-xl text-[9px] font-bold uppercase shrink-0">Apply</Button>
                      </div>

                      <GoldDivider opacity={30} />

                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>Gross Value</span><span className="text-slate-900 font-serif text-lg">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>Tax (GST 3%)</span><span className="text-slate-900 font-serif text-lg">₹{gst.toLocaleString()}</span></div>
                        {isDiscountUnlocked && <div className="flex justify-between text-[10px] font-bold text-emerald-600 italic bg-emerald-50 p-3 rounded-xl border border-emerald-100"><span>Manager Waiver (5%)</span><span>-₹{managerWaiver.toLocaleString()}</span></div>}
                        {couponDiscount > 0 && <div className="flex justify-between text-[10px] font-bold text-emerald-600 italic bg-emerald-50 p-3 rounded-xl border border-emerald-100"><span>Coupon Applied</span><span>-₹{couponDiscount.toLocaleString()}</span></div>}
                      </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-gold/10 shrink-0">
                      <p className="text-[11px] uppercase font-bold text-gold tracking-[0.5em] mb-2">Total Payable</p>
                      <p className="text-4xl font-serif font-bold text-slate-900 tracking-tight">₹{total.toLocaleString()}</p>
                      <Button disabled={cart.length === 0} onClick={() => setCheckoutStep(2)} variant="gold" className="w-full h-16 rounded-[1.5rem] text-[11px] uppercase tracking-[0.6em] font-bold shadow-xl mt-6 group">
                        Enroll Profile <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase mb-6"><ArrowLeft size={16} /> Return to Billing</button>
                    <div className="flex items-center gap-4 border-b border-gold/10 pb-4 mb-6"><User className="text-gold" size={20} /><h3 className="font-serif font-bold text-lg text-slate-800">Customer Details</h3></div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                      <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label><Input value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="h-11 rounded-xl bg-white border-gold/10" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Phone</label><Input value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="h-11 rounded-xl bg-white border-gold/10" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email</label><Input value={customer.email} onChange={(e) => setCustomer({...customer, email: e.target.value})} className="h-11 rounded-xl bg-white border-gold/10" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Address</label><textarea value={customer.address} onChange={(e) => setCustomer({...customer, address: e.target.value})} className="w-full p-4 rounded-xl border-gold/10 text-sm outline-none" rows={2} /></div>
                    </div>
                    <Button onClick={handlePayment} variant="gold" className="w-full h-16 rounded-[1.5rem] text-[11px] uppercase tracking-[0.4em] font-bold mt-6 shadow-xl gap-2"><CreditCard size={16} /> Pay ₹{total.toLocaleString()}</Button>
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