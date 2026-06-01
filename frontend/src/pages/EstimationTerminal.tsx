"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { Badge } from "@/components/ui/badge";
import { SuccessToast } from "@/components/SuccessToast";
import { useAuth } from "@/hooks/useAuth";
import {
  Calculator, Search, Plus, Trash2,
  Printer, PackageSearch, X, Info, Banknote, Percent,
  ScanLine, ShoppingCart, RefreshCcw, Layers, Zap, Star, Loader2, Edit2, Check, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @title Suvarna Jewellers - Estimation Terminal
 * @version 2.4.0
 * @author TechSpire Team Lead
 * @description Advanced POS estimation system with Hardware Barcode/SKU integration.
 */

const EstimationTerminal = () => {
  const { token, isAuthChecking } = useAuth();

  // --- CORE STATE ---
  const [inventory, setInventory] = useState([]);
  const [liveRates, setLiveRates] = useState(null);
  const [estimateCart, setEstimateCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // --- EDIT MODE STATE ---
  const [editingItemId, setEditingItemId] = useState(null);
  const [editPrice, setEditPrice] = useState("");

  // --- HARDWARE SCANNER CONFIGURATION ---
  const scanBuffer = useRef("");
  const lastKeyTime = useRef(0);

  // --- API INTEGRATION ---
  useEffect(() => {
    const fetchCoreData = async () => {
      try {
        const [ratesRes, productsRes] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);

        if (!ratesRes.ok || !productsRes.ok) throw new Error("Network Response Error");

        const rateData = await ratesRes.json();
        const prodData = await productsRes.json();

        // Map inventory safely from the products key
        const availableProducts = prodData.products || [];
        setInventory(availableProducts);
        setLiveRates(rateData);
        setIsDataLoaded(true);
        console.log("Suvarna Terminal: Inventory Synchronized", availableProducts.length);
      } catch (error) {
        console.error("Terminal Sync Error:", error);
        setToastMessage("Sync Failed. Please Refresh.");
        setShowToast(true);
      }
    };

    if (token) fetchCoreData();
  }, [token]);

  // --- SCANNER KERNEL: GLOBAL LISTENER ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Prevent scanner collision with focused input fields
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const now = Date.now();

      // Speed check: Hardware scanners fire keys at < 50ms intervals
      if (now - lastKeyTime.current > 150) {
        scanBuffer.current = "";
      }
      lastKeyTime.current = now;

      if (e.key === "Enter") {
        const capturedSku = scanBuffer.current.trim();
        if (capturedSku.length > 2) {
          processHardwareScan(capturedSku);
        }
        scanBuffer.current = "";
      } else {
        // Build character buffer while preventing browser default variable execution
        if (e.key.length === 1) {
          scanBuffer.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [inventory]);

  const processHardwareScan = (skuString) => {
    const match = inventory.find(
      (p) => p.sku?.toLowerCase() === skuString.toLowerCase()
    );

    if (match) {
      addItemToManifest(match);
      setToastMessage(`Scanned: ${match.name}`);
      setShowToast(true);
      // Success Tone
      try { new Audio("/beep.mp3").play(); } catch (e) { }
    } else {
      setToastMessage(`SKU ${skuString} not recognized`);
      setShowToast(true);
    }
  };

  // --- PRICING ENGINE ---
  const calculateItemPricing = (item) => {
    // If custom price is set, use it
    if (item.customPrice !== undefined) {
      return {
        metal: 0,
        va: 0,
        stone: 0,
        total: Math.round(item.customPrice)
      };
    }
    
    if (!liveRates || !item.grams) return { metal: 0, va: 0, stone: 0, total: 0 };

    const metal = (item.metalType || "").toLowerCase();
    const caratsRaw = String(item.carats || "").toLowerCase();

    // Check if purity is "others" (case-insensitive)
    const isOthersPurity = caratsRaw.toLowerCase().includes("other");
    
    // Determine Purity Path (Gold vs Silver)
    const isSilver = metal === "silver" || caratsRaw.includes("99") || caratsRaw.includes("silver") || caratsRaw.includes("%");

    // Return zero price for silver items or "others" purity items
    if (isSilver || isOthersPurity) {
      return {
        metal: 0,
        va: 0,
        stone: 0,
        total: 0
      };
    }

    let gramRate = 0;
    const k = caratsRaw.replace(/\D/g, "");
    const rateString = liveRates[`gold${k}`] || liveRates[`gold22`];
    gramRate = parseFloat(String(rateString).replace(/[^\d.-]/g, '')) || 0;

    const metalVal = gramRate * item.grams;
    const vaVal = metalVal * ((item.va || 0) / 100);
    const stoneVal = parseFloat(item.stoneCost || 0);
    const finalTotal = metalVal + vaVal + stoneVal;

    return {
      metal: Math.round(metalVal),
      va: Math.round(vaVal),
      stone: Math.round(stoneVal),
      total: Math.round(finalTotal)
    };
  };

  const manifestTotals = useMemo(() => {
    return estimateCart.reduce((acc, item) => {
      const p = calculateItemPricing(item);
      return {
        metal: acc.metal + p.metal,
        va: acc.va + p.va,
        stone: acc.stone + p.stone,
        subtotal: acc.subtotal + p.total
      };
    }, { metal: 0, va: 0, stone: 0, subtotal: 0 });
  }, [estimateCart, liveRates]);

  const taxAmount = manifestTotals.subtotal * 0.03;
  const preDiscountTotal = manifestTotals.subtotal + taxAmount;
  const discountVal = preDiscountTotal * (discountPercent / 100);
  const netPayable = preDiscountTotal - discountVal;

  // --- UI ACTIONS ---
  const handleManualSearch = (val) => {
    setSearchQuery(val);
    if (val.length > 1) {
      const filtered = inventory.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase()) ||
        p.sku?.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 8);
      setSearchResults(filtered);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const addItemToManifest = (product) => {
    setEstimateCart(prev => [...prev, { ...product, tempId: crypto.randomUUID() }]);
    setSearchQuery("");
    setShowResults(false);
  };

  const removeManifestItem = (uid) => {
    setEstimateCart(prev => prev.filter(i => i.tempId !== uid));
  };

  const startEditPrice = (item) => {
    setEditingItemId(item.tempId);
    setEditPrice(item.customPrice?.toString() || "0");
  };

  const saveEditPrice = (tempId) => {
    const newPrice = parseFloat(editPrice) || 0;
    setEstimateCart(prev => prev.map(item =>
      item.tempId === tempId ? { ...item, customPrice: newPrice } : item
    ));
    setEditingItemId(null);
    setEditPrice("");
    setToastMessage("Price updated successfully");
    setShowToast(true);
  };

  const cancelEditPrice = () => {
    setEditingItemId(null);
    setEditPrice("");
  };

  // Show loading screen while checking authentication
  

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#F3F4F6] w-full overflow-hidden print:hidden font-sans">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen w-full p-6 gap-6 overflow-hidden">

          {/* TOP NAVIGATION / SEARCH */}
          <header className="flex items-center justify-between bg-white px-8 py-5 rounded-3xl border border-slate-200 shadow-xl relative z-[100]">
            <div className="flex items-center gap-8 flex-1">
              <div className="flex items-center gap-4 border-r pr-8 border-slate-100">
                <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-gold/10">
                  <Calculator className="text-gold" size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">Suvarna POS</h1>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Active Terminal</p>
                  </div>
                </div>
              </div>

              <div className="relative w-full max-w-xl group">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-gold transition-colors" size={20} />
                  <Input
                    placeholder="Scan Barcode or Search Inventory..."
                    value={searchQuery}
                    onChange={(e) => handleManualSearch(e.target.value)}
                    className="pl-12 h-14 bg-slate-50 border-slate-200 rounded-2xl focus:ring-4 focus:ring-gold/10 text-lg transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                    <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400">CTRL</kbd>
                    <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400">K</kbd>
                  </div>
                </div>

                {showResults && searchResults.length > 0 && (
                  <div className="absolute top-[110%] w-full bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden z-[110] animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matching Inventory</span>
                      <X size={14} className="cursor-pointer text-slate-400" onClick={() => setShowResults(false)} />
                    </div>
                    {searchResults.map((p) => (
                      <button key={p.id} onClick={() => addItemToManifest(p)} className="w-full flex items-center justify-between p-5 hover:bg-gold/5 border-b last:border-0 transition-all text-left">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs uppercase">
                            {p.metalType?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-gold font-bold">{p.sku} • {p.grams}g • {p.carats}</p>
                          </div>
                        </div>
                        <Plus size={18} className="text-gold" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button onClick={() => window.print()} variant="gold" className="rounded-2xl px-10 h-14 shadow-2xl shadow-gold/30 hover:scale-105 transition-transform font-bold">
                <Printer size={20} className="mr-3" /> Print Manifest
              </Button>
            </div>
          </header>

          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* MANIFEST LISTING */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <LuxuryCard className="flex-1 flex flex-col p-0 overflow-hidden border-slate-200 bg-white shadow-2xl rounded-[2.5rem]">
                <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <ShoppingCart className="text-slate-900" size={24} />
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estimation Manifest</span>
                      <p className="text-xs font-bold text-slate-600">Current Session: {estimateCart.length} Ornaments</p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setEstimateCart([])} className="text-red-500 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase">
                    Clear All
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
                  {estimateCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="relative mb-10">
                        <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full"></div>
                        <PackageSearch size={120} className="relative text-gold/10" />
                        <ScanLine className="absolute inset-0 text-gold/40 animate-pulse" size={120} />
                      </div>
                      <h2 className="text-2xl font-serif font-black text-slate-300 italic">No Items Scanned</h2>
                      <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide">Hardware scanner active & listening for input...</p>
                    </div>
                  ) : (
                    estimateCart.map((item) => {
                      const pData = calculateItemPricing(item);
                      const isEditing = editingItemId === item.tempId;
                      return (
                        <div key={item.tempId} className="group relative flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-gold/30 transition-all shadow-sm hover:shadow-xl">
                          <div className="flex items-center gap-8">
                            <div className="h-16 w-16 bg-slate-950 rounded-2xl flex flex-col items-center justify-center border border-slate-700 shadow-2xl shadow-slate-200">
                              <span className="text-[8px] font-bold text-gold/60 leading-none mb-1 uppercase">Purity</span>
                              <span className="text-xl font-black text-gold leading-none tracking-tighter">
                                {String(item.carats).replace(/\D/g, "") || "99"}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <p className="text-lg font-black uppercase text-slate-900 tracking-tight">{item.name}</p>
                                <Badge className="bg-gold/10 text-gold border-none text-[8px] font-black uppercase tracking-widest">{item.metalType}</Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-6 mt-2">
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Weight</span>
                                  <span className="text-xs font-black text-slate-700">{item.grams}g</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">VA / Making</span>
                                  <span className="text-xs font-black text-slate-700">{item.va}%</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase">SKU</span>
                                  <span className="text-xs font-black text-gold tracking-widest">{item.sku}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {isEditing ? (
                              <div className="flex items-center gap-2 bg-gold/5 px-4 py-2 rounded-2xl border border-gold/20">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">₹</span>
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm font-black bg-white border border-gold/30 rounded-lg focus:ring-2 focus:ring-gold outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditPrice(item.tempId)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                  title="Save"
                                >
                                  <Check size={18} />
                                </button>
                                <button
                                  onClick={cancelEditPrice}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Cancel"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            ) : (
                              <div className="text-right flex flex-col items-end">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Item Valuation</p>
                                <p className="text-2xl font-black text-slate-950 tabular-nums tracking-tighter">
                                  ₹{pData.total.toLocaleString()}
                                </p>
                                {item.customPrice !== undefined && (
                                  <span className="text-[8px] text-gold font-bold mt-1">Custom Price Set</span>
                                )}
                              </div>
                            )}
                            {!isEditing && (
                              <>
                                <button
                                  onClick={() => startEditPrice(item)}
                                  className="p-3 text-slate-300 hover:text-gold hover:bg-gold/10 rounded-2xl transition-all"
                                  title="Edit Price"
                                >
                                  <Edit2 size={20} />
                                </button>
                                <button
                                  onClick={() => removeManifestItem(item.tempId)}
                                  className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                  title="Remove Item"
                                >
                                  <Trash2 size={22} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </LuxuryCard>
            </div>

            {/* FINANCIALS PANEL */}
            <div className="w-[450px] flex flex-col gap-6">
              <LuxuryCard className="p-10 border-gold/20 bg-[#FDFCF9] shadow-2xl relative overflow-hidden rounded-[2.5rem]">
                <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
                  <Banknote size={150} />
                </div>

                <div className="relative z-10 h-full flex flex-col justify-between">
                  {/* Header - Reduced margin */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gold/20 rounded-lg">
                      <Layers className="text-gold" size={14} />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Valuation Summary</h3>
                  </div>

                  {/* Breakdown - Reduced spacing between rows */}
                  <div className="space-y-4">
                    {/* <div className="flex justify-between items-center group">
                      <span className="text-xs text-slate-500 font-bold">Metal Base Value</span>
                      <span className="text-sm text-slate-950 font-black tabular-nums">₹{manifestTotals.metal.toLocaleString()}</span>
                    </div> */}

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-bold">VA / Wastage</span>
                      <span className="text-sm text-slate-950 font-black tabular-nums">₹{manifestTotals.va.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-bold">Total Stone Costs</span>
                      <span className="text-sm text-slate-950 font-black tabular-nums">₹{manifestTotals.stone.toLocaleString()}</span>
                    </div>

                    {/* GST Section - Reduced vertical padding */}
                    <div className="flex justify-between items-center py-3 border-y border-slate-100 border-dashed">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold">GST (3.0%)</span>
                        <Star size={10} className="text-gold fill-gold" />
                      </div>
                      <span className="text-sm text-slate-950 font-black tabular-nums">₹{Math.round(taxAmount).toLocaleString()}</span>
                    </div>

                    {/* Rebate Section - Tightened layout */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-green-100 rounded-lg">
                            <Percent size={12} className="text-green-700" />
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-green-800 uppercase block leading-none">Instant Rebate</span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{discountPercent}% Applied</span>
                          </div>
                        </div>
                        <span className="text-green-800 font-black text-sm">-₹{Math.round(discountVal).toLocaleString()}</span>
                      </div>

                      <input
                        type="range" min="0" max="10" step="0.5"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-gold"
                      />
                    </div>

                    {/* Net Total - Reduced top padding and font size for safety */}
                    <div className="pt-4 mt-2 border-t-[2px] border-slate-900">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap size={12} className="text-gold fill-gold" />
                        <span className="text-[9px] font-black text-gold uppercase tracking-[0.3em]">Net Payable Estimation</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-serif font-black text-slate-950">₹</span>
                        <p className="text-4xl font-serif font-black text-slate-950 tracking-tighter tabular-nums">
                          {Math.round(netPayable).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </LuxuryCard>

              {/* BRANCH FOOTER */}

            </div>
          </div>
        </main>
      </div>

      {/* --- REFINED PRINT ARCHITECTURE --- */}
      {/* FINAL PRECISION PRINT VIEW - Suvarna Jewellers */}
      <div className="hidden print:block bg-white text-black w-full min-h-screen p-4 font-noto">
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wdth,wght@62.5..100,100..900&display=swap');
    
    .font-noto {
      font-family: 'Noto Sans', sans-serif !important;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        color: #000 !important;
      }
      @page {
        margin: 10mm; /* Added slight margin to prevent edge clipping */
        size: auto;
      }
    }
  `}</style>

  {/* Outer Border Container */}
  <div className="w-full border-[3px] border-black p-4 mx-auto bg-white">

    {/* Header Section */}
    <div className="text-center border-b-[2px] border-black pb-2 mb-3">
      <div className="flex justify-center mb-2">
        <img src="/logo.png" alt="Suvarna Logo" className="h-14 w-auto object-contain" />
      </div>

      <h1 className="text-3xl font-[900] uppercase tracking-tight text-black leading-tight">
        Suvarna Jewellers
      </h1>
      <p className="text-[10px] font-black italic tracking-[0.1em] uppercase text-black">
        The Benchmark of Pure Gold
      </p>

      {/* Updated Metadata Section: High Contrast */}
      <div className="flex justify-between mt-4 text-[9px] font-black uppercase tracking-tight px-1 border-t-2 border-black pt-2">
        <div className="text-left">
          <p>DATE: {new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <div className="flex gap-4 text-right">
          <p>24K: {liveRates?.gold24?.toLocaleString() || '0'}</p>
          <p>22K: {liveRates?.gold22?.toLocaleString() || '0'}</p>
          <p>18K: {liveRates?.gold18?.toLocaleString() || '0'}</p>
          <p>SILVER: {liveRates?.silver?.toLocaleString() || '0'}</p>
        </div>
      </div>
    </div>

    {/* Table Section */}
    <div className="px-0.5">
      <table className="w-full text-left border-collapse table-fixed">
        <thead>
          <tr className="border-b-2 border-black uppercase text-[9px] leading-none">
            <th className="py-3 font-black w-[40%]">ORNAMENTS DESCRIPTION</th>
            <th className="text-center font-black w-[20%]">WEIGHT DETAILS</th>
            <th className="text-center font-black w-[10%]">VA%</th>
            <th className="text-right font-black w-[30%]">AMOUNT (INR)</th>
          </tr>
        </thead>
        <tbody>
          {estimateCart.map((item) => {
            const det = calculateItemPricing(item);
            return (
              <tr key={item.tempId} className="border-b-2 border-black">
                <td className="py-3 pr-1">
                  <p className="font-black text-[12px] uppercase leading-tight">{item.name}</p>
                  <p className="text-[8px] font-bold mt-1 text-black">
                    SKU: {item.sku} | {item.carats} | HUID: {item.huid || "N/A"}
                  </p>
                </td>
                <td className="text-center align-middle">
                  <p className="text-[11px] font-black">G: {item.grams}g</p>
                  <p className="text-[8px] font-bold mt-0.5 text-black">S.Wt: {item.stoneWeight || 0}g</p>
                </td>
                <td className="text-center font-black text-[11px] align-middle">{item.va}%</td>
                <td className="text-right align-middle">
                  <p className="font-black text-[14px] tabular-nums">₹{det.total.toLocaleString()}</p>
                  <p className="text-[8px] font-bold mt-0.5 text-black">S.Cost: ₹{(item.stoneCost || 0).toLocaleString()}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Calculation Section */}
    <div className="mt-4 flex justify-end px-1">
      <div className="w-[240px] space-y-1.5 pt-1">
        <div className="flex justify-between text-[10px] font-bold">
          <span>SUBTOTAL:</span>
          <span className="font-black text-[11px]">₹{manifestTotals.subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[10px] font-bold">
          <span>GST (3.0%):</span>
          <span className="font-black text-[11px]">₹{Math.round(taxAmount).toLocaleString()}</span>
        </div>

        {discountPercent > 0 && (
          <div className="flex justify-between text-[10px] font-black italic">
            <span>LESS: DISCOUNT ({discountPercent}%):</span>
            <span>- ₹{Math.round(discountVal).toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between border-t-2 border-black pt-2 font-black text-2xl mt-2">
          <span className="uppercase text-sm">NET TOTAL:</span>
          <span className="tabular-nums">₹{Math.round(netPayable).toLocaleString()}</span>
        </div>
      </div>
    </div>

    {/* CUSTOMER INFORMATION SECTION */}
    <div className="mt-8 border-t-2 border-dashed border-black pt-4 px-2">
      <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 underline">Customer Information</h4>
      <div className="grid grid-cols-2 gap-8">
        <div className="border-b-2 border-black pb-1">
          <p className="text-[8px] font-black text-black uppercase">Customer Name:</p>
          <div className="h-4"></div>
        </div>
        <div className="border-b-2 border-black pb-1">
          <p className="text-[8px] font-black text-black uppercase">Phone Number:</p>
          <div className="h-4"></div>
        </div>
      </div>
    </div>

    {/* FOOTER */}
    <div className="mt-8 text-center pb-2">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black">
        Thank You for Shopping with Suvarna Jewellers
      </p>
      <p className="text-[8px] font-bold mt-1 text-black italic">
        * Computer Generated Estimation - Valid only for 4 hours *
      </p>
    </div>
  </div>
</div>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @media print {
          @page { margin: 1cm; }
          .print\:hidden { display: none !important; }
        }
      `}</style>
    </SidebarProvider>
  );
};

export default EstimationTerminal;