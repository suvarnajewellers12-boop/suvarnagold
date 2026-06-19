"use client";

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
  RefreshCcw, CheckCircle2, Percent, Edit3, Wallet, CreditCard, Banknote, Loader2, X, Printer, LayoutDashboard,
  ShieldCheck, History, UserPlus, Fingerprint, Coins, Scale, Edit2
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SUVARNA LUXURY BILLING & POS SYSTEM 
 * Version: 2.6.0 (Enterprise Gold Edition - Multi-Metal Logic)
 * Enhanced Coupon Logic: 
 * - Cash: Universal Metal Application + Tax-only fallback
 * - Gold Wallet: 22K Restriction + VA Optimization
 * - GST calculated on post-discount taxable amount
 * - Old Gold Exchange is a Payment Mode, NOT a price deduction
 */

const BillingPOS = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const ADMIN_DISCOUNT_LIMIT = 10;

  // ==========================================
  // 1. PERSISTENT STATES & DATA INIT
  // ==========================================
  const getSaved = (key: string, fallback: any) => {
    if (typeof window === "undefined") return fallback;
    const saved = sessionStorage.getItem(key);
    try {
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [inventory, setInventory] = useState<any[]>([]);
  const [liveRates, setLiveRates] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  const [cart, setCart] = useState<any[]>(() => getSaved("pos_cart", []));
  const [customer, setCustomer] = useState(() => getSaved("pos_customer", { name: "", phone: "", email: "", address: "" }));
  const [couponData, setCouponData] = useState<any>(() => getSaved("pos_coupon", null));
  const [couponCode, setCouponCode] = useState(() => getSaved("pos_coupon_code", ""));
  const [managerDiscountPercent, setManagerDiscountPercent] = useState<number>(() => getSaved("pos_mgr_disc", 0));

  const [isOtpVerified, setIsOtpVerified] = useState(() => getSaved("pos_otp_verified", false));
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const [isExchangeApplied, setIsExchangeApplied] = useState(() => getSaved("pos_exchange_active", false));
  const [exchangeData, setExchangeData] = useState(() => getSaved("pos_exchange_data", { name: "", grams: 0, discount: 0 }));

  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [paymentMethods, setPaymentMethods] = useState({ cash: false, upi: false, card: false, cheque: false });
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: 0, upi: 0, card: 0, cheque: 0 });

  // Credit Note Coupon Mode
  const [isCreditNoteCoupon, setIsCreditNoteCoupon] = useState(() => getSaved("pos_credit_note_mode", false));

  // ==========================================
  // 2. STATE CLEARANCE LOGIC
  // ==========================================

  const performHardReset = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("pos_cart_backup");
      localStorage.removeItem("last_customer_ref");
    }
    setCart([]);
    setCustomer({ name: "", phone: "", email: "", address: "" });
    setCheckoutStep(1);
    setCouponData(null);
    setCouponCode("");
    setManagerDiscountPercent(0);
    setIsOtpVerified(false);
    setIsOtpSent(false);
    setOtp("");
    setResendCountdown(0);
    setIsExchangeApplied(false);
    setExchangeData({ name: "", grams: 0, discount: 0 });
    setPaymentMethods({ cash: false, upi: false, card: false, cheque: false });
    setPaymentAmounts({ cash: 0, upi: 0, card: 0, cheque: 0 });
    setIsCreditNoteCoupon(false);
    setSearch("");
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
    sessionStorage.setItem("pos_customer", JSON.stringify(customer));
    sessionStorage.setItem("pos_coupon", JSON.stringify(couponData));
    sessionStorage.setItem("pos_coupon_code", JSON.stringify(couponCode));
    sessionStorage.setItem("pos_mgr_disc", JSON.stringify(managerDiscountPercent));
    sessionStorage.setItem("pos_otp_verified", JSON.stringify(isOtpVerified));
    sessionStorage.setItem("pos_exchange_active", JSON.stringify(isExchangeApplied));
    sessionStorage.setItem("pos_exchange_data", JSON.stringify(exchangeData));
    sessionStorage.setItem("pos_credit_note_mode", JSON.stringify(isCreditNoteCoupon));
  }, [cart, customer, couponData, couponCode, managerDiscountPercent, isOtpVerified, isExchangeApplied, exchangeData, isCreditNoteCoupon]);

  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCountdown((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  // ==========================================
  // 3. MATH HELPERS
  // ==========================================

  const checkIsSilver = useCallback((item: any) => {
    const metal = (item.metalType || "").toLowerCase();
    const carats = String(item.carats || "").toLowerCase();
    return metal === "silver" || carats.includes("silver") || carats.includes("925") || carats.includes("99");
  }, []);

  const checkIs22K = useCallback((item: any) => {
    return String(item.carats || "").includes("22") && !checkIsSilver(item);
  }, [checkIsSilver]);

  const getRateForItem = useCallback((item: any) => {
    if (!liveRates) return 0;
    if (checkIsSilver(item)) {
      const baseSilver = parseFloat(String(liveRates.silver).replace(/[^\d.-]/g, ''));
      const purity = parseFloat(item.purity || item.carats || 100);
      return (baseSilver * (purity / 100));
    } else {
      const carat = String(item.carats || "").replace(/\D/g, "");
      const rateKey = carat === "18" ? "gold18" : carat === "22" ? "gold22" : "gold24";
      const rawRate = liveRates[rateKey] || "0";
      return parseFloat(String(rawRate).replace(/[^\d.-]/g, ''));
    }
  }, [liveRates, checkIsSilver]);

  const getDynamicPrice = useCallback((item: any) => {
    console.log("getDynamicPrice - Item Details:", {
      id: item.id,
      name: item.name,
      manualBasePrice: item.manualBasePrice,
      grams: item.grams,
      netWeight: item.grams-(item.stoneWeight || 0),
      carats: item.carats,
      va: item.va,
      stoneCost: item.stoneCost
    });

    if (item.manualBasePrice !== undefined && item.manualBasePrice !== null) {
      console.log("Using manual base price:", item.manualBasePrice);
      return Number(item.manualBasePrice);
    }
    if (!liveRates || !item.grams) return 0;

    const rate = getRateForItem(item);
    const netWeight = parseFloat(item.grams- (item.stoneWeight || 0) || item.grams);
    const baseAmount = rate * netWeight;
    const vaPercent = parseFloat(item.va || 0);
    const vaAmount = baseAmount * (vaPercent / 100);
    const finalPrice = Math.round(baseAmount + vaAmount);

    console.log("Calculated Price:", {
      rate,
      netWeight,
      baseAmount,
      vaPercent,
      vaAmount,
      finalPrice
    });

    return finalPrice;
  }, [liveRates, getRateForItem]);

  const getItemCalculationDetail = (item: any) => {
    console.log("getItemCalculationDetail - Item:", item);

    if (!liveRates) return (
      <div className="flex items-center gap-2">
        <Loader2 size={10} className="animate-spin" />
        <span className="text-[9px] uppercase">Retrieving Global Market Rates...</span>
      </div>
    );
    const rate = getRateForItem(item);
    const netWeight = parseFloat(item.grams-(item.stoneWeight || 0) || item.grams);
    const baseAmount = netWeight * rate;
    const vaPercent = parseFloat(item.va || 0);
    const vaAmt = baseAmount * (vaPercent / 100);
    const isGold22 = checkIs22K(item);

    console.log("Calculation Detail:", {
      rate,
      netWeight,
      baseAmount,
      vaPercent,
      vaAmt,
      isGold22
    });

    return (
      <div className="space-y-1.5 mt-1 border-l-2 border-gold/20 pl-3">
        <p className="tracking-tight text-slate-500 text-[10px]">
          <span className="font-bold text-slate-700">Formula:</span>{" "}
          ({netWeight}g × ₹{rate.toLocaleString()}) +
          (VA {vaPercent}%: ₹{Math.round(vaAmt).toLocaleString()})        </p>
        {!isGold22 && !checkIsSilver(item) && (
          <div className="flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-md w-fit">
            <Lock size={8} className="text-red-500" />
            <p className="text-red-500 text-[7px] font-black uppercase tracking-tighter">Gold Credit: Restricted to 22K Hallmarked Items Only</p>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 4. AGGREGATE CALCULATION
  // GST is calculated AFTER coupon + manager discount deductions
  // Old Gold Exchange is a PAYMENT MODE — NOT subtracted from price
  // ==========================================

  const subtotal = useMemo(() => {
    const calculatedSubtotal = cart.reduce((acc, item) => acc + (getDynamicPrice(item) * item.quantity) + item.stoneCost, 0);
    console.log("Subtotal Calculation:", {
      itemCount: cart.length,
      items: cart.map(item => ({
        name: item.name,
        price: getDynamicPrice(item),
        quantity: item.quantity,
        stoneCost: item.stoneCost,
        itemTotal: (getDynamicPrice(item) * item.quantity) + item.stoneCost
      })),
      subtotal: calculatedSubtotal
    });
    return calculatedSubtotal;
  }, [cart, getDynamicPrice]);

  const couponAdjustments = useMemo(() => {
    if (!couponData || cart.length === 0 || !liveRates) return { goldCredit: 0, vaCredit: 0, cashCredit: 0 };

    // Credit Note Coupon: Treat as cash credit
    if (couponData.isCreditNote || couponData.type === "CREDIT_NOTE") {
      const appliedCash = Math.min(couponData.value, subtotal);
      return { goldCredit: 0, vaCredit: 0, cashCredit: appliedCash };
    }

    if (couponData.type === "CASH") {
      const appliedCash = Math.min(couponData.value, subtotal);
      return { goldCredit: 0, vaCredit: 0, cashCredit: appliedCash };
    }

    const gold22Rate = parseFloat(String(liveRates.gold22 || "0").replace(/[^\d.-]/g, ''));
    let remainingGrams = couponData.value;
    let totalGoldSaved = 0;
    let totalVaSaved = 0;

    const eligible22K = cart
      .filter(item => checkIs22K(item))
      .sort((a, b) => parseFloat(b.va || 0) - parseFloat(a.va || 0));

    eligible22K.forEach((item) => {
      if (remainingGrams <= 0) return;
      const netWeight = parseFloat(item.netWeight || item.grams);
      const weightUsed = Math.min(netWeight, remainingGrams);
      const goldVal = weightUsed * gold22Rate;
      totalGoldSaved += goldVal;
      // Pre-closed coupons: VA benefit is blocked — only weight/gold credit applies
      if (!couponData.isPreClosed) {
        const vaPercent = parseFloat(item.va || 0);
        totalVaSaved += goldVal * (vaPercent / 100);
      }
      remainingGrams -= weightUsed;
    });

    console.log("Coupon Adjustments:", {
      totalGoldSaved,
      totalVaSaved,
      cashCredit: 0
    });

    return { goldCredit: totalGoldSaved, vaCredit: totalVaSaved, cashCredit: 0 };
  }, [couponData, cart, liveRates, subtotal, checkIs22K]);

  const requiresOwnerApproval = managerDiscountPercent > ADMIN_DISCOUNT_LIMIT;
  const discountApprovalPending = requiresOwnerApproval && !isOtpVerified;

  // Manager discount reduces the GST base only when it is within the admin cap
  // or when the owner has explicitly approved a higher discount.
  const managerWaiver = (managerDiscountPercent > 0 && (!requiresOwnerApproval || isOtpVerified))
    ? subtotal * (managerDiscountPercent / 100)
    : 0;

  const goldCartWeight = cart.filter(i => !checkIsSilver(i)).reduce((acc, i) => acc + Number(i.grams || 0), 0);

  // GST base = subtotal minus manager discount ONLY
  // Coupon discount is applied AFTER GST — it does NOT reduce the taxable base
  const gstBase = Math.max(0, subtotal - managerWaiver);

  const cgst = gstBase * 0.015;
  const sgst = gstBase * 0.015;

  // Total coupon savings (applied after GST)
  const totalCouponDiscount = (
    couponAdjustments.goldCredit +
    couponAdjustments.vaCredit +
    couponAdjustments.cashCredit
  );

  // For display: all deductions combined
  const totalDeductions = managerWaiver + totalCouponDiscount;

  // Final payable = GST base + GST - coupon discount
  const total = Math.max(0, Math.round(gstBase + cgst + sgst - totalCouponDiscount));

  console.log("Final Billing Summary:", {
    subtotal,
    managerDiscount: managerWaiver,
    gstBase,
    cgst: Math.round(cgst),
    sgst: Math.round(sgst),
    couponAdjustments,
    totalCouponDiscount,
    totalDeductions,
    final_total: total
  });

  // Exchange value as payment contribution
  const exchangePaymentValue = isExchangeApplied ? (exchangeData.discount || 0) : 0;

  // ==========================================
  // 5. PAYMENT METHODS
  // ==========================================

  const handleMethodToggle = (method: string, isChecked: boolean) => {
    const updatedMethods = { ...paymentMethods, [method]: isChecked };
    setPaymentMethods(updatedMethods);
    if (!isChecked) {
      setPaymentAmounts(prev => ({ ...prev, [method]: 0 }));
    }
  };

  // Total paid = all active payment method amounts + exchange value (as payment mode)
  const totalPaidSoFar = Math.round(
    Object.entries(paymentMethods)
      .filter(([, active]) => active)
      .reduce((sum, [method]) => sum + (paymentAmounts[method as keyof typeof paymentAmounts] || 0), 0)
    + exchangePaymentValue
  );

  const remainingToPay = Math.round(total - totalPaidSoFar);

  // ==========================================
  // 6. HANDLERS
  // ==========================================

  const addItemToCart = (product: any) => {
    if (cart.some(item => item.sku === product.sku)) {
      setToastMessage("Security: Item already present in Checkout Vault.");
      setShowToast(true);
      return;
    }
    if (product.isSold) {
      setToastMessage("Access Denied: Product is marked as SOLD.");
      setShowToast(true);
      return;
    }
    const newCartItem = { ...product, quantity: 1 };
    console.log("Item Added to Cart:", newCartItem);
    setCart(prev => [...prev, newCartItem]);
    setToastMessage(`${product.name} Secured`);
    setShowToast(true);
    setSearch("");
    setShowDropdown(false);
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const processScannedBarcode = (scannedValue: string) => {
    const skuCode = scannedValue.includes('/') ? scannedValue.split('/').pop() : scannedValue;
    const product = inventory.find(p => p.sku === skuCode || p.barcode === skuCode);
    if (product) addItemToCart(product);
    else {
      setToastMessage("Inventory Error: Product not found in database.");
      setShowToast(true);
    }
  };

  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === "INPUT" && activeElement.id !== "search-input") return;
      if (Date.now() - lastKeyTime > 50) barcodeBuffer = "";
      if (e.key === "Enter" && barcodeBuffer.length > 3) {
        e.preventDefault();
        processScannedBarcode(barcodeBuffer);
        barcodeBuffer = "";
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
      lastKeyTime = Date.now();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, inventory]);

  const handleDiscountChange = (value: string) => {
    const parsed = Number(value);
    setManagerDiscountPercent(Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0);
  };

  const handleEditItemPrice = (itemId: string, currentPrice: number) => {
    setEditingItemId(itemId);
    setEditingPrice(String(currentPrice));
  };

  const handleSaveItemPrice = (itemId: string) => {
    const newPrice = parseFloat(editingPrice);
    if (!isNaN(newPrice) && newPrice >= 0) {
      console.log("Manual Price Edit:", {
        itemId,
        newPrice,
        timestamp: new Date().toISOString()
      });
      setCart(prev => prev.map(item =>
        item.id === itemId ? { ...item, manualBasePrice: newPrice } : item
      ));
      setEditingItemId(null);
      setEditingPrice("");
      setToastMessage("Item price updated successfully.");
      setShowToast(true);
    } else {
      setToastMessage("Please enter a valid price.");
      setShowToast(true);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsApplyingCoupon(true);
    try {
      if (isCreditNoteCoupon) {
        // Credit Note Coupon Mode - Fetch from credit-note API
        const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/reports/credit-note/get/[id]?code=${couponCode.trim()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.success && data.coupons && data.coupons.length > 0) {
          const creditNoteCoupon = data.coupons[0];
          
          if (creditNoteCoupon.isUsed) {
            setToastMessage("Credit Note Coupon has already been redeemed.");
            setShowToast(true);
            setIsApplyingCoupon(false);
            return;
          }

          // Format credit note coupon for consistency
          setCouponData({
            type: "CREDIT_NOTE",
            code: creditNoteCoupon.code,
            value: creditNoteCoupon.cashAmount,
            isUsed: creditNoteCoupon.isUsed,
            invoice: creditNoteCoupon.invoice,
            pastInvoice: creditNoteCoupon.pastinvoice,
            creditNotes: creditNoteCoupon.creditNotes,
            isCreditNote: true
          });
          setToastMessage(`Credit Note Coupon ${creditNoteCoupon.code} Applied Successfully!`);
          setShowToast(true);
        } else {
          setToastMessage(data.error || "Credit Note Coupon not found or invalid.");
          setShowToast(true);
        }
      } else {
        // Scheme Coupon Mode - Original logic
        const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode.trim()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
          if (data.type === "WEIGHT") {
            const has22K = cart.some(item => checkIs22K(item));
            if (!has22K) {
              setToastMessage("Restriction: Gold Wallet vouchers require 22K Gold in cart.");
              setShowToast(true);
              setIsApplyingCoupon(false);
              return;
            }
          }
          setCouponData({ ...data, isCreditNote: false });
        } else {
          setToastMessage(data.error || "Invalid Coupon Credentials");
          setShowToast(true);
        }
      }
    } catch (error) {
      console.error("Coupon Application Error:", error);
      setToastMessage("Error applying coupon. Please try again.");
      setShowToast(true);
    } finally {
      setIsApplyingCoupon(false);
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

      if (res.ok && data.success) {
        setIsOtpSent(true);
        setIsOtpVerified(false);
        setOtp("");
        setResendCountdown(30);
        setToastMessage("OTP sent to the configured admin email.");
        setShowToast(true);
      } else {
        setToastMessage(data.error || "Unable to send OTP.");
        setShowToast(true);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setToastMessage("Enter the OTP received by the owner.");
      setShowToast(true);
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsOtpVerified(true);
        setToastMessage("Owner approval confirmed.");
        setShowToast(true);
      } else {
        setToastMessage(data.error || "OTP verification failed.");
        setShowToast(true);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (discountApprovalPending) {
      setToastMessage("Owner approval is required for discounts above 10%. Please send and verify the OTP.");
      setShowToast(true);
      return;
    }

    if (remainingToPay !== 0 || isFinalizing) {
      setToastMessage("Payment Mismatch: Please settle the full balance.");
      setShowToast(true);
      return;
    }
    setIsFinalizing(true);
    try {
      const response = await fetch("https://suvarnagold-16e5.vercel.app/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          purchaseData: {
            customerName: customer.name,
            phoneNumber: customer.phone,
            emailid: customer.email,
            Address: customer.address,
            totalAmount: subtotal,
            cgstAmount: cgst,
            sgstAmount: sgst,
            jewelleryexchangediscount: exchangePaymentValue || 0,
            excahngejewellryname: isExchangeApplied ? exchangeData.name : null,
            excahngejewellrygrams: isExchangeApplied ? exchangeData.grams : null,
            discountAmount: managerWaiver || 0,
            finalAmount: total,
            couponDiscount: totalCouponDiscount || 0,
            items: cart.map(item => ({
              productId: item.id,
              name: item.name,
              sku: item.sku,
              grams: item.grams,
              cost: getDynamicPrice(item)
            })),
          },
          paymentBreakdown: {
            cash: paymentAmounts.cash,
            upi: paymentAmounts.upi,
            card: paymentAmounts.card,
            cheque: paymentAmounts.cheque,
            oldGoldExchange: exchangePaymentValue
          }
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (couponData) {
          if (couponData.isCreditNote) {
            // Mark credit note coupon as used via PATCH endpoint
            await fetch("https://suvarnagold-16e5.vercel.app/api/payment/credit-coupon", {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ code: couponCode }),
            });
          } else {
            // Mark scheme coupon as used via original endpoint
            await fetch(`https://suvarnagold-16e5.vercel.app/api/payment/coupon/${couponCode}/used`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ invoiceNumber: data.invoiceNumber || null }),
            });
          }
        }
        setToastMessage("Purchase Completed Successfully.");
        setShowToast(true);
        performHardReset();
        setTimeout(() => {
          window.location.href = "/dashboard/reports";
        }, 2000);
      } else {
        throw new Error(data.error || "Verification failed on server side.");
      }
    } catch (e: any) {
      setToastMessage(e.message || "Checkout Failed");
      setShowToast(true);
    } finally {
      setIsFinalizing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [r, p] = await Promise.all([
          fetch("https://suvarnagold-16e5.vercel.app/api/rates"),
          fetch("https://suvarnagold-16e5.vercel.app/api/products/all", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setLiveRates(await r.json());
        const prodJson = await p.json();
        setInventory(prodJson.products || []);
      } catch (e) {
        console.error("Initialization Critical Error", e);
      }
    };
    if (token) init();   
  }, [token]);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    return inventory.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.itemCode?.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5);
  }, [search, inventory]);

  // Show loading screen while checking authentication or if not authenticated

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#FCFBF7] w-full overflow-hidden print:bg-white selection:bg-gold/30">
        <div className="print:hidden">
          <DashboardSidebar />
        </div>

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden print:h-auto">
          {/* HEADER SECTION */}
          <header className="px-10 py-4 flex items-center justify-between bg-white border-b-2 border-gold/10 shrink-0 z-50 print:hidden shadow-sm">
            <div className="flex items-center gap-8 flex-1">
              <div className="flex items-center gap-3 border-r-2 border-gold/10 pr-10">
                <div className="bg-gold p-2 rounded-lg">
                  <Landmark className="text-white" size={24} />
                </div>
                <h1 className="text-xl font-Book Antiqua font-black text-slate-900 tracking-tighter">
                  SUVARNA <span className="text-gold font-Book Antiqua font-medium text-xs tracking-[0.3em] block">ENTERPRISE POS</span>
                </h1>
              </div>

              <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/60" />
                <Input
                  id="search-input"
                  placeholder="Universal Search: Scan Barcode or Type SKU..."
                  value={search}
                  autoComplete="off"
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                  className="pl-12 h-12 rounded-xl bg-slate-50 border-gold/20 focus-visible:ring-gold transition-all focus:bg-white"
                />

                {showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gold/10 shadow-2xl rounded-2xl z-[100] overflow-hidden">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 border-b hover:bg-gold/5 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                            <Coins size={18} className="text-gold" />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-black uppercase tracking-tight ${p.isSold ? 'line-through text-gray-400' : 'text-slate-800'}`}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] border-gold/30 text-gold py-0 h-4">{p.sku}</Badge>
                              <span className="text-[10px] text-slate-400 font-bold">{p.grams}g • VA: {p.va}%</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          disabled={p.isSold || cart.some(i => i.sku === p.sku)}
                          onClick={() => addItemToCart(p)}
                          variant="gold" size="icon" className="h-9 w-9 rounded-full"
                        >
                          <Plus size={18} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end mr-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Gold 22K</p>
                <p className="text-sm font-Book Antiqua font-black text-emerald-600">₹{liveRates?.gold22 || "0.00"}</p>
              </div>
              <div className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[11px] font-black uppercase tracking-[0.2em]">
                <ScanLine size={16} className="animate-pulse" /> Live
              </div>
              <Button onClick={() => window.location.href = "/dashboard/reports"} variant="ghost" className="h-11 rounded-full px-6 text-slate-600 hover:text-gold font-bold">
                <LayoutDashboard className="mr-2" size={18} /> Analytics
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full px-10 py-8 gap-8 print:block print:px-0">
            {/* LEFT SECTION: CART VAULT */}
            <div className="w-[62%] flex flex-col overflow-hidden print:w-full">
              <LuxuryCard className="flex-1 flex flex-col p-0 rounded-[3rem] bg-white border-2 border-gold/5 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                <div className="px-10 py-6 border-b-2 border-gold/5 flex justify-between items-center bg-[#FDFCF9]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                      <ShoppingCart className="text-gold" size={20} />
                    </div>
                    <h2 className="text-xl font-Book Antiqua font-black text-slate-800">Secured Checkout Vault</h2>
                  </div>
                  <Badge className="bg-slate-900 text-gold rounded-xl px-4 py-1.5 text-[11px] font-black">
                    {cart.length} ITEMS
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar print:overflow-visible">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                      <div className="p-10 rounded-full bg-slate-50 border-2 border-dashed border-gold/20">
                        <Banknote size={80} className="text-gold" />
                      </div>
                      <p className="text-lg font-Book Antiqua italic text-slate-500">Inventory Vault Standby</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="group relative flex justify-between items-center p-6 rounded-[2.5rem] border-2 border-gold/5 bg-white hover:border-gold/30 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-8">
                          <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-gold font-Book Antiqua text-2xl font-black border-2 border-gold/10 group-hover:bg-gold group-hover:text-white transition-all shadow-inner">
                            {item.name.charAt(0)}
                          </div>
                          <div className="space-y-2">
                            <p className="text-base font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                            <div className="text-[10px] font-black text-slate-400 space-y-1.5 uppercase">
                              <div className="flex items-center gap-3">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">{item.carats}</span>
                                <span className="flex items-center gap-1"><Scale size={12} className="text-gold/50" /> {item.grams} Grams</span>
                                <span className="text-gold bg-gold/5 px-2 py-0.5 rounded border border-gold/10">VA: {item.va}%</span>
                              </div>
                              <div className="text-gold italic font-Book Antiqua leading-relaxed drop-shadow-sm">{getItemCalculationDetail(item)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            {editingItemId === item.id ? (
                              <div className="flex flex-col gap-2 items-end">
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editingPrice}
                                    onChange={(e) => setEditingPrice(e.target.value)}
                                    placeholder="Enter price"
                                    className="w-24 h-8 text-right border-gold/30"
                                    autoFocus
                                  />
                                  <Button
                                    onClick={() => handleSaveItemPrice(item.id)}
                                    variant="default"
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setEditingItemId(null);
                                      setEditingPrice("");
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 justify-end">
                                  <p className="text-xl font-black text-slate-900 italic tracking-tighter">₹{(getDynamicPrice(item) * item.quantity + item.stoneCost).toLocaleString()}</p>
                                  <Button
                                    onClick={() => handleEditItemPrice(item.id, getDynamicPrice(item) * item.quantity + item.stoneCost)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-300 hover:text-gold transition-all print:hidden"
                                  >
                                    <Edit2 size={14} />
                                  </Button>
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Item Cost</p>
                              </>
                            )}
                          </div>
                          <Button onClick={() => removeItem(item.id)} variant="ghost" size="icon" className="h-12 w-12 rounded-full text-slate-200 hover:text-red-500 transition-all print:hidden">
                            <Trash2 size={20} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-10 py-6 bg-slate-50 border-t border-gold/10 flex justify-between items-center print:hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Asset Verification: <span className="text-emerald-600">PASS</span></p>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-700">ENCRYPTED TRANSACTION</span>
                  </div>
                </div>
              </LuxuryCard>
            </div>

            {/* RIGHT SECTION: SETTLEMENT PANEL */}
            <div className="w-[38%] flex flex-col overflow-hidden h-full print:w-full">
              <LuxuryCard className="flex-1 flex flex-col p-8 bg-[#FDFCF9] border-t-[12px] border-t-gold rounded-[3rem] shadow-2xl overflow-hidden print:border-none relative">
                {checkoutStep === 1 ? (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center gap-4 border-b-2 border-gold/10 pb-5 mb-8">
                      <ReceiptText className="text-gold" size={24} />
                      <h3 className="font-Book Antiqua font-black text-xl text-slate-800 tracking-tight">Price Settlement</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Customer Discount Control
                          </label>
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Admin cap: 10%
                          </span>
                        </div>

                        <div className="relative">
                          <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={16} />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="TOTAL DISCOUNT %"
                            value={managerDiscountPercent || ""}
                            onChange={(e) => handleDiscountChange(e.target.value)}
                            className="h-14 pl-12 rounded-2xl text-center font-black text-xl text-emerald-700 bg-emerald-50 border-emerald-200"
                          />
                        </div>

                        {!requiresOwnerApproval ? (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                              Admin may apply up to 10% without OTP.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                                  Owner approval required
                                </p>
                                <p className="text-[10px] text-amber-800/85 mt-1">
                                  OTP will be sent to the admin email configured in the backend. After verification, you can enter the total discount you want to apply.
                                </p>
                              </div>
                              {isOtpSent && !isOtpVerified && (
                                <button
                                  onClick={handleRequestOTP}
                                  disabled={otpLoading || resendCountdown > 0}
                                  className={cn(
                                    "text-[10px] font-black uppercase tracking-tighter transition-all duration-300",
                                    resendCountdown > 0
                                      ? "text-slate-300 cursor-not-allowed"
                                      : "text-amber-700 hover:text-amber-900 underline underline-offset-4"
                                  )}
                                >
                                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend Code"}
                                </button>
                              )}
                            </div>

                            <div className="flex gap-3">
                              <div className="relative flex-1">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                                <Input
                                  placeholder="OWNER OTP"
                                  value={otp}
                                  onChange={(e) => setOtp(e.target.value)}
                                  disabled={isOtpVerified}
                                  className="h-14 pl-12 rounded-2xl text-center font-Book Antiqua font-black text-lg tracking-[0.6em] border-2 border-amber-200 bg-white"
                                />
                              </div>

                              <Button
                                onClick={!isOtpSent ? handleRequestOTP : handleVerifyOTP}
                                disabled={otpLoading || isOtpVerified}
                                variant="gold"
                                className="h-14 w-32 rounded-2xl shadow-lg transition-transform active:scale-95"
                              >
                                {otpLoading ? (
                                  <Loader2 className="animate-spin w-5 h-5" />
                                ) : isOtpVerified ? (
                                  <CheckCircle2 size={24} />
                                ) : isOtpSent ? (
                                  "VERIFY"
                                ) : (
                                  "GET OTP"
                                )}
                              </Button>
                            </div>

                            {isOtpVerified && (
                              <div className="flex items-center justify-center gap-2 py-1 bg-emerald-100/50 rounded-lg border border-emerald-100">
                                <CheckCircle2 size={10} className="text-emerald-600" />
                                <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">
                                  Owner Discount Approval Confirmed
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* VOUCHER MODULE */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                          <Wallet size={12} className="text-gold" /> Rewards Voucher
                        </label>

                        {/* Credit Note Toggle */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-gold/5 rounded-2xl border-2 border-gold/20 hover:border-gold/40 transition-colors">
                          <input
                            type="checkbox"
                            id="creditNoteToggle"
                            checked={isCreditNoteCoupon}
                            onChange={(e) => {
                              setIsCreditNoteCoupon(e.target.checked);
                              setCouponCode("");
                              setCouponData(null);
                            }}
                            className="w-4 h-4 cursor-pointer accent-gold"
                          />
                          <label htmlFor="creditNoteToggle" className="flex-1 text-[9px] font-black text-slate-600 uppercase tracking-widest cursor-pointer">
                            {isCreditNoteCoupon ? "💳 Credit Note Coupon" : "🎟️ Scheme Coupon"}
                          </label>
                          <span className="text-[8px] font-black text-gold uppercase tracking-tighter">
                            {isCreditNoteCoupon ? "Return Mode" : "Regular Mode"}
                          </span>
                        </div>

                        <div className="flex gap-3">
                          <Input
                            placeholder={isCreditNoteCoupon ? "CREDIT NOTE CODE" : "VOUCHER CODE"}
                            value={couponCode}
                            disabled={!!couponData}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="h-12 rounded-2xl border-2 border-dashed border-gold/30 text-center font-black tracking-widest text-primary"
                          />
                          {!couponData ? (
                            <Button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} variant="gold" className="h-12 px-8 rounded-2xl shadow-md">Apply</Button>
                          ) : (
                            <Button onClick={() => { setCouponData(null); setCouponCode(""); }} variant="ghost" className="h-12 px-6 text-red-500 border-2 border-red-100 rounded-2xl hover:bg-red-50">Reset</Button>
                          )}
                        </div>
                        {couponData && (
                          <div className={`p-3 border rounded-xl space-y-1 ${couponData.isCreditNote ? 'bg-purple-50 border-purple-200' : couponData.isPreClosed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                            <p className={`text-[10px] font-black text-center uppercase tracking-tighter italic ${couponData.isCreditNote ? 'text-purple-700' : couponData.isPreClosed ? 'text-red-700' : 'text-blue-700'}`}>
                              Voucher Type: {couponData.isCreditNote ? 'CREDIT NOTE' : couponData.type} - {couponData.isCreditNote ? 'Cash Credit' : couponData.type === 'CASH' ? 'Applicable Globally' : '22K Gold Specific'}
                            </p>
                            {couponData.isPreClosed && !couponData.isCreditNote && (
                              <p className="text-[10px] font-black text-red-600 text-center uppercase tracking-tighter">
                                ⚠ Pre-Closed — VA benefit blocked
                              </p>
                            )}
                            {couponData.isCreditNote && (
                              <p className="text-[10px] font-black text-purple-600 text-center uppercase tracking-tighter">
                                ✓ Credit Note Applied - Invoice: {couponData.invoice}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* FINANCIALS */}
                      <div className="space-y-4 pt-6 border-t-2 border-gold/10">
                        <div className="flex justify-between text-[12px] font-black text-slate-500 uppercase">
                          <span>Jewelry Value</span>
                          <span className="text-slate-900">₹{subtotal.toLocaleString()}</span>
                        </div>

                        {/* Deductions breakdown — shown BEFORE GST to clarify taxable base */}
                        <div className="space-y-3">
                          {couponAdjustments.cashCredit > 0 && (
                            <div className="flex justify-between text-[11px] font-black text-emerald-600 uppercase bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                              <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Cash Voucher Benefit</span>
                              <span>-₹{couponAdjustments.cashCredit.toLocaleString()}</span>
                            </div>
                          )}
                          {couponAdjustments.goldCredit > 0 && (
                            <div className="flex justify-between text-[11px] font-black text-blue-600 uppercase bg-blue-50/50 px-4 py-2 rounded-xl border border-blue-100">
                              <span>Gold Wallet: Weight Credit</span>
                              <span>-₹{couponAdjustments.goldCredit.toLocaleString()}</span>
                            </div>
                          )}
                          {couponAdjustments.vaCredit > 0 && (
                            <div className="flex justify-between text-[11px] font-black text-blue-600 italic uppercase bg-blue-50/50 px-4 py-2 rounded-xl border border-blue-100">
                              <span>Gold Wallet: VA Credit</span>
                              <span>-₹{couponAdjustments.vaCredit.toLocaleString()}</span>
                            </div>
                          )}
                          {managerWaiver > 0 && (
                            <div className="flex justify-between text-[12px] font-black text-emerald-600 uppercase">
                              <span>Manager Waiver</span>
                              <span>-₹{managerWaiver.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* GST on subtotal minus manager discount (coupon does NOT reduce GST base) */}
                        <div className="flex justify-between text-[12px] font-black text-slate-400 uppercase">
                          <span className="flex flex-col">
                            <span>Tax (GST 3%)</span>
                            {managerWaiver > 0 && (
                              <span className="text-[9px] text-slate-300 normal-case font-medium tracking-normal">
                              </span>
                            )}
                          </span>
                          <span>₹{Math.round(cgst + sgst).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 mt-4 border-t-4 border-gold/10">
                      <div className="flex justify-between items-center mb-6 px-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Net Payable</span>
                        <p className="text-4xl font-Book Antiqua font-black text-slate-900 tracking-tighter">₹{total.toLocaleString()}</p>
                      </div>
                      <Button
                        disabled={cart.length === 0 || discountApprovalPending}
                        onClick={() => setCheckoutStep(2)}
                        variant="gold"
                        className="w-full h-16 rounded-[1.5rem] shadow-xl text-lg font-black uppercase tracking-widest"
                      >
                        SETTLE BALANCE <ChevronRight size={22} className="ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
                    <button onClick={() => setCheckoutStep(1)} className="flex items-center gap-3 text-gold text-xs font-black uppercase mb-8 hover:underline tracking-widest">
                      <ArrowLeft size={20} /> REVISE PRICING
                    </button>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                          <User size={14} /> Client Identity
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input placeholder="Client Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="h-14 rounded-2xl" />
                          <Input placeholder="Phone Number" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, "") })} className="h-14 rounded-2xl" />
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <Input placeholder="Email Address" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="h-14 pl-12 rounded-2xl" />
                        </div>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <Input placeholder="Permanent Address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="h-14 pl-12 rounded-2xl" />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                          <CreditCard size={14} /> Payment Allocation
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.keys(paymentMethods).map((method) => (
                            <div
                              key={method}
                              className={cn(
                                "p-5 rounded-3xl border-4 transition-all duration-300",
                                paymentMethods[method as keyof typeof paymentMethods] ? "border-gold bg-white shadow-lg" : "opacity-40 bg-slate-100 border-transparent"
                              )}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={paymentMethods[method as keyof typeof paymentMethods]}
                                    onChange={(e) => handleMethodToggle(method, e.target.checked)}
                                    className="accent-gold h-5 w-5 cursor-pointer"
                                  />
                                  <span className="text-[10px] font-black uppercase tracking-tighter">{method}</span>
                                </div>
                              </div>
                              {paymentMethods[method as keyof typeof paymentMethods] && (
                                <div className="relative animate-in zoom-in-95">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold font-bold text-xs">₹</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-12 pl-7 text-right font-black text-base rounded-xl border-gold/20"
                                    value={paymentAmounts[method as keyof typeof paymentAmounts] || ""}
                                    onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [method]: Number(e.target.value) })}
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          {/* OLD GOLD EXCHANGE AS PAYMENT METHOD */}
                          <div
                            className={cn(
                              "col-span-2 p-5 rounded-3xl border-4 transition-all duration-300",
                              isExchangeApplied
                                ? "border-amber-400 bg-amber-50/60 shadow-lg"
                                : "opacity-40 bg-slate-100 border-transparent"
                            )}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isExchangeApplied}
                                  onChange={(e) => setIsExchangeApplied(e.target.checked)}
                                  className="accent-gold h-5 w-5 cursor-pointer rounded"
                                />
                                <RefreshCcw className={cn("text-amber-600", isExchangeApplied && "animate-spin-slow")} size={14} />
                                <span className="text-[10px] font-black uppercase tracking-tighter">Old Jewellery Exchange</span>
                              </div>
                              {/* Show exchange value as payment contribution when entered */}
                              {isExchangeApplied && exchangePaymentValue > 0 && (
                                <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                                  ₹{exchangePaymentValue.toLocaleString()} credited
                                </span>
                              )}
                            </div>
                            {isExchangeApplied && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    placeholder="Description"
                                    value={exchangeData.name}
                                    onChange={(e) => setExchangeData({ ...exchangeData, name: e.target.value })}
                                    className="h-11 rounded-xl text-xs font-bold"
                                  />
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Net Wt (g)"
                                    value={exchangeData.grams || ""}
                                    onChange={(e) => setExchangeData({ ...exchangeData, grams: Number(e.target.value) })}
                                    className="h-11 rounded-xl text-xs font-bold"
                                  />
                                </div>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold">₹</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Approved Exchange Value"
                                    className="h-12 pl-10 rounded-xl font-black text-lg bg-white border-amber-200"
                                    value={exchangeData.discount || ""}
                                    onChange={(e) => setExchangeData({ ...exchangeData, discount: Number(e.target.value) })}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PAYMENT SUMMARY BREAKDOWN */}
                        {(Object.values(paymentMethods).some(Boolean) || (isExchangeApplied && exchangePaymentValue > 0)) && (
                          <div className="space-y-2 pt-4 border-t-2 border-gold/10">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Breakdown</p>
                            {Object.entries(paymentMethods).map(([method, active]) =>
                              active && paymentAmounts[method as keyof typeof paymentAmounts] > 0 ? (
                                <div key={method} className="flex justify-between text-[11px] font-black text-slate-600 uppercase bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                  <span className="flex items-center gap-2">
                                    <CreditCard size={10} className="text-gold" /> {method}
                                  </span>
                                  <span>₹{paymentAmounts[method as keyof typeof paymentAmounts].toLocaleString()}</span>
                                </div>
                              ) : null
                            )}
                            {isExchangeApplied && exchangePaymentValue > 0 && (
                              <div className="flex justify-between text-[11px] font-black text-amber-700 uppercase bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                                <span className="flex items-center gap-2">
                                  <RefreshCcw size={10} className="text-amber-600" />
                                  Old Jewellery Exchange
                                  {exchangeData.name && <span className="text-amber-500 normal-case font-medium">({exchangeData.name})</span>}
                                </span>
                                <span>₹{exchangePaymentValue.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-8 mt-4 border-t-4 border-slate-100 bg-white -mx-8 px-8 py-6 shadow-2xl">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Amount Paid</span>
                          <span className="text-2xl font-black italic">₹{totalPaidSoFar.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Balance Dues</span>
                          <span className={cn(
                            "text-2xl font-black italic transition-colors duration-500",
                            remainingToPay === 0 ? "text-emerald-600" : "text-red-500 animate-pulse"
                          )}>₹{remainingToPay.toLocaleString()}</span>
                        </div>
                      </div>
                      <Button
                        onClick={handleCheckout}
                        variant="gold"
                        className="w-full h-18 rounded-3xl text-xl font-black uppercase tracking-widest py-8"
                        disabled={remainingToPay !== 0 || !customer.name || !customer.phone || isFinalizing || discountApprovalPending}
                      >
                        {isFinalizing ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="animate-spin w-6 h-6" />
                            <span>GENERATING INVOICE...</span>
                          </div>
                        ) : "FINALIZE PURCHASE"}
                      </Button>
                    </div>
                  </div>
                )}
              </LuxuryCard>
            </div>
          </div>
        </main>
      </div>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      {/* FOOTER SCANNER STATUS */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 pointer-events-none print:hidden">
        <div className="bg-slate-900/80 backdrop-blur-md text-gold px-6 py-2 rounded-full flex items-center gap-3 border border-gold/20 shadow-2xl">
          <ScanLine size={14} className="animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Scanner Core Optimized - V2.6.0</span>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default BillingPOS;