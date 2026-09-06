"use client";

import { useState, useMemo, useEffect } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import {
  Plus, ShoppingBag, IndianRupee, Scale, X, Coins,
  Wallet, Gem, ArrowRight, User, CheckCircle2, Clock,
  Loader2, RefreshCw, Printer, Download, Hash, Tag, PackageCheck, AlertCircle, Pencil
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE = "https://suvarnagold-16e5.vercel.app/api/gold/order";

export default function OrderManagementPage() {
  const { token } = useAuth();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("Order Saved Successfully!");
  const [metalType, setMetalType] = useState<"GOLD" | "SILVER">("GOLD");
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  // Creation Form State
  const [form, setForm] = useState({
    customerName: "",
    phoneNumber: "",
    itemName: "",
    itemDescription: "",
    exchangeJewelleryName: "",
    exchangeJewelleryGrams: "",
    purity: "22",
    liveRate: "",
    requiredGrams: "", // grams required to make the item -> becomes netWeight
    stoneWeight: "",
    vaPercentage: "",
    stoneCost: "",
    discountAmount: "",
    advanceCash: "",
    deadlineDate: "",
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (viewingOrder) {
      setEditForm({
        customerName: viewingOrder.customerName || "",
        phoneNumber: viewingOrder.phoneNumber || "",
        itemName: viewingOrder.itemName || "",
        itemDescription: viewingOrder.itemDescription || "",
        liveRate: viewingOrder.liveRate ?? "",
        netWeight: viewingOrder.netWeight ?? "",
        stoneWeight: viewingOrder.stoneWeight ?? "",
        vaPercentage: viewingOrder.vaPercentage ?? "",
        stoneCost: viewingOrder.stoneCost ?? "",
        discountAmount: viewingOrder.discountAmount ?? "",
        advanceCash: viewingOrder.advanceCash ?? "",
        weightAdjustmentGrams: viewingOrder.weightAdjustmentGrams ?? 0,
        adjustmentCost: viewingOrder.adjustmentCost ?? 0,
        exchangeJewelleryName: viewingOrder.exchangeJewelleryName || "",
        exchangeJewelleryGrams: viewingOrder.exchangeJewelleryGrams ?? "",
      });
    }
  }, [viewingOrder]);

  // ---------------------------------------------------------------------------
  // PDF GENERATION
  // ---------------------------------------------------------------------------
  const handleOrderReceipt = async (order: any, mode: "download" | "print", type: "BOOKING" | "DELIVERY" = "BOOKING") => {
    try {
      const fontBytes = await fetch("/fonts/NotoSans-VariableFont_wdth,wght.ttf").then((res) => res.arrayBuffer());

      const A5_W = 419.53;
      const A5_H = 595.28;
      const SAFE_TOP = 80;
      const MARGIN_L = 30;
      const MARGIN_R = A5_W - 30;

      const gold = rgb(0.72, 0.52, 0.04);
      const grey = rgb(0.45, 0.45, 0.45);
      const black = rgb(0, 0, 0);
      const lightGrey = rgb(0.85, 0.85, 0.85);
      const emerald = rgb(0.06, 0.47, 0.23);

      let pdfDoc: any;
      if (mode === "download") {
        const templateBytes = await fetch("/receipt.pdf").then((res) => res.arrayBuffer());
        pdfDoc = await PDFDocument.load(templateBytes);
        pdfDoc.getPages()[0].setSize(A5_W, A5_H);
      } else {
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([A5_W, A5_H]);
      }

      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPages()[0];

      const makePen = (page: any) => {
        const draw = (text: string, x: number, yFromTop: number, size = 9, color = black) =>
          page.drawText(String(text ?? ""), { x, y: A5_H - yFromTop, size, font: customFont, color });

        const drawR = (text: string, rightX: number, yFromTop: number, size = 9, color = black) => {
          const w = customFont.widthOfTextAtSize(String(text ?? ""), size);
          page.drawText(String(text ?? ""), { x: rightX - w, y: A5_H - yFromTop, size, font: customFont, color });
        };

        const hLine = (yFromTop: number, lineColor = lightGrey, thickness = 0.4) =>
          page.drawLine({
            start: { x: MARGIN_L, y: A5_H - yFromTop },
            end: { x: MARGIN_R, y: A5_H - yFromTop },
            thickness,
            color: lineColor,
          });

        return { draw, drawR, hLine };
      };

      const { draw, drawR, hLine } = makePen(page);

      // ── CALCULATIONS (include weight adjustment made after crafting) ──
      const bookedWt = Number(order.netWeight) || 0;
      const weightAdj = Number(order.weightAdjustmentGrams) || 0;
      const adjustmentCost = Number(order.adjustmentCost) || 0;
      const netWt = bookedWt + weightAdj; // final actual weight used for billing

      const grossWt = Number(order.grossWeight) || netWt + (Number(order.stoneWeight) || 0);
      const stoneWt = Number(order.stoneWeight) || 0;
      const rate = Number(order.liveRate) || 0;
      const vaPer = Number(order.vaPercentage) || 0;
      const stoneC = Number(order.stoneCost) || 0;
      const discAmt = Number(order.discountAmount) || 0;
      const advance = Number(order.advanceCash) || 0;
      const originalCartValue = Number(order.originalCartValue) || 0;

      const goldValue = netWt * rate;
      const vaAmount = goldValue * (vaPer / 100);
      const subtotalBeforeDisc = goldValue + vaAmount + stoneC + adjustmentCost;
      const subtotalAfterDisc = Math.max(0, subtotalBeforeDisc - discAmt);
      const halfGst = subtotalAfterDisc * 0.015;
      const grandTotal = subtotalAfterDisc + halfGst * 2;
      const balance = grandTotal - advance;

      // ── HEADER ──
      const HDR_Y = SAFE_TOP + 10;
      const typeLabel = type === "DELIVERY" ? "DELIVERY CONFIRMATION" : "BOOKING RECEIPT";
      draw(typeLabel, MARGIN_L, HDR_Y, 9.5, black);
      drawR(`Order: ${order.orderId}`, MARGIN_R, HDR_Y, 8, grey);
      drawR(`Date: ${format(new Date(), "dd-MM-yyyy")}`, MARGIN_R, HDR_Y + 12, 7.5, grey);
      hLine(HDR_Y + 26);

      // ── CUSTOMER ──
      const CUST_Y = HDR_Y + 38;
      draw("CUSTOMER", MARGIN_L, CUST_Y, 7.5, grey);
      draw(order.customerName, MARGIN_L, CUST_Y + 11, 8.5, black);
      draw(`Ph: +91 ${order.phoneNumber}`, MARGIN_L, CUST_Y + 22, 7.5, grey);
      hLine(CUST_Y + 32);

      // ── ITEM TABLE ──
      const TBL_Y = CUST_Y + 50;
      const col = { name: MARGIN_L, gross: 130, stone: 185, net: 245, va: 305, total: MARGIN_R };
      draw("ITEM", col.name, TBL_Y, 7, grey);
      draw("GROSS", col.gross, TBL_Y, 7, grey);
      draw("STONE", col.stone, TBL_Y, 7, grey);
      draw("NET", col.net, TBL_Y, 7, grey);
      draw("VA", col.va, TBL_Y, 7, grey);
      drawR("AMOUNT", col.total, TBL_Y, 7, grey);
      hLine(TBL_Y + 9);

      const ROW_Y = TBL_Y + 19;
      draw(order.itemName || "Custom Item", col.name, ROW_Y, 7.5, black);
      draw(`${grossWt}g`, col.gross, ROW_Y, 7.5, black);
      draw(`${stoneWt}g`, col.stone, ROW_Y, 7.5, black);
      draw(`${netWt}g`, col.net, ROW_Y, 7.5, black);
      draw(`₹${Math.round(vaAmount).toLocaleString()}`, col.va, ROW_Y, 7.5, black);
      drawR(`₹${Math.round(originalCartValue).toLocaleString()}`, col.total, ROW_Y, 7.5, black);
      hLine(ROW_Y + 13);

      // ── CART SUMMARY ──
      let CART_Y = ROW_Y + 22;
      draw("CART SUMMARY", MARGIN_L, CART_Y, 7.5, grey);
      hLine(CART_Y + 8);

      const cartRow = (label: string, value: string, y: number, valueColor = black) => {
        draw(label, MARGIN_L, y, 6.5, grey);
        drawR(value, MARGIN_R, y, 6.5, valueColor);
      };

      const storedOriginalCartValue = originalCartValue || (subtotalBeforeDisc + subtotalBeforeDisc * 0.03);
      let rowOffset = 14;
      cartRow("Original Cart Value", `₹${Math.round(storedOriginalCartValue).toLocaleString()}`, CART_Y + rowOffset, gold);
      rowOffset += 7;

      cartRow(
        `Exchange Value [${order.exchangeJewelleryName || "N/A"}]`,
        `₹${Math.round(discAmt || 0).toLocaleString()}`,
        CART_Y + rowOffset,
        gold
      );
      rowOffset += 7;

      if (weightAdj !== 0) {
        cartRow(
          `Weight Adjustment (${weightAdj > 0 ? "+" : ""}${weightAdj}g)`,
          `${adjustmentCost >= 0 ? "" : "-"}₹${Math.round(Math.abs(adjustmentCost)).toLocaleString()}`,
          CART_Y + rowOffset,
          weightAdj > 0 ? emerald : rgb(0.7, 0.1, 0.1)
        );
        rowOffset += 7;
      }

      cartRow("Taxable Total", `₹${Math.round(subtotalAfterDisc).toLocaleString()}`, CART_Y + rowOffset);
      rowOffset += 7;
      cartRow("GST (3%)", `₹${Math.round(halfGst * 2).toLocaleString()}`, CART_Y + rowOffset);
      rowOffset += 7;
      cartRow("Final Payable", `₹${Math.round(grandTotal).toLocaleString()}`, CART_Y + rowOffset, emerald);
      hLine(CART_Y + rowOffset + 6);
      CART_Y = CART_Y + rowOffset + 6;

      // ── WEIGHT DETAILS ──
      const FIN_Y = CART_Y + 10;
      draw("WEIGHT DETAILS", MARGIN_L, FIN_Y, 7.5, grey);
      hLine(FIN_Y + 8);

      const finRow = (label: string, value: string, y: number) => {
        draw(label, MARGIN_L, y, 6.5, grey);
        drawR(value, MARGIN_R, y, 6.5, black);
      };

      finRow(`Required (Booked)`, `${bookedWt}g`, FIN_Y + 14);
      finRow(`Adjustment`, `${weightAdj > 0 ? "+" : ""}${weightAdj}g`, FIN_Y + 21);
      finRow(`Final Net Weight`, `${netWt}g`, FIN_Y + 28);
      hLine(FIN_Y + 34);

      // ── PAYMENT STATUS ──
      const PAY_Y = FIN_Y + 44;
      draw("PAYMENT STATUS", MARGIN_L, PAY_Y, 7.5, grey);
      hLine(PAY_Y + 8);

      finRow(`Total Bill`, `₹${Math.round(grandTotal).toLocaleString()}`, PAY_Y + 14);
      finRow(`Advance Paid`, `₹${Math.round(advance).toLocaleString()}`, PAY_Y + 21);

      if (type === "DELIVERY") {
        finRow(`Balance Due`, `₹ 0 (Paid)`, PAY_Y + 28);
      } else {
        finRow(`Balance Due`, `₹${Math.round(balance).toLocaleString()}`, PAY_Y + 28);
      }
      hLine(PAY_Y + 34);

      // ── SETTLEMENT BOX ──
      const SETT_Y = PAY_Y + 44;
      const settBoxW = 160;
      const settBoxH = 45;
      const settBoxX = MARGIN_R - settBoxW;
      const settBoxBottomY = A5_H - SETT_Y - settBoxH;

      page.drawRectangle({
        x: settBoxX,
        y: settBoxBottomY,
        width: settBoxW,
        height: settBoxH,
        color: rgb(0.98, 0.95, 0.88),
        borderColor: gold,
        borderWidth: 1.2,
      });

      page.drawText("SETTLEMENT", { x: settBoxX + 10, y: settBoxBottomY + 23, size: 7, font: customFont, color: grey });

      if (type === "DELIVERY") {
        const balanceText = "FULLY PAID ";
        const balanceW = customFont.widthOfTextAtSize(balanceText, 10);
        page.drawText(balanceText, { x: settBoxX + (settBoxW - balanceW) / 2, y: settBoxBottomY + 6, size: 10, font: customFont, color: emerald });
      } else {
        const balanceText = `₹${Math.round(balance).toLocaleString()} Pending`;
        const balanceW = customFont.widthOfTextAtSize(balanceText, 9);
        page.drawText(balanceText, { x: settBoxX + (settBoxW - balanceW) / 2, y: settBoxBottomY + 6, size: 9, font: customFont, color: gold });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);

      if (mode === "download") {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `${type}_${order.orderId}_${format(new Date(), "ddMMyy")}.pdf`;
        link.click();
      } else {
        const printWindow = window.open(pdfUrl);
        if (printWindow) printWindow.addEventListener("load", () => printWindow.print());
      }
    } catch (error) {
      console.error("Order PDF Error:", error);
    }
  };

  // ---------------------------------------------------------------------------
  // API OPERATIONS
  // ---------------------------------------------------------------------------
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/all`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (error) { console.error("FETCH_ERROR", error); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleInputChange = (field: string, value: string) => {
    if (field === "phoneNumber") {
      setForm((prev) => ({ ...prev, [field]: value.replace(/\D/g, "").slice(0, 10) }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // Live Math for Creation — requiredGrams becomes netWeight
  const totals = useMemo(() => {
    const netWeight = Math.max(0, Number(form.requiredGrams) || 0);
    const stoneW = Math.max(0, Number(form.stoneWeight) || 0);
    const rate = Math.max(0, Number(form.liveRate) || 0);
    const vaPer = Math.max(0, Number(form.vaPercentage) || 0);
    const sCost = Math.max(0, Number(form.stoneCost) || 0);
    const disc = Math.max(0, Number(form.discountAmount) || 0);
    const advance = Math.max(0, Number(form.advanceCash) || 0);

    const goldValue = netWeight * rate;
    const vaAmount = goldValue * (vaPer / 100);
    const subtotalBase = goldValue + vaAmount + sCost;
    const subtotalAfterDisc = Math.max(0, subtotalBase - disc);
    const gstAmount = subtotalAfterDisc * 0.03;
    const totalWithGST = subtotalAfterDisc + gstAmount;
    const balanceAmount = totalWithGST - advance;
    const originalCartValue = subtotalBase + subtotalBase * 0.03;

    return {
      netWeight, goldValue, vaAmount, discount: disc,
      gstAmount, totalWithGST, balanceAmount, stoneCost: sCost,
      originalCartValue,
      grossWeight: netWeight + stoneW,
    };
  }, [form]);

  const handleSubmit = async () => {
    if (!form.customerName || form.phoneNumber.length < 10) {
      return alert("Complete Customer Name and provide 10-digit phone number.");
    }
    if (!form.requiredGrams || Number(form.requiredGrams) <= 0) {
      return alert("Enter the grams required to make this item.");
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          metalType,
          netWeight: totals.netWeight,
          discountAmount: totals.discount,
          grossWeight: totals.grossWeight,
          gstAmount: totals.gstAmount,
          originalCartValue: totals.originalCartValue,
          totalAmount: totals.totalWithGST,
          balanceAmount: totals.balanceAmount,
          
        }),
      });

      if (res.ok) {
        setToastMsg("Order Registry Updated!");
        setShowToast(true);
        setIsFormOpen(false);
        setForm({
          customerName: "", phoneNumber: "", itemName: "", itemDescription: "",
          exchangeJewelleryName: "", exchangeJewelleryGrams: "",
          purity: "22", liveRate: "", requiredGrams: "",
          stoneWeight: "", vaPercentage: "", stoneCost: "", discountAmount: "",
          advanceCash: "", deadlineDate: "",
        });
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create order.");
      }
    } catch (err) { console.error("SUBMIT_ERROR", err); }
    finally { setIsSubmitting(false); }
  };

  const handleIssueOrderToClient = async () => {
    if (!viewingOrder) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/issue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: viewingOrder.id }),
      });
      if (res.ok) {
        const data = await res.json();
        const deliveredOrder = { ...viewingOrder, ...data.order, status: "DELIVERED" };

        setToastMsg("Payment Settled & Item Delivered!");
        setShowToast(true);

        await handleOrderReceipt(deliveredOrder, "download", "DELIVERY");

        setViewingOrder(null);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to settle order.");
      }
    } catch (err) { console.error("ISSUE_ERROR", err); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveEdit = async () => {
    if (!viewingOrder) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: viewingOrder.id, ...editForm }),
      });
      if (res.ok) {
        const data = await res.json();
        setViewingOrder(data.order);
        setToastMsg("Order Updated!");
        setShowToast(true);
        setIsEditOpen(false);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update order.");
      }
    } catch (err) { console.error("EDIT_ERROR", err); }
    finally { setIsSubmitting(false); }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <DashboardSidebar />

        <main className="flex-1 flex flex-col h-screen overflow-hidden text-left">
          <header className="bg-white border-b border-gold/10 px-10 py-8 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight">Order Registry</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold font-sans">
                  Active Booking Ledger • Real-time Monitoring
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" size="icon" onClick={fetchOrders} className="h-14 w-14 rounded-2xl border-gold/20 text-gold hover:bg-gold/5 transition-all">
                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
              </Button>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-slate-900 hover:bg-black text-gold gap-3 px-8 h-14 rounded-2xl font-serif font-bold shadow-2xl shadow-slate-200 transition-all active:scale-95"
              >
                <Plus className="w-6 h-6" /> New Booking
              </Button>
            </div>
          </header>

          <div className="flex-1 p-10 overflow-hidden flex flex-col">
            <LuxuryCard className="flex-1 overflow-hidden flex flex-col p-0 border-gold/5 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.02)] rounded-[2.5rem]">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md border-b border-gold/10 text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400">
                    <tr>
                      <th className="px-8 py-6 text-left">Order Reference</th>
                      <th className="px-8 py-6 text-left">Article Details</th>
                      <th className="px-8 py-6 text-left">Financial Core</th>
                      <th className="px-8 py-6 text-left">Current Phase</th>
                      <th className="px-8 py-6 text-right">Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/5">
                    {isLoading ? (
                      <tr><td colSpan={5} className="py-40 text-center"><Loader2 className="animate-spin w-10 h-10 text-gold mx-auto" /><p className="text-slate-400 mt-4 italic font-serif">Synchronizing Ledger...</p></td></tr>
                    ) : orders.length > 0 ? orders.map((o) => (
                      <tr key={o.id} className="group hover:bg-slate-50/50 cursor-pointer transition-all duration-300" onClick={() => setViewingOrder(o)}>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3 mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Hash className="w-4 h-4 text-gold" />
                            <span className="text-sm font-bold font-mono tracking-tighter text-slate-500">{o.orderId}</span>
                          </div>
                          <p className="text-lg font-serif font-bold text-slate-800">{o.customerName}</p>
                          <p className="text-xs text-slate-400 font-medium">Contact: {o.phoneNumber}</p>
                        </td>
                        <td className="px-8 py-6">
                          <span className="inline-block text-[11px] font-bold text-gold uppercase bg-gold/5 px-3 py-1 rounded-lg border border-gold/10 mb-2">
                            {o.itemName}
                          </span>
                          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                            <div className="flex items-center gap-1"><Scale className="w-3 h-3" /> {(Number(o.netWeight) + Number(o.weightAdjustmentGrams || 0)).toFixed(3)}g</div>
                            <div className="flex items-center gap-1"><Gem className="w-3 h-3" /> {o.purity}K {o.metalType}</div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-lg font-serif font-bold text-slate-900">₹{Number(o.totalAmount).toLocaleString()}</p>
                          <p className="text-xs text-slate-400 mt-1">Original: ₹{Number(o.originalCartValue || 0).toLocaleString()}</p>
                          {(o.exchangeJewelleryName || o.exchangeJewelleryGrams) && (
                            <p className="text-xs text-slate-400 mt-1">Exchange: {o.exchangeJewelleryName || "Item"} · {Number(o.exchangeJewelleryGrams || 0)}g</p>
                          )}
                          <div className={cn("flex items-center gap-1.5 text-[11px] font-bold mt-1", o.status === "DELIVERED" ? "text-emerald-500" : "text-rose-500")}>
                            {o.status === "DELIVERED" ? <CheckCircle2 className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                            {o.status === "DELIVERED" ? "Payment Completed" : `Balance: ₹${Number(o.balanceAmount).toLocaleString()}`}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all",
                            o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200"
                          )}>
                            {o.status === "DELIVERED" ? <PackageCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {o.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="h-10 w-10 rounded-full border border-slate-100 flex items-center justify-center ml-auto group-hover:border-gold group-hover:bg-gold/5 transition-all">
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-gold" />
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-40 text-center"><AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" /><p className="text-slate-400 italic">No bookings recorded in the system yet.</p></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </LuxuryCard>
          </div>
        </main>
      </div>

      {/* ================= VIEW & SETTLE DIALOG ================= */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="max-w-5xl rounded-[3rem] p-0 overflow-hidden border-gold/20 shadow-2xl bg-white outline-none">
          <DialogHeader className="p-12 bg-slate-900 text-white flex flex-row justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-20 bg-gold/5 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none" />
            <div className="relative z-10 text-left">
              <div className="flex items-center gap-3 text-gold mb-3">
                <Hash className="w-6 h-6" />
                <span className="text-lg font-mono font-bold tracking-[0.3em] uppercase">{viewingOrder?.orderId}</span>
              </div>
              <DialogTitle className="text-4xl font-serif font-bold italic tracking-tight">Booking Ledger</DialogTitle>
              <p className="text-slate-400 text-xs mt-2 uppercase tracking-[0.1em] font-bold">Client Transaction Record</p>
            </div>

            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase text-slate-300 font-bold tracking-widest text-center">Edit</p>
                <Button
                  onClick={() => setIsEditOpen(true)}
                  variant="outline"
                  disabled={viewingOrder?.status === "DELIVERED"}
                  className="h-14 w-14 border-white/20 text-white hover:bg-white/10 rounded-2xl disabled:opacity-30"
                >
                  <Pencil className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase text-gold font-bold tracking-widest text-center">Booking Slip</p>
                <div className="flex gap-2">
                  <Button onClick={() => handleOrderReceipt(viewingOrder, "print", "BOOKING")} variant="outline" className="h-14 w-14 border-white/20 text-white hover:bg-white/10 rounded-2xl"><Printer className="w-5 h-5" /></Button>
                  <Button onClick={() => handleOrderReceipt(viewingOrder, "download", "BOOKING")} variant="outline" className="h-14 w-14 border-white/20 text-white hover:bg-white/10 rounded-2xl"><Download className="w-5 h-5" /></Button>
                </div>
              </div>
              {viewingOrder?.status === "DELIVERED" && (
                <div className="flex flex-col gap-2 transition-all animate-in fade-in slide-in-from-right-4">
                  <p className="text-[10px] uppercase text-emerald-400 font-bold tracking-widest text-center">Settlement</p>
                  <div className="flex gap-2">
                    <Button onClick={() => handleOrderReceipt(viewingOrder, "print", "DELIVERY")} className="h-14 w-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg"><Printer className="w-5 h-5" /></Button>
                    <Button onClick={() => handleOrderReceipt(viewingOrder, "download", "DELIVERY")} className="h-14 w-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg"><Download className="w-5 h-5" /></Button>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-left bg-white">
            {/* METAL COMPOSITION */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gold/10 pb-4">
                <Scale className="w-5 h-5 text-gold" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Metal Composition</h4>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Required (Booked)</p>
                  <p className="text-2xl font-serif font-bold text-slate-900">{viewingOrder?.netWeight || 0}g</p>
                </div>
                <div className={cn(
                  "p-4 rounded-2xl border",
                  Number(viewingOrder?.weightAdjustmentGrams) >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                )}>
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mb-1",
                    Number(viewingOrder?.weightAdjustmentGrams) >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    Adjustment (+/-)
                  </p>
                  <p className="text-2xl font-serif font-bold text-slate-900">
                    {Number(viewingOrder?.weightAdjustmentGrams || 0) >= 0 ? "+" : ""}{viewingOrder?.weightAdjustmentGrams || 0}g
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Cost impact: ₹{Number(viewingOrder?.adjustmentCost || 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gold/10 rounded-2xl border border-gold/20 border-dashed">
                  <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1">Final Net Weight</p>
                  <p className="text-2xl font-serif font-bold text-slate-900">
                    {(Number(viewingOrder?.netWeight || 0) + Number(viewingOrder?.weightAdjustmentGrams || 0)).toFixed(3)}g
                  </p>
                </div>
              </div>
            </div>

            {/* WEIGHTS BREAKDOWN */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gold/10 pb-4">
                <Gem className="w-5 h-5 text-gold" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Weight Details</h4>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Stone Weight</p>
                  <p className="text-2xl font-serif font-bold text-slate-900">{viewingOrder?.stoneWeight}g</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Gross Weight</p>
                  <p className="text-2xl font-serif font-bold text-slate-900">{viewingOrder?.grossWeight}g</p>
                </div>
              </div>
            </div>

            {/* FINANCIAL BREAKDOWN */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-gold/10 pb-4">
                <IndianRupee className="w-5 h-5 text-gold" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Charges</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Item</p>
                  <p className="text-lg font-serif font-bold text-slate-900">{viewingOrder?.itemName}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-xs text-slate-600 mb-1"><span>Exchange Jewellery</span><span className="font-bold">{viewingOrder?.exchangeJewelleryName || "-"}</span></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>Exchange Grams</span><span className="font-bold">{Number(viewingOrder?.exchangeJewelleryGrams || 0)}g</span></div>
                </div>
                {Number(viewingOrder?.discountAmount) > 0 && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="flex justify-between text-xs text-rose-600 font-bold"><span>Discount</span><span>-₹{Number(viewingOrder?.discountAmount).toLocaleString()}</span></div>
                  </div>
                )}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex justify-between text-xs text-emerald-700 font-bold"><span>Payable</span><span>₹{Number(viewingOrder?.totalAmount).toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {/* PAYMENT STATUS */}
            <div className="space-y-6">
              <div className={cn(
                "p-8 rounded-[2rem] text-white shadow-2xl transition-all duration-700 relative overflow-hidden",
                viewingOrder?.status === "DELIVERED" ? "bg-emerald-900" : "bg-slate-900"
              )}>
                <h4 className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-6 border-b border-white/10 pb-3">Payment Status</h4>
                <div className="space-y-5 relative z-10">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Total Bill</p>
                    <p className="text-3xl font-serif font-bold text-white">₹{Number(viewingOrder?.totalAmount).toLocaleString()}</p>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-[10px] text-slate-300 uppercase font-bold mb-2">Advance Paid</p>
                    <p className="text-2xl font-serif font-bold text-emerald-400">₹{Number(viewingOrder?.advanceCash).toLocaleString()}</p>
                  </div>
                  <GoldDivider className="opacity-20" />
                  <div>
                    <p className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-2">Balance Due</p>
                    <p className="text-4xl font-serif font-bold text-white tracking-tighter">₹{viewingOrder?.status === "DELIVERED" ? "0" : Number(viewingOrder?.balanceAmount).toLocaleString()}</p>
                    {viewingOrder?.status === "DELIVERED" && (
                      <p className="text-xs text-emerald-300 font-bold mt-2 uppercase tracking-widest">✓ Fully Settled</p>
                    )}
                  </div>
                </div>
              </div>

              {/* CUSTOMER PICKUP */}
              {viewingOrder?.status !== "DELIVERED" && (
                <Button
                  onClick={handleIssueOrderToClient}
                  disabled={isSubmitting}
                  className="w-full h-20 rounded-[2rem] font-serif font-bold text-lg flex items-center justify-center gap-3 shadow-2xl transition-all shadow-gold/20 bg-gold text-slate-900 hover:bg-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <><PackageCheck className="w-7 h-7" /> Customer Pickup — Deliver & Bill</>}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= EDIT DIALOG ================= */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] p-8 bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif font-bold">Edit Order — {viewingOrder?.orderId}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input placeholder="Customer Name" value={editForm.customerName || ""} onChange={(e) => handleEditChange("customerName", e.target.value)} />
            <Input placeholder="Phone Number" value={editForm.phoneNumber || ""} onChange={(e) => handleEditChange("phoneNumber", e.target.value)} />
            <Input placeholder="Item Name" value={editForm.itemName || ""} onChange={(e) => handleEditChange("itemName", e.target.value)} />
            <Input placeholder="Live Rate" type="number" value={editForm.liveRate || ""} onChange={(e) => handleEditChange("liveRate", e.target.value)} />
            <Input placeholder="Grams Required (Net Weight)" type="number" step="0.001" value={editForm.netWeight || ""} onChange={(e) => handleEditChange("netWeight", e.target.value)} />
            <Input placeholder="Stone Weight (g)" type="number" value={editForm.stoneWeight || ""} onChange={(e) => handleEditChange("stoneWeight", e.target.value)} />
            <Input placeholder="VA %" type="number" value={editForm.vaPercentage || ""} onChange={(e) => handleEditChange("vaPercentage", e.target.value)} />
            <Input placeholder="Stone Cost (₹)" type="number" value={editForm.stoneCost || ""} onChange={(e) => handleEditChange("stoneCost", e.target.value)} />
            <Input placeholder="Discount / Exchange Value (₹)" type="number" value={editForm.discountAmount || ""} onChange={(e) => handleEditChange("discountAmount", e.target.value)} />
            <Input placeholder="Advance Cash (₹)" type="number" value={editForm.advanceCash || ""} onChange={(e) => handleEditChange("advanceCash", e.target.value)} />
            <Input placeholder="Exchange Jewellery Name" value={editForm.exchangeJewelleryName || ""} onChange={(e) => handleEditChange("exchangeJewelleryName", e.target.value)} />
            <Input placeholder="Exchange Grams" type="number" value={editForm.exchangeJewelleryGrams || ""} onChange={(e) => handleEditChange("exchangeJewelleryGrams", e.target.value)} />

            <Input
              placeholder="Weight Adjustment (+/- g)"
              type="number"
              step="0.001"
              value={editForm.weightAdjustmentGrams ?? 0}
              onChange={(e) => handleEditChange("weightAdjustmentGrams", e.target.value)}
              className="border-amber-200"
            />
            <Input
              placeholder="Adjustment Cost (₹)"
              type="number"
              value={editForm.adjustmentCost ?? 0}
              onChange={(e) => handleEditChange("adjustmentCost", e.target.value)}
              className="border-amber-200"
            />
          </div>
          <Button onClick={handleSaveEdit} disabled={isSubmitting} className="w-full h-14 mt-6 bg-slate-900 text-gold rounded-2xl font-bold">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ================= NEW BOOKING DIALOG ================= */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto rounded-[3rem] p-0 border-gold/20 shadow-2xl bg-white text-left outline-none">
          <DialogHeader className="p-12 bg-slate-900 text-white sticky top-0 z-20 flex flex-row justify-between items-center border-b border-white/5">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20 shadow-lg"><ShoppingBag className="h-8 w-8 text-gold" /></div>
              <div><DialogTitle className="text-4xl font-serif font-bold text-gold tracking-tight italic">Jewelry Custom Booking</DialogTitle><p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold mt-1">Standard Operating Procedure</p></div>
            </div>
            <Button variant="ghost" onClick={() => setIsFormOpen(false)} className="h-12 w-12 rounded-2xl text-white/30 hover:text-white transition-all"><X className="w-8 h-8" /></Button>
          </DialogHeader>

          <div className="p-12 grid grid-cols-1 lg:grid-cols-3 gap-12 bg-white">
            <div className="space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><User className="w-5 h-5 text-gold" /><h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Client Profile</h3></div>
                <div className="space-y-5">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Full Name</label><Input placeholder="Legal name for invoice" value={form.customerName} onChange={(e) => handleInputChange("customerName", e.target.value)} className="h-12 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Mobile</label><Input placeholder="10 Digits" type="tel" value={form.phoneNumber} onChange={(e) => handleInputChange("phoneNumber", e.target.value)} className="h-12 rounded-xl" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Article</label><Input placeholder="Item Name" value={form.itemName} onChange={(e) => handleInputChange("itemName", e.target.value)} className="h-12 rounded-xl" /></div>
                  <textarea className="w-full min-h-[120px] border border-slate-200 rounded-2xl p-4 text-sm outline-none" placeholder="Requirements..." value={form.itemDescription} onChange={(e) => handleInputChange("itemDescription", e.target.value)} />
                </div>
              </section>
              <section className="space-y-6 pt-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><Coins className="w-5 h-5 text-gold" /><h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Metal Specs</h3></div>
                <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-2 shadow-inner">
                  {["GOLD", "SILVER"].map((m) => (<button key={m} onClick={() => { setMetalType(m as any); handleInputChange("purity", m === "GOLD" ? "22" : "92.5"); }} className={cn("flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", metalType === m ? "bg-white text-slate-900 shadow-xl" : "text-slate-400")}>{m}</button>))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select value={form.purity} onChange={(e) => handleInputChange("purity", e.target.value)} className="h-14 border border-slate-200 rounded-xl px-4 text-sm bg-white font-bold">{metalType === "GOLD" ? (<><option value="24">24K</option><option value="22">22K</option><option value="18">18K</option></>) : (<><option value="99">99%</option><option value="92.5">92.5%</option><option value="90">90%</option></>)}</select>
                  <Input type="number" min="0" value={form.liveRate} onChange={(e) => handleInputChange("liveRate", e.target.value)} placeholder="Live Rate" className="h-14 font-bold" />
                </div>
              </section>
            </div>

            <div className="space-y-10">
              <section className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-gold/10 space-y-8">
                <div className="flex items-center gap-3 border-b border-gold/5 pb-3"><Scale className="w-5 h-5 text-slate-400" /><h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Weight Requirement</h3></div>
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Grams Required to Make</label>
                    <Input
                      placeholder="Enter grams needed for this item"
                      type="number"
                      min="0"
                      step="0.001"
                      value={form.requiredGrams}
                      onChange={(e) => handleInputChange("requiredGrams", e.target.value)}
                      className="h-12 bg-white"
                    />
                    <p className="text-[10px] text-slate-400 ml-2">This becomes the order's Net Weight — editable later if the crafted weight differs.</p>
                  </div>
                  <Input placeholder="Stone Weight" type="number" min="0" value={form.stoneWeight} onChange={(e) => handleInputChange("stoneWeight", e.target.value)} className="h-12 bg-white" />
                  <div className="p-8 bg-white border border-gold/20 rounded-3xl flex justify-between items-center shadow-xl border-dashed">
                    <span className="text-[11px] font-bold text-gold uppercase tracking-widest">Required Weight</span>
                    <span className="text-3xl font-serif font-bold text-slate-900">{totals.netWeight.toFixed(3)}g</span>
                  </div>
                </div>
              </section>
              <section className="space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><Tag className="w-5 h-5 text-gold" /><h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Commercials</h3></div>
                <div className="grid grid-cols-2 gap-5">
                  <Input type="number" min="0" value={form.vaPercentage} onChange={(e) => handleInputChange("vaPercentage", e.target.value)} placeholder="VA %" className="h-12" />
                  <Input type="number" min="0" value={form.stoneCost} onChange={(e) => handleInputChange("stoneCost", e.target.value)} placeholder="Stone ₹" className="h-12" />
                </div>
                <div className="relative"><div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-rose-50 rounded-lg"><Tag className="w-4 h-4 text-rose-500" /></div><Input placeholder="Jewellery Exchange value (₹)" type="number" min="0" className="h-14 pl-14 border-rose-100 font-bold text-rose-600" value={form.discountAmount} onChange={(e) => handleInputChange("discountAmount", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-5">
                  <Input placeholder="Exchange Jewellery Name" value={form.exchangeJewelleryName} onChange={(e) => handleInputChange("exchangeJewelleryName", e.target.value)} className="h-12" />
                  <Input placeholder="Exchange Grams" type="number" min="0" value={form.exchangeJewelleryGrams} onChange={(e) => handleInputChange("exchangeJewelleryGrams", e.target.value)} className="h-12" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <Input type="date" value={form.deadlineDate} onChange={(e) => handleInputChange("deadlineDate", e.target.value)} className="h-12" />
                  <Input placeholder="Advance Cash" type="number" min="0" value={form.advanceCash} onChange={(e) => handleInputChange("advanceCash", e.target.value)} className="h-12 border-emerald-100 text-emerald-600 font-bold" />
                </div>
              </section>
            </div>

            <div className="space-y-10">
              <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl ring-4 ring-gold/10">
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Article</span><span className="text-gold font-bold font-serif text-lg">{form.itemName || "Draft"}</span></div>
                  <div className="space-y-4 pt-4">
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Metal Value</span><span>₹{totals.goldValue.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">VA + Gem</span><span className="text-gold">+ ₹{(totals.vaAmount + totals.stoneCost).toLocaleString()}</span></div>
                    {totals.discount > 0 && <div className="flex justify-between text-sm font-bold text-rose-400 bg-rose-400/5 p-2 rounded-lg border border-rose-400/20"><span>Exchange value</span><span>- ₹{totals.discount.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-sm"><span className="text-slate-400 italic">GST (3%)</span><span className="text-slate-300">+ ₹{Math.round(totals.gstAmount).toLocaleString()}</span></div>
                  </div>
                  <GoldDivider className="opacity-20 my-8" />
                  <div className="py-2 text-center"><p className="text-[11px] text-gold font-bold uppercase tracking-[0.3em] mb-3">Projected Total</p><h2 className="text-6xl font-serif font-bold text-white tracking-tighter">₹{Math.round(totals.totalWithGST).toLocaleString()}</h2></div>
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 flex justify-between items-center mt-10 shadow-2xl backdrop-blur-sm">
                    <div className="text-left"><p className="text-[11px] text-rose-400 font-bold uppercase tracking-widest">Contract</p><p className="text-xs text-slate-400">Balance Owed</p></div>
                    <p className="text-3xl font-serif font-bold text-white">₹{Math.round(totals.balanceAmount).toLocaleString()}</p>
                  </div>
                </div>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-20 bg-gold hover:bg-white text-slate-900 rounded-[2rem] font-serif font-bold text-xl mt-12 shadow-2xl transition-all flex items-center justify-center gap-4 group">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <>Authorize Booking <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" /></>}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast isVisible={showToast} message={toastMsg} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
}