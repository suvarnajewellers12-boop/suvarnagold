"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Printer, PackageSearch, X, Info, Banknote, Percent
} from "lucide-react";
import { cn } from "@/lib/utils";

const EstimationTerminal = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [inventory, setInventory] = useState([]);
  const [liveRates, setLiveRates] = useState(null);
  const [estimateCart, setEstimateCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);

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

  const calculateDetailedPrice = (item) => {
    if (!liveRates || !item.grams) return { metalValue: 0, makingCharges: 0, total: 0 };
    
    const metalField = (item.metalType || "").toLowerCase();
    const caratsField = String(item.carats || "").toLowerCase();
    const isSilver = metalField === "silver" || caratsField.includes("99") || caratsField.includes("silver");
    
    let effectiveRate = 0;
    if (isSilver) {
      const baseMarketRate = parseFloat(String(liveRates.silver).replace(/[^\d.-]/g, ''));
      const ratePerOnePercent = baseMarketRate / 99.9;
      const purity = parseFloat(item.purity || item.carats || 0);
      effectiveRate = ratePerOnePercent * purity;
    } else {
      const carat = String(item.carats || "").replace(/\D/g, "");
      const rateKey = `gold${carat}`;
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

  const totals = useMemo(() => {
    return estimateCart.reduce((acc, item) => {
      const price = calculateDetailedPrice(item);
      return {
        metal: acc.metal + price.metalValue,
        va: acc.va + price.makingCharges,
        subtotal: acc.subtotal + price.total
      };
    }, { metal: 0, va: 0, subtotal: 0 });
  }, [estimateCart, liveRates]);

  const gstAmount = totals.subtotal * 0.03;
  const grandTotalBeforeDiscount = totals.subtotal + gstAmount;
  const discountAmount = grandTotalBeforeDiscount * (discountPercent / 100);
  const netEstimation = grandTotalBeforeDiscount - discountAmount;

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 1) {
      const filtered = inventory.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.sku?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6);
      setSearchResults(filtered);
      setShowResults(true);
    } else { setShowResults(false); }
  };

  const addToEstimate = (product) => {
    setEstimateCart(prev => [...prev, { ...product, tempId: crypto.randomUUID() }]);
    setSearchQuery("");
    setShowResults(false);
    setToastMessage(`${product.name} added`);
    setShowToast(true);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#F8F9FA] w-full overflow-hidden print:hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full p-6 gap-6 overflow-hidden">
          
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
                  <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden">
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
            <div className="flex-1 flex flex-col overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-0 overflow-hidden border-slate-200 bg-white shadow-sm">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50/30">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quote Manifest</span>
                  <Badge className="bg-slate-900 text-gold font-bold">{estimateCart.length} Items</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {estimateCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                      <PackageSearch size={64} className="mb-4 text-gold/10" />
                      <p className="text-sm italic">Search and select items to build estimation</p>
                    </div>
                  ) : (
                    estimateCart.map((item) => {
                      const detail = calculateDetailedPrice(item);
                      return (
                        <div key={item.tempId} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-gold/30 transition-all shadow-sm">
                          <div className="flex items-center gap-5">
                            <div className="h-12 w-12 bg-gold/5 rounded-xl flex items-center justify-center font-bold text-gold border border-gold/10">
                              {item.carats.replace(/\D/g, "")}K
                            </div>
                            <div>
                              <p className="text-sm font-bold uppercase text-slate-900">{item.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold mt-1">
                                {item.grams}g • VA: {item.va}% • SKU: {item.sku}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-black text-slate-900">₹{detail.total.toLocaleString()}</p>
                             <button onClick={() => setEstimateCart(prev => prev.filter(i => i.tempId !== item.tempId))} className="text-[10px] text-red-600 font-bold mt-1 uppercase">Remove</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </LuxuryCard>
            </div>

            {/* Financial Analysis - Added Scrollbar logic */}
            <div className="w-[420px]  overflow-y-auto no-scrollbar flex flex-col gap-4">
              <LuxuryCard className="p-8 border-gold/20 bg-[#FDFCF9] shadow-xl relative overflow-hidden">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-10">Financial Analysis</h3>
                
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 font-bold">Metal Base Value</span>
                    <span className="text-slate-950 font-black">₹{totals.metal.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 font-bold">Wastage / VA Total</span>
                    <span className="text-slate-950 font-black">₹{totals.va.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 font-bold">GST (3% on Original)</span>
                    <span className="text-slate-950 font-black">₹{Math.round(gstAmount).toLocaleString()}</span>
                  </div>

                  <div className="pt-6 pb-2 border-t border-dashed border-slate-300">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Percent size={14} className="text-green-700" />
                        <span className="text-xs font-black text-green-800 uppercase">Discount on Overall</span>
                      </div>
                      <span className="text-green-800 font-black">- ₹{Math.round(discountAmount).toLocaleString()}</span>
                    </div>
                    <input 
                      type="range" min="0" max="5" step="0.5"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-gold"
                    />
                    <div className="flex justify-between mt-2">
                       <span className="text-xs font-black text-gold">{discountPercent}% Applied</span>
                       <span className="text-[9px] font-bold text-slate-500 uppercase">5% Max Limit</span>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <GoldDivider opacity={40} />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gold uppercase tracking-[0.1em]">Total Estimation</span>
                    <p className="text-5xl font-serif font-black text-slate-950 tracking-tighter">
                      ₹{Math.round(netEstimation).toLocaleString()}
                    </p>
                  </div>
                </div>
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      {/* PRINT VIEW - Optimized for centering and clarity */}
      <div className="hidden print:flex flex-col items-center bg-white text-black font-serif w-full min-h-screen p-10">
        <div className="w-full max-w-4xl">
          <div className="text-center border-b-[6px] border-black pb-8 mb-10">
            <h1 className="text-4xl font-black uppercase tracking-[0.3em] text-black">Suvarna Jewellers</h1>
            <p className="text-lg font-black mt-3 italic tracking-widest text-black">OFFICIAL ESTIMATION SLIP</p>
            <div className="flex justify-between mt-8 text-xs font-black uppercase tracking-wider text-black">
               <span>REF: EST-{Math.random().toString(36).substring(7).toUpperCase()}</span>
               <span>DATE: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <table className="w-full text-sm mb-12 border-collapse">
            <thead>
              <tr className="border-b-4 border-black text-left uppercase text-black">
                <th className="py-5 px-2 font-black">Item Description</th>
                <th className="text-center px-2 font-black">Weight</th>
                <th className="text-center px-2 font-black">VA%</th>
                <th className="text-right px-2 font-black">Price (Base+VA)</th>
              </tr>
            </thead>
            <tbody className="text-black">
              {estimateCart.map((item) => {
                const detail = calculateDetailedPrice(item);
                return (
                  <tr key={item.tempId} className="border-b-2 border-slate-400">
                    <td className="py-6 px-2">
                        <p className="font-black text-lg uppercase leading-tight">{item.name}</p>
                        <p className="text-xs font-bold mt-1 text-slate-800">{item.sku} | {item.carats} Gold</p>
                    </td>
                    <td className="text-center font-black px-2 text-md">{item.grams}g</td>
                    <td className="text-center font-bold px-2 text-md">{item.va}%</td>
                    <td className="text-right font-black px-2 text-md">₹{detail.total.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full max-w-md space-y-4 text-md text-black">
               <div className="flex justify-between font-bold">
                 <span>Subtotal (Metal + VA):</span>
                 <span>₹{totals.subtotal.toLocaleString()}</span>
               </div>
               <div className="flex justify-between font-bold">
                 <span>GST (3.0%):</span>
                 <span>₹{Math.round(gstAmount).toLocaleString()}</span>
               </div>
               
               <div className="flex justify-between border-t-2 border-black pt-3 font-black text-lg">
                 <span>Total Value:</span>
                 <span>₹{Math.round(grandTotalBeforeDiscount).toLocaleString()}</span>
               </div>

               {discountPercent > 0 && (
                 <div className="flex justify-between text-slate-800 italic font-black">
                   <span>Less: Discount ({discountPercent}%):</span>
                   <span>- ₹{Math.round(discountAmount).toLocaleString()}</span>
                 </div>
               )}

               <div className="flex justify-between border-t-[3px] border-black pt-5 font-black text-3xl mt-6">
                 <span>ESTIMATED NET:</span>
                 <span>₹{Math.round(netEstimation).toLocaleString()}</span>
               </div>
            </div>
          </div>
          
          <div className="mt-20 text-center border-t border-slate-300 pt-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">This is a computer-generated estimation and does not serve as a final tax invoice.</p>
          </div>
        </div>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default EstimationTerminal;