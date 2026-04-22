import React, { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { Badge } from "@/components/ui/badge";
import { SuccessToast } from "@/components/SuccessToast";
import { 
  Calculator, Search, Plus, Trash2, 
  Printer, PackageSearch, X, Info
} from "lucide-react";

const EstimationTerminal = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // DATA STATES
  const [inventory, setInventory] = useState<any[]>([]);
  const [liveRates, setLiveRates] = useState<any>(null);
  const [estimateCart, setEstimateCart] = useState<any[]>([]);
  
  // SEARCH & UI STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // INITIALIZATION
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ratesRes, productsRes] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        setLiveRates(await ratesRes.json());
        const prodData = await productsRes.json();
        setInventory(prodData.products || []);
      } catch (e) { console.error("Data fetch failed", e); }
    };
    fetchData();
  }, [token]);

  // CALCULATION LOGIC: Metal + VA + GST
  // CALCULATION LOGIC: Metal (Silver/Gold) + VA + GST
  const calculateDetailedPrice = (item: any) => {
    if (!liveRates || !item.grams) return { metalValue: 0, makingCharges: 0, total: 0 };
    
    // Improved detection for Silver vs Gold
    const metalField = (item.metal || "").toLowerCase();
    const caratsField = String(item.carats || "").toLowerCase();
    const isSilver = metalField === "silver" || caratsField.includes("99") || caratsField.includes("silver");
    
    let effectiveRate = 0;

    if (isSilver) {
      // SILVER FORMULA: (Market Rate / 99) * Purity
      const rawSilverRate = liveRates.silver;
      if (!rawSilverRate) return { metalValue: 0, makingCharges: 0, total: 0 };
      
      const baseMarketRate = parseFloat(String(rawSilverRate).replace(/[^\d.-]/g, ''));
      const ratePerOnePercent = baseMarketRate / 99.9;
      
      // Fallback to carats field if purity is missing (e.g. "99.9")
      const purity = parseFloat(item.purity || item.carats || 0);
      effectiveRate = ratePerOnePercent * purity;
    } else {
      // GOLD LOGIC
      const carat = String(item.carats || "").replace(/\D/g, "");
      const rateString = liveRates[rateKey];
      
      if (!rateString) return { metalValue: 0, makingCharges: 0, total: 0 };
      effectiveRate = parseFloat(String(rateString).replace(/[^\d.-]/g, ''));
    }
    
    const metalValue = effectiveRate * item.grams;
    const makingCharges = metalValue * ((item.va || 0) / 100);
    const totalItemPrice = metalValue + makingCharges;

    return {
      metalValue: Math.round(metalValue),
      makingCharges: Math.round(makingCharges),
      total: Math.round(totalItemPrice)
    };
  };
  // AGGREGATE TOTALS
  const totals = estimateCart.reduce((acc, item) => {
    const price = calculateDetailedPrice(item);
    return {
      metal: acc.metal + price.metalValue,
      va: acc.va + price.makingCharges,
      subtotal: acc.subtotal + price.total
    };
  }, { metal: 0, va: 0, subtotal: 0 });

  const gstAmount = totals.subtotal * 0.03;
  const netEstimation = totals.subtotal + gstAmount;

  // UI HANDLERS
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 1) {
      const filtered = inventory.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.sku?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6);
      setSearchResults(filtered);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const addToEstimate = (product: any) => {
    setEstimateCart(prev => [...prev, { ...product, tempId: crypto.randomUUID() }]);
    setSearchQuery("");
    setShowResults(false);
    setToastMessage(`${product.name} added`);
    setShowToast(true);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#F8F9FA] w-full overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full p-6 gap-6 overflow-hidden">
          
          {/* HEADER */}
          <header className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative z-[100]">
            <div className="flex items-center gap-6 flex-1">
              <div className="flex items-center gap-3 border-r pr-6 border-slate-100">
                <Calculator className="text-gold" size={24} />
                <h1 className="text-xl font-serif font-bold text-slate-900 tracking-tight">Estimation</h1>
              </div>

              <div className="relative w-full max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Search Product Name or SKU..." 
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl focus:ring-gold"
                  />
                </div>
                {showResults && searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {searchResults.map((p) => (
                      <button key={p.id} onClick={() => addToEstimate(p)} className="w-full flex items-center justify-between p-4 hover:bg-gold/5 border-b last:border-0">
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-gold font-bold">{p.sku} • {p.grams}g</p>
                        </div>
                        <Plus size={16} className="text-gold" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button onClick={() => window.print()} variant="gold" className="rounded-xl px-8 h-11 shadow-md">
              <Printer size={18} className="mr-2" /> Print Slip
            </Button>
          </header>

          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* LEFT: SELECTED ITEMS */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-0 overflow-hidden border-slate-200 bg-white">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50/30">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Products</span>
                  <Badge className="bg-slate-900 text-gold">{estimateCart.length} Items</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {estimateCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60 italic">
                      <PackageSearch size={64} className="mb-4 text-gold/10" />
                      <p className="text-sm">Search and select items for the quote</p>
                    </div>
                  ) : (
                    estimateCart.map((item) => {
                      const detail = calculateDetailedPrice(item);
                      return (
                        <div key={item.tempId} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-gold/30 transition-all">
                          <div className="flex items-center gap-5">
                            <div className="h-12 w-12 bg-gold/5 rounded-xl flex items-center justify-center font-bold text-gold border border-gold/10">
                              {item.carats.replace(/\D/g, "")}K
                            </div>
                            <div>
                              <p className="text-sm font-bold uppercase text-slate-800">{item.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                                {item.grams}g • {item.va}% Making • SKU: {item.sku}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-900">₹{detail.total.toLocaleString()}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Incl Charges</p>
                            </div>
                            <button onClick={() => setEstimateCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="p-2 text-slate-200 hover:text-red-500 transition-all">
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT: BREAKDOWN (Mirroring your image) */}
            <div className="w-[400px] flex flex-col gap-4">
               <LuxuryCard className="p-8 border-gold/20 bg-[#FDFCF9] shadow-lg relative overflow-hidden">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-10">Price Breakdown</h3>
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-medium">Gross Metal + VA</span>
                      <span className="text-slate-900 font-bold">₹{totals.subtotal.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-medium">GST (3% Combined)</span>
                      <span className="text-slate-900 font-bold">₹{gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="py-6">
                        <GoldDivider opacity={20} />
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-gold uppercase tracking-[0.1em]">Net Estimation</span>
                      <p className="text-4xl font-serif font-bold text-slate-900">
                        ₹{netEstimation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-12 p-5 bg-white rounded-2xl border border-gold/10 shadow-inner">
                    <p className="text-[10px] text-slate-400 italic leading-relaxed">
                      * Estimation is valid for current metal rates only. Final price may vary during actual purchase based on market fluctuations.
                    </p>
                  </div>
               </LuxuryCard>

               <Button 
                 onClick={() => setEstimateCart([])} 
                 variant="ghost" 
                 className="w-full h-12 text-slate-400 hover:text-red-500 hover:bg-red-50 font-bold text-[10px] uppercase tracking-widest"
               >
                 Clear All Items
               </Button>
            </div>
          </div>
        </main>
      </div>

      {/* PRINT-ONLY (Optimized for Slip Printers) */}
      <div className="hidden print:block p-12 bg-white text-black font-serif w-full">
        <div className="text-center border-b-2 border-black pb-6 mb-8">
          <h1 className="text-3xl font-bold uppercase tracking-[0.3em]">Suvarna Jewellery</h1>
          <p className="text-sm font-bold mt-2 italic">QUOTATION / ESTIMATION SLIP</p>
          <p className="text-[10px] mt-1 opacity-70">DATE: {new Date().toLocaleString()}</p>
        </div>

        <table className="w-full text-xs mb-10">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-3">Product / SKU</th>
              <th className="text-center">Weight</th>
              <th className="text-center">VA%</th>
              <th className="text-right">Total (Incl Charges)</th>
            </tr>
          </thead>
          <tbody>
            {estimateCart.map((item) => {
              const detail = calculateDetailedPrice(item);
              return (
                <tr key={item.tempId} className="border-b border-slate-200">
                  <td className="py-4 uppercase text-[10px] font-bold leading-tight">
                      {item.name}<br/>
                      <span className="text-[8px] font-normal text-slate-500">{item.sku} | {item.carats}</span>
                  </td>
                  <td className="text-center font-bold">{item.grams}g</td>
                  <td className="text-center">{item.va}%</td>
                  <td className="text-right font-bold">₹{detail.total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-1/2 space-y-3 text-sm">
             <div className="flex justify-between"><span>Subtotal:</span><span>₹{totals.subtotal.toLocaleString()}</span></div>
             <div className="flex justify-between"><span>GST (3%):</span><span>₹{gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
             <div className="flex justify-between border-t-2 border-black pt-3 font-bold text-xl">
               <span>ESTIMATED TOTAL:</span><span>₹{netEstimation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
             </div>
          </div>
        </div>

        <div className="mt-20 text-center text-[10px] border-t pt-6 italic opacity-60">
          Note: This is an estimation slip generated based on live rates. Rates fluctuate daily. Valid for date of issue only.
        </div>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default EstimationTerminal;