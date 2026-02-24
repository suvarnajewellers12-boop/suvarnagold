import React, { useEffect, useState } from "react";
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
  Mail, MapPin, Landmark, ReceiptText, ArrowLeft
} from "lucide-react";

const BillingPOS = () => {
  const token = localStorage.getItem("token");

  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); 

  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isDiscountUnlocked, setIsDiscountUnlocked] = useState(false);
  const [otp, setOtp] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchProducts = async (query = "") => {
    if (!query) { setProducts([]); return; }
    try {
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/products/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProducts(data.products || []);
      setShowDropdown(true);
    } catch (error) { console.error("Fetch error", error); }
  };

  const handleScan = async (result: any) => {
    if (isProcessingScan || !result?.[0]?.rawValue) return;
    setIsProcessingScan(true);
    const scannedValue = String(result[0].rawValue);
    const productId = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;

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
        setToastMessage(`${product.name} Verified & Added`);
        setShowToast(true);
      }
    } finally { setIsProcessingScan(false); }
  };

  const applyCoupon = () => {
    if (coupon.toUpperCase() === "GOLD5000") {
      setCouponDiscount(5000);
      setToastMessage("Premium Coupon Applied: ₹5,000 Off");
    } else {
      setCouponDiscount(0);
      setToastMessage("Invalid Coupon Code");
    }
    setShowToast(true);
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  
  const subtotal = cart.reduce((acc, item) => acc + (item.cost * (item.quantity || 1)), 0);
  const gst = subtotal * 0.18;
  const managerWaiver = isDiscountUnlocked ? (subtotal * discountPercent) / 100 : 0;
  const total = Math.max(0, subtotal + gst - managerWaiver - couponDiscount);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          <header className="px-10 py-3 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50 shadow-sm">
            <div className="flex items-center gap-8 flex-1">
              <div className="border-r border-gold/20 pr-8">
                <h1 className="text-lg font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2 leading-none">
                  <Landmark className="text-gold" size={18} /> Billing Terminal
                </h1>
              </div>

              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold/40" />
                <Input 
                  placeholder="Search Design..." 
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); fetchProducts(e.target.value); }}
                  onFocus={() => search && setShowDropdown(true)}
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-gold/10 font-serif italic text-sm"
                />
                {showDropdown && products.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gold/10 shadow-2xl rounded-xl overflow-hidden z-[100]">
                    {products.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gold/5 border-b border-gold/5 last:border-0">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{p.name}</span>
                          <span className="text-[9px] text-gold font-bold uppercase tracking-widest">{p.grams}GRAMS | {p.carat || "22K"}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-serif font-bold text-slate-900 leading-none">₹{p.cost.toLocaleString()}</span>
                          <Button 
                            onClick={() => {
                                if(!cart.some(item => String(item.id) === String(p.id))) {
                                    setCart(prev => [...prev, { ...p, quantity: 1 }]);
                                    setShowToast(true); setToastMessage(`${p.name} Added`);
                                } else {
                                    setToastMessage("Item already in vault"); setShowToast(true);
                                }
                                setSearch(""); setShowDropdown(false);
                            }} 
                            variant="gold" size="icon" className="h-7 w-7 rounded-lg active:scale-90 transition-transform"
                          >
                            <Plus size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button onClick={() => setScanning(!scanning)} variant={scanning ? "gold" : "outline"} className="h-10 rounded-lg border-gold/20 gap-2 px-6 text-[9px] font-bold uppercase tracking-[0.2em]">
              {scanning ? <X size={14}/> : <Camera size={14}/>} Scan QR
            </Button>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-6 py-6 gap-6">
            
            {/* LEFT: TRANSACTION VAULT */}
            <div className="w-[62%] flex flex-col overflow-hidden relative">
              {scanning && (
                <div className="absolute inset-0 z-[60] bg-white/95 backdrop-blur-sm rounded-[2rem] flex flex-col items-center justify-center p-8 border-2 border-gold/10 animate-in fade-in zoom-in-95 duration-300">
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
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-5 rounded-[1.5rem] bg-white border border-gold/5 hover:border-gold/30 hover:shadow-lg transition-all">
                      <div className="flex items-center gap-6">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-gold font-serif text-xl border-2 border-gold/5">{item.name.charAt(0)}</div>
                        <div className="space-y-0.5">
                          <p className="text-md font-serif font-bold text-slate-800 uppercase tracking-tight leading-none">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.grams}GRAMS | {item.carat || "22K"} PURE GOLD</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[8px] uppercase font-bold text-slate-300 tracking-[0.2em] mb-0.5">Subtotal</p>
                          <p className="text-lg font-serif font-bold text-slate-900 leading-none">₹{item.cost.toLocaleString()}</p>
                        </div>
                        <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="h-9 w-9 text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={18} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT: BILLING & CHECKOUT (ADJUSTED HEIGHT LOGIC) */}
            <div className="w-[38%] flex flex-col h-full overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-6 bg-[#FDFCF9] border-gold/20 rounded-[2rem] shadow-xl border-t-8 border-t-gold overflow-hidden">
                
                {checkoutStep === 1 ? (
                  <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-5 shrink-0">
                      <ReceiptText className="text-gold" size={20} />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Financial Summary</h3>
                    </div>

                    {/* Scrollable inputs and lines */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar">
                      {!isDiscountUnlocked ? (
                        <div className="flex gap-2">
                          <Input placeholder="ADMIN OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="h-11 rounded-xl bg-white border-2 border-gold/10 text-center tracking-[0.4em] font-bold text-md shadow-inner" />
                          <Button onClick={() => otp === "1234" ? setIsDiscountUnlocked(true) : null} variant="outline" className="rounded-xl border-2 border-gold/10 text-gold h-11 w-14 shrink-0"><Lock size={18}/></Button>
                        </div>
                      ) : (
                        <div className="space-y-1 animate-in zoom-in-95">
                          <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Percent Discount (%)</label>
                          <Input type="number" placeholder="Enter %" onChange={(e) => setDiscountPercent(Number(e.target.value))} className="h-11 rounded-xl bg-white border-2 border-gold/10 text-center font-bold shadow-inner" />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input placeholder="REWARD CODE" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="h-11 rounded-xl bg-white border-2 border-dashed border-gold/10 text-center font-bold shadow-inner" />
                        <Button onClick={applyCoupon} variant="gold" className="h-11 px-5 rounded-xl text-[9px] font-bold uppercase tracking-widest shrink-0">Apply</Button>
                      </div>

                      <GoldDivider opacity={30} />

                      <div className="space-y-2.5 pt-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>Gross Value</span><span className="text-slate-900 font-serif text-md">₹{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>Tax (GST 18%)</span><span className="text-slate-900 font-serif text-md">₹{gst.toLocaleString()}</span></div>
                        
                        {managerWaiver > 0 && (
                          <div className="flex justify-between text-[10px] font-bold text-emerald-600 uppercase italic bg-[#E6F9F0] p-2.5 rounded-xl border border-emerald-100/50 animate-in fade-in">
                            <span>Manager Waiver</span>
                            <span>-₹{managerWaiver.toLocaleString()}</span>
                          </div>
                        )}
                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-[10px] font-bold text-emerald-600 uppercase italic bg-[#E6F9F0] p-2.5 rounded-xl border border-emerald-100/50 animate-in fade-in">
                            <span>Coupon Reward</span>
                            <span>-₹{couponDiscount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fixed Bottom Section */}
                    <div className="pt-5 mt-4 border-t border-gold/10 shrink-0">
                      <p className="text-[11px] uppercase font-bold text-gold tracking-[0.4em] leading-none mb-2">Total Payable</p>
                      <p className="text-4xl font-serif font-bold text-slate-900 leading-none tracking-tight">₹{total.toLocaleString()}</p>
                      <Button 
                        disabled={cart.length === 0} 
                        onClick={() => setCheckoutStep(2)} 
                        variant="gold" 
                        className="w-full h-16 rounded-[1.5rem] text-[11px] uppercase tracking-[0.5em] font-bold shadow-xl mt-5 group active:scale-95 transition-all"
                      >
                        Enroll Profile <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase tracking-widest mb-5 hover:opacity-70 transition-all shrink-0">
                      <ArrowLeft size={14} /> Return to Billing
                    </button>
                    
                    <div className="flex items-center gap-3 border-b border-gold/10 pb-3 mb-5 shrink-0">
                      <User className="text-gold" size={20} />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Customer Enrollment</h3>
                    </div>

                    {/* Scrollable Form Fields */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none ml-1">Full Name</label>
                        <Input placeholder="John Doe" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="h-10 rounded-xl bg-white border-gold/10 text-sm shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none ml-1">Contact Phone</label>
                        <Input placeholder="+91 00000 00000" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="h-10 rounded-xl bg-white border-gold/10 text-sm shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none ml-1">Email Address</label>
                        <Input placeholder="customer@heritage.com" value={customer.email} onChange={(e) => setCustomer({...customer, email: e.target.value})} className="h-10 rounded-xl bg-white border-gold/10 text-sm shadow-inner" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none ml-1">Residential Address</label>
                        <textarea placeholder="..." rows={2} value={customer.address} onChange={(e) => setCustomer({...customer, address: e.target.value})} className="w-full p-3 rounded-xl bg-white border border-gold/10 text-sm resize-none outline-none focus:border-gold transition-colors shadow-inner" />
                      </div>
                    </div>

                    {/* Pinned Button */}
                    <Button 
                      variant="gold" 
                      className="w-full h-16 rounded-[1.5rem] text-[11px] uppercase tracking-[0.4em] font-bold shadow-xl mt-5 shrink-0 active:scale-95 transition-all"
                    >
                      Confirm & Generate Invoice
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
