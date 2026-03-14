import React, { useEffect, useState, useRef } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
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
  ChevronRight, X, Camera, User, Phone, 
  Landmark, ReceiptText, ArrowLeft, CreditCard
} from "lucide-react";

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Core State
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);

  // Customer & Discount State
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [isDiscountUnlocked, setIsDiscountUnlocked] = useState(false);
  const [otp, setOtp] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  
  // UI State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 1. Setup: Load Razorpay & Click-Outside Listener
  useEffect(() => {
    // Load Razorpay Script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    // Handle Closing Search Dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.removeChild(script);
    };
  }, []);

  // 2. Search Logic
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

  // 3. Cart Logic
  const addToCart = (p: any) => {
    if (cart.some(item => String(item.id) === String(p.id))) {
      setToastMessage("Item already in vault");
    } else {
      setCart(prev => [...prev, { ...p, quantity: 1 }]);
      setToastMessage(`${p.name} Added`);
      setSearch("");
      setShowDropdown(false);
    }
    setShowToast(true);
  };

  const handleScan = async (result: any) => {
    if (isProcessingScan || !result?.[0]?.rawValue) return;
    setIsProcessingScan(true);
    const productId = String(result[0].rawValue).split('/').pop();

    if (cart.some(item => String(item.id) === productId)) {
      setToastMessage("Security Alert: Item already present.");
      setShowToast(true);
      setScanning(false);
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
        setScanning(false);
        setToastMessage(`${product.name} Verified`);
        setShowToast(true);
      }
    } finally { setIsProcessingScan(false); }
  };

  // 4. Financial Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.cost * (item.quantity || 1)), 0);
  const gst = subtotal * 0.3;
  const managerWaiver = isDiscountUnlocked ? subtotal * 0.05 : 0;
  const total = Math.max(0, subtotal + gst - managerWaiver - couponDiscount);

  // 5. Razorpay Checkout & Verification
  const handlePayment = async () => {
    if (!customer.name || !customer.phone) {
      setToastMessage("Customer name and phone required");
      setShowToast(true);
      return;
    }

    try {
      // Step A: Create Order
      const orderRes = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: total, customerName: customer.name, phoneNumber: customer.phone }),
      });
      const { order } = await orderRes.json();

      // Step B: Razorpay Options
      const options = {
        key: "rzp_test_SQBmMDbmpm3m0D",
        amount: order.amount,
        currency: "INR",
        name: "Suvarna Jewellery",
        description: "POS Terminal Purchase",
        order_id: order.id,
        handler: async (response: any) => {
          // Step C: Verify with Prisma-mapped data
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
                // CRITICAL: Map 'id' to 'productId' for Prisma
                items: cart.map(item => ({
                  productId: item.id,
                  name: item.name,
                  grams: item.grams,
                  cost: item.cost
                }))
              }
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setToastMessage("Success! Sale Recorded.");
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
          
          {/* HEADER */}
          <header className="px-10 py-3 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-[100] shadow-sm">
            <div className="flex items-center gap-8 flex-1">
              <div className="border-r border-gold/20 pr-8">
                <h1 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="text-gold" size={18} /> Terminal
                </h1>
              </div>

              {/* SEARCH BOX */}
              <div className="relative w-full max-w-md" ref={searchContainerRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40" />
                <Input 
                  placeholder="Find Design..." 
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); fetchProducts(e.target.value); }}
                  onFocus={() => products.length > 0 && setShowDropdown(true)}
                  className="pl-10 h-11 rounded-xl bg-slate-50 border-gold/10 focus:bg-white transition-all"
                />
                {showDropdown && (
                  <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border-2 border-gold/20 shadow-2xl rounded-2xl overflow-hidden z-[999] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {products.map((p) => (
                        <div key={p.id} className="flex justify-between items-center p-4 hover:bg-gold/5 border-b border-gold/5 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 uppercase">{p.name}</span>
                            <span className="text-[9px] text-gold font-bold">{p.grams}G | {p.carat || "22K"}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-serif font-bold text-slate-900">₹{p.cost.toLocaleString()}</span>
                            <Button onClick={() => addToCart(p)} variant="gold" size="icon" className="h-8 w-8 rounded-lg"><Plus size={16} /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={() => setScanning(!scanning)} variant={scanning ? "gold" : "outline"} className="h-10 rounded-lg border-gold/20 gap-2 px-6 text-[9px] font-bold uppercase tracking-[0.2em]">
              {scanning ? <X size={14}/> : <Camera size={14}/>} Scan QR
            </Button>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6">
            
            {/* TRANSACTION VAULT */}
            <div className="w-[62%] flex flex-col overflow-hidden relative">
              {scanning && (
                <div className="absolute inset-0 z-[60] bg-white/95 backdrop-blur-sm rounded-[2rem] flex flex-col items-center justify-center p-8 border-2 border-gold/10 animate-in fade-in">
                  <div className="relative w-full max-w-lg aspect-video rounded-2xl overflow-hidden border-4 border-gold shadow-2xl bg-black">
                    <Scanner onScan={handleScan} constraints={{ facingMode: "environment" }} allowMultiple={false} scanDelay={500} />
                  </div>
                  <Button onClick={() => setScanning(false)} variant="ghost" className="mt-6 text-slate-400 uppercase tracking-widest text-[10px] font-bold">Close Scanner</Button>
                </div>
              )}

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
                      <ShoppingCart size={100} className="mb-4 text-gold" strokeWidth={0.5} />
                      <p className="text-sm uppercase font-bold tracking-[0.8em] italic">Vault Empty</p>
                    </div>
                  ) : cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-5 rounded-[1.5rem] bg-white border border-gold/5 hover:border-gold/30 hover:shadow-lg transition-all">
                      <div className="flex items-center gap-6">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-gold font-serif text-xl border-2 border-gold/5">{item.name.charAt(0)}</div>
                        <div className="space-y-0.5">
                          <p className="text-md font-serif font-bold text-slate-800 uppercase tracking-tight leading-none">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.grams}G | {item.carat || "22K"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[8px] uppercase font-bold text-slate-300 tracking-[0.2em] mb-0.5">Price</p>
                          <p className="text-lg font-serif font-bold text-slate-900 leading-none">₹{item.cost.toLocaleString()}</p>
                        </div>
                        <Button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} variant="ghost" size="icon" className="h-9 w-9 text-slate-200 hover:text-red-500 hover:bg-red-50"><Trash2 size={18} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </div>

            {/* BILLING & CHECKOUT */}
            <div className="w-[38%] flex flex-col h-full overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-gold/20 rounded-[2rem] shadow-xl border-t-8 border-t-gold overflow-hidden">
                
                {checkoutStep === 1 ? (
                  <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-5 shrink-0">
                      <ReceiptText className="text-gold" size={20} />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar">
                      <div className="flex gap-2">
                        <Input placeholder="ADMIN OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="h-11 rounded-xl bg-white border-2 border-gold/10 text-center tracking-[0.4em] font-bold text-md shadow-inner" />
                        <Button onClick={() => otp === "1234" ? setIsDiscountUnlocked(true) : null} variant="outline" className="rounded-xl border-2 border-gold/10 text-gold h-11 w-14 shrink-0"><Lock size={18}/></Button>
                      </div>

                      <div className="flex gap-2">
                        <Input placeholder="REWARD CODE" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="h-11 rounded-xl bg-white border-2 border-dashed border-gold/10 text-center font-bold shadow-inner" />
                        <Button onClick={() => {
                          if(coupon.toUpperCase() === "HERITAGE2026") { setCouponDiscount(1000); setToastMessage("Reward Applied"); }
                          else { setCouponDiscount(0); setToastMessage("Invalid Code"); }
                          setShowToast(true);
                        }} variant="gold" className="h-11 px-5 rounded-xl text-[9px] font-bold uppercase tracking-widest shrink-0">Apply</Button>
                      </div>

                      <GoldDivider opacity={30} />

                      <div className="space-y-3 pt-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>Gross Value</span><span className="text-slate-900 font-serif text-md">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>Tax (GST 3%)</span><span className="text-slate-900 font-serif text-md">₹{gst.toLocaleString()}</span></div>
                        {isDiscountUnlocked && <div className="flex justify-between text-[10px] font-bold text-emerald-600 uppercase italic"><span>Manager Waiver (5%)</span><span>-₹{managerWaiver.toLocaleString()}</span></div>}
                        {couponDiscount > 0 && <div className="flex justify-between text-[10px] font-bold text-emerald-600 uppercase italic"><span>Coupon Reward</span><span>-₹{couponDiscount.toLocaleString()}</span></div>}
                      </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-gold/10 shrink-0">
                      <p className="text-[11px] uppercase font-bold text-gold tracking-[0.4em] mb-2">Total Payable</p>
                      <p className="text-4xl font-serif font-bold text-slate-900 leading-none">₹{total.toLocaleString()}</p>
                      <Button disabled={cart.length === 0} onClick={() => setCheckoutStep(2)} variant="gold" className="w-full h-16 rounded-[1.5rem] text-[11px] uppercase tracking-[0.5em] font-bold shadow-xl mt-5 group">
                        Enroll Profile <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase tracking-widest mb-5 hover:opacity-70 transition-all shrink-0">
                      <ArrowLeft size={14} /> Back
                    </button>
                    
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-5 shrink-0">
                      <User className="text-gold" size={20} />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Customer Details</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <Input placeholder="John Doe" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="h-10 rounded-xl bg-white border-gold/10 text-sm shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                        <Input placeholder="+91 00000 00000" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="h-10 rounded-xl bg-white border-gold/10 text-sm shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                        <Input placeholder="customer@heritage.com" value={customer.email} onChange={(e) => setCustomer({...customer, email: e.target.value})} className="h-10 rounded-xl bg-white border-gold/10 text-sm shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">Address</label>
                        <textarea placeholder="..." rows={2} value={customer.address} onChange={(e) => setCustomer({...customer, address: e.target.value})} className="w-full p-3 rounded-xl bg-white border border-gold/10 text-sm resize-none outline-none focus:border-gold transition-colors shadow-inner" />
                      </div>
                    </div>

                    <Button onClick={handlePayment} variant="gold" className="w-full h-16 rounded-[1.5rem] text-[11px] uppercase tracking-[0.4em] font-bold shadow-xl mt-5 shrink-0 active:scale-95 transition-all gap-2">
                      <CreditCard size={16} /> Pay ₹{total.toLocaleString()}
                    </Button>
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