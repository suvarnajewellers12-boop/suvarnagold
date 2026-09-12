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
  Loader2, RefreshCw, Printer, Download, Hash, Tag, PackageCheck, AlertCircle, Pencil, Receipt,
  Search, CalendarDays, RotateCcw, TrendingUp, ListFilter,
  Banknote, CreditCard, Smartphone, Landmark, CircleDollarSign
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE = "https://suvarnagold-16e5.vercel.app/api/gold/order";

const getOrderDate = (order: any) => {
  const raw = order?.createdAt || order?.bookingDate || order?.orderDate || order?.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type PaymentMode = "CASH" | "UPI" | "CARD" | "CHECK";

const getPaidAmount = (order: any) => Number(order?.advanceCash) || 0;

const getOrderPayments = (order: any) => {
  if (Array.isArray(order?.payments)) return order.payments;
  if (Array.isArray(order?.paymentHistory)) return order.paymentHistory;
  if (Array.isArray(order?.transactions)) return order.transactions;
  return [];
};

const getPaymentsTotal = (order: any) =>
  getOrderPayments(order).reduce(
    (sum: number, payment: any) => sum + (Number(payment?.amount) || 0),
    0
  );

const getLegacyUntrackedAdvance = (order: any) => {
  const remainder = Math.max(0, getPaidAmount(order) - getPaymentsTotal(order));
  const mode = String(order?.advancePaymentMode || "").toUpperCase();
  return ["CASH", "UPI", "CARD", "CHECK"].includes(mode) ? 0 : remainder;
};

const getPaymentModeTotals = (orders: any[]) => {
  const totals = { CASH: 0, UPI: 0, CARD: 0, CHECK: 0, tracked: 0, untracked: 0 };

  orders.forEach((order) => {
    const payments = getOrderPayments(order);

    payments.forEach((payment: any) => {
      const amount = Math.max(0, Number(payment?.amount) || 0);
      const mode = String(payment?.mode || payment?.paymentMode || "").toUpperCase() as PaymentMode;

      if (mode === "CASH" || mode === "UPI" || mode === "CARD" || mode === "CHECK") {
        totals[mode] += amount;
        totals.tracked += amount;
      }
    });

    const remainingAdvance = Math.max(0, getPaidAmount(order) - getPaymentsTotal(order));
    if (remainingAdvance > 0) {
      const advanceMode = String(order?.advancePaymentMode || "").toUpperCase() as PaymentMode;
      if (advanceMode === "CASH" || advanceMode === "UPI" || advanceMode === "CARD" || advanceMode === "CHECK") {
        totals[advanceMode] += remainingAdvance;
        totals.tracked += remainingAdvance;
      } else {
        totals.untracked += remainingAdvance;
      }
    }
  });

  return totals;
};

const paymentModeLabel = (mode?: string) => {
  if (!mode) return "Payment";
  if (mode === "CHECK") return "Check";
  return mode.charAt(0) + mode.slice(1).toLowerCase();
};

// ---------------------------------------------------------------------------
// CANONICAL ORDER FINANCIALS
// originalCartValue is the source of truth for the original bill.
// Exchange and +/- adjustment must NEVER mutate that original value.
// ---------------------------------------------------------------------------
const roundMoneyValue = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const calculateOriginalCartValue = (order: any) => {
  const stored = Number(order?.originalCartValue);
  if (Number.isFinite(stored) && stored > 0) return roundMoneyValue(stored);

  // Fallback only for legacy rows that do not have originalCartValue.
  const bookedWeight = Math.max(0, Number(order?.netWeight) || 0);
  const rate = Math.max(0, Number(order?.liveRate) || 0);
  const vaPercent = Math.max(0, Number(order?.vaPercentage) || 0);
  const stoneCost = Math.max(0, Number(order?.stoneCost) || 0);

  const metalCost = roundMoneyValue(bookedWeight * rate);
  const vaAmount = roundMoneyValue(metalCost * (vaPercent / 100));
  const gstBase = roundMoneyValue(metalCost + vaAmount + stoneCost);
  const gst = roundMoneyValue(gstBase * 0.03);

  return roundMoneyValue(gstBase + gst);
};

const getExchangeValue = (order: any) =>
  Math.max(0, Number(order?.discountAmount) || 0);

const getBasePayableAfterExchange = (order: any) =>
  roundMoneyValue(
    Math.max(0, calculateOriginalCartValue(order) - getExchangeValue(order))
  );

// The adjustment changes the FINAL payment only.
//
// Example:
// Balance before adjustment = ₹88,199
// adjustmentCost = -₹710
// Final payment = ₹87,489
//
// The ₹710 is shown only once as part of the final-payment formula.
const getOriginalPaymentRows = (order: any) =>
  getOrderPayments(order).map((payment: any) => ({
    ...payment,
    amount: Math.max(0, Number(payment?.amount) || 0),
  }));

const getMoneyPaidBeforeFinalPayment = (order: any) => {
  const payments = getOriginalPaymentRows(order);

  if (payments.length <= 1) return 0;

  return roundMoneyValue(
    payments
      .slice(0, -1)
      .reduce(
        (sum: number, payment: any) =>
          sum + Math.max(0, Number(payment?.amount) || 0),
        0
      )
  );
};

const getPreAdjustmentBalanceForFinalPayment = (order: any) =>
  roundMoneyValue(
    Math.max(
      0,
      calculateOriginalCartValue(order) -
        getExchangeValue(order) -
        getMoneyPaidBeforeFinalPayment(order)
    )
  );

const getFinalPaymentAmount = (order: any) => {
  const preAdjustmentBalance = getPreAdjustmentBalanceForFinalPayment(order);
  const adjustmentCost = Number(order?.adjustmentCost) || 0;

  return roundMoneyValue(
    Math.max(0, preAdjustmentBalance + adjustmentCost)
  );
};

const getAdjustedPaymentRows = (order: any) => {
  const payments = getOriginalPaymentRows(order);

  if (!payments.length) return payments;

  const lastIndex = payments.length - 1;
  const adjustmentCost = Number(order?.adjustmentCost) || 0;

  payments[lastIndex] = {
    ...payments[lastIndex],
    originalAmount: Number(payments[lastIndex].amount || 0),
    amount: getFinalPaymentAmount(order),
    appliedAdjustment: adjustmentCost,
  };

  return payments;
};

const getActualCashPaid = (order: any) =>
  roundMoneyValue(
    getAdjustedPaymentRows(order).reduce((sum: number, payment: any) => {
      const mode = String(payment?.mode || payment?.paymentMode || "").toUpperCase();
      return mode === "CASH"
        ? sum + Math.max(0, Number(payment?.amount) || 0)
        : sum;
    }, 0)
  );

const getActualMoneyPaid = (order: any) =>
  roundMoneyValue(
    getAdjustedPaymentRows(order).reduce(
      (sum: number, payment: any) =>
        sum + Math.max(0, Number(payment?.amount) || 0),
      0
    )
  );

const getTotalPaymentCleared = (order: any) =>
  roundMoneyValue(
    getActualMoneyPaid(order) +
    Math.max(0, getExchangeValue(order))
  );

const getAdjustedSettlementTarget = (order: any) =>
  roundMoneyValue(
    getTotalPaymentCleared(order)
  );

// Final balance is zero once the final adjusted payment + exchange is accounted for.
const getFinalBalanceDue = (order: any) => {
  if (order?.status === "DELIVERED") return 0;

  return roundMoneyValue(
    Math.max(
      0,
      calculateOriginalCartValue(order) - getTotalPaymentCleared(order)
    )
  );
};

const parseDateInput = (value: string, endOfDay = false) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
};

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
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("Order Saved Successfully!");
  const [metalType, setMetalType] = useState<"GOLD" | "SILVER">("GOLD");
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  // Registry filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DELIVERED">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
    advancePaymentMode: "CASH" as PaymentMode,
    advanceReferenceNumber: "",
    advanceBankName: "",
    advanceCheckNumber: "",
    deadlineDate: "",
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({});

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [paymentReferenceNumber, setPaymentReferenceNumber] = useState("");
  const [paymentBankName, setPaymentBankName] = useState("");
  const [paymentCheckNumber, setPaymentCheckNumber] = useState("");

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
      const rose = rgb(0.7, 0.1, 0.1);

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

      // ── CALCULATIONS ──
      const bookedWt = Number(order.netWeight) || 0;
      const weightAdj = Number(order.weightAdjustmentGrams) || 0;
      const adjustmentCost = Number(order.adjustmentCost) || 0;
      const netWt = bookedWt + weightAdj;

      const grossWt = Number(order.grossWeight) || netWt + (Number(order.stoneWeight) || 0);
      const stoneWt = Number(order.stoneWeight) || 0;
      const rate = Number(order.liveRate) || 0;
      const vaPer = Number(order.vaPercentage) || 0;
      const stoneC = Number(order.stoneCost) || 0;
      const discAmt = Number(order.discountAmount) || 0;
      const originalCartValue = calculateOriginalCartValue(order);

      // Component breakdown is informational only.
      // Original Cart Value remains the stored/source-of-truth amount.
      const goldValue = bookedWt * rate;
      const vaAmount = goldValue * (vaPer / 100);
      const gstTaxableBase = Math.max(0, goldValue + vaAmount + stoneC);
      const gstAmount = Number(order.gst ?? order.gstAmount) || (gstTaxableBase * 0.03);

      // Exchange changes payable only; it never changes Original Cart Value or GST.
      const basePayable = getBasePayableAfterExchange(order);

      // Receipt uses adjusted payment rows.
      // The +/- adjustment is applied to the LAST payment amount.
      const originalPayments: any[] = getOrderPayments(order);
      const payments: any[] = getAdjustedPaymentRows(order);
      const recordedPaymentsTotal = payments.reduce(
        (sum, p) => sum + Math.max(0, Number(p.amount || 0)),
        0
      );

      const totalPaid = recordedPaymentsTotal;
      const balance = getFinalBalanceDue(order);

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
      let cursorY = ROW_Y + 22;
      draw("CART SUMMARY", MARGIN_L, cursorY, 7.5, grey);
      hLine(cursorY + 8);

      const cartRow = (label: string, value: string, y: number, valueColor = black) => {
        draw(label, MARGIN_L, y, 6.5, grey);
        drawR(value, MARGIN_R, y, 6.5, valueColor);
      };

      const storedOriginalCartValue = originalCartValue;
      let offset = 14;
      cartRow("Original Cart Value", `₹${Math.round(storedOriginalCartValue).toLocaleString()}`, cursorY + offset, gold);
      offset += 7;

      cartRow(
        `Exchange Value [${order.exchangeJewelleryName || "N/A"}]`,
        `₹${Math.round(discAmt || 0).toLocaleString()}`,
        cursorY + offset,
        gold
      );
      offset += 7;

      cartRow("GST Taxable Base (Before Exchange)", `₹${Math.round(gstTaxableBase).toLocaleString()}`, cursorY + offset);
      offset += 7;
      cartRow("GST (3%)", `₹${Math.round(gstAmount).toLocaleString()}`, cursorY + offset);
      offset += 7;
      cartRow("Base Payable (Before Adjustment)", `₹${Math.round(basePayable).toLocaleString()}`, cursorY + offset, emerald);
      hLine(cursorY + offset + 6);
      cursorY = cursorY + offset + 6;

      // ── WEIGHT DETAILS ──
      const finRow = (label: string, value: string, y: number, color = black) => {
        draw(label, MARGIN_L, y, 6.5, grey);
        drawR(value, MARGIN_R, y, 6.5, color);
      };

      cursorY += 10;
      draw("WEIGHT DETAILS", MARGIN_L, cursorY, 7.5, grey);
      hLine(cursorY + 8);
      finRow(`Required (Booked / Pricing Weight)`, `${bookedWt}g`, cursorY + 14);
      finRow(`Weight Adjustment (Balance Only)`, `${weightAdj > 0 ? "+" : ""}${weightAdj}g`, cursorY + 21);
      finRow(`Final Physical Net Weight`, `${netWt}g`, cursorY + 28);
      hLine(cursorY + 34);
      cursorY += 34;

      // ── PAYMENT HISTORY (dated, per-payment + advance) ──
      cursorY += 10;
      draw("PAYMENT HISTORY", MARGIN_L, cursorY, 7.5, grey);
      hLine(cursorY + 8);
      cursorY += 8;

      let payLineY = cursorY + 6;

      if (payments.length > 0) {
        payments.forEach((p: any, paymentIndex: number) => {
          const dateStr = p.paidAt ? format(new Date(p.paidAt), "dd MMM yy") : "Payment";
          const mode = paymentModeLabel(p.mode || p.paymentMode);
          const ref = p.checkNumber || p.referenceNumber;

          const isLastPayment = paymentIndex === payments.length - 1;

          const label = isLastPayment
            ? `${mode} • ${dateStr} • Final Payment`
            : `${mode} • ${dateStr}${ref ? ` • ${ref}` : ""}`;

          finRow(
            label,
            `₹${Math.round(Number(p.amount)).toLocaleString()}`,
            payLineY,
            isLastPayment ? gold : black
          );

          payLineY += 7;
        });
      }

      const actualCashPaid = getActualCashPaid(order);
      const actualMoneyPaid = getActualMoneyPaid(order);
      const balanceBeforeAdjustment = getPreAdjustmentBalanceForFinalPayment(order);
      const finalPaymentAmount = getFinalPaymentAmount(order);

      finRow(
        `Balance Due Before Adjustment`,
        `₹${Math.round(balanceBeforeAdjustment).toLocaleString()}`,
        payLineY,
        black
      );
      payLineY += 7;

      if (adjustmentCost !== 0) {
        finRow(
          `Final Payment`,
          `₹${Math.round(balanceBeforeAdjustment).toLocaleString()} ${adjustmentCost > 0 ? "+" : "-"} ₹${Math.round(Math.abs(adjustmentCost)).toLocaleString()} = ₹${Math.round(finalPaymentAmount).toLocaleString()}`,
          payLineY,
          gold
        );
        payLineY += 7;
      } else {
        finRow(
          `Final Payment`,
          `₹${Math.round(finalPaymentAmount).toLocaleString()}`,
          payLineY,
          gold
        );
        payLineY += 7;
      }

      finRow(
        `Total Cash Paid`,
        `₹${Math.round(actualCashPaid).toLocaleString()}`,
        payLineY,
        emerald
      );
      payLineY += 7;

      if (discAmt > 0) {
        finRow(
          `Jewellery Exchange Cleared`,
          `₹${Math.round(discAmt).toLocaleString()}`,
          payLineY,
          emerald
        );
        payLineY += 7;
      }

      const totalPaymentCleared = getTotalPaymentCleared(order);
      finRow(
        `Total Payment`,
        `₹${Math.round(totalPaymentCleared).toLocaleString()}`,
        payLineY,
        emerald
      );
      payLineY += 7;

      if (balance <= 0) {
        finRow(`Final Balance Due`, `₹ 0 — FULLY PAID`, payLineY, emerald);
      } else {
        finRow(`Final Balance Due`, `₹${Math.round(balance).toLocaleString()}`, payLineY, rose);
      }
      hLine(payLineY + 6);
      cursorY = payLineY + 6;

      // ── SETTLEMENT BOX ──
      const settBoxW = 160;
      const settBoxH = 45;
      const settBoxX = MARGIN_R - settBoxW;
      const SETT_TOP_Y = cursorY + 10;
      const settBoxBottomY = A5_H - SETT_TOP_Y - settBoxH;

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

      if (balance <= 0) {
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

  const totals = useMemo(() => {
    const netWeight = Math.max(0, Number(form.requiredGrams) || 0);
    const stoneW = Math.max(0, Number(form.stoneWeight) || 0);
    const rate = Math.max(0, Number(form.liveRate) || 0);
    const vaPer = Math.max(0, Number(form.vaPercentage) || 0);
    const sCost = Math.max(0, Number(form.stoneCost) || 0);
    const disc = Math.max(0, Number(form.discountAmount) || 0);
    const advance = Math.max(0, Number(form.advanceCash) || 0);

    const roundMoney = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    const goldValue = roundMoney(netWeight * rate);
    const vaAmount = roundMoney(goldValue * (vaPer / 100));
    const subtotalBase = roundMoney(goldValue + vaAmount + sCost);

    // GST is locked to Metal + VA + Stone Cost.
    // Jewellery exchange is deducted only after GST.
    const gstAmount = roundMoney(subtotalBase * 0.03);
    const originalCartValue = roundMoney(subtotalBase + gstAmount);
    const totalWithGST = roundMoney(Math.max(0, originalCartValue - disc));

    // If the operator enters the whole-rupee value shown on screen
    // (example: 20001 for an exact total of 20000.62), treat it as full payment.
    const normalizedAdvance =
      advance > totalWithGST &&
      Math.abs(advance - Math.round(totalWithGST)) < 0.01
        ? totalWithGST
        : advance;

    const balanceAmount = roundMoney(Math.max(0, totalWithGST - normalizedAdvance));

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

    const enteredAdvance = Math.max(0, Number(form.advanceCash) || 0);
    const normalizedAdvance =
      enteredAdvance > totals.totalWithGST &&
      Math.abs(enteredAdvance - Math.round(totals.totalWithGST)) < 0.01
        ? totals.totalWithGST
        : enteredAdvance;

    if (normalizedAdvance > totals.totalWithGST + 0.01) {
      return alert(
        `Initial payment cannot be greater than the payable amount ₹${totals.totalWithGST.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`
      );
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
          advanceCash: normalizedAdvance,
          balanceAmount: Math.max(0, totals.totalWithGST - normalizedAdvance),
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
          advanceCash: "", advancePaymentMode: "CASH", advanceReferenceNumber: "",
          advanceBankName: "", advanceCheckNumber: "", deadlineDate: "",
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

    // Send ONLY fields that actually changed.
    // This is critical: adjustment-only edits must not resend pricing fields and
    // accidentally trigger a recalculation of Original Cart Value / VA / GST.
    const editableKeys = [
      "customerName",
      "phoneNumber",
      "itemName",
      "itemDescription",
      "liveRate",
      "netWeight",
      "stoneWeight",
      "vaPercentage",
      "stoneCost",
      "discountAmount",
      "exchangeJewelleryName",
      "exchangeJewelleryGrams",
      "weightAdjustmentGrams",
      "adjustmentCost",
      "deadlineDate",
    ] as const;

    const numericKeys = new Set([
      "liveRate",
      "netWeight",
      "stoneWeight",
      "vaPercentage",
      "stoneCost",
      "discountAmount",
      "exchangeJewelleryGrams",
      "weightAdjustmentGrams",
      "adjustmentCost",
    ]);

    const changedFields: Record<string, any> = {};

    editableKeys.forEach((key) => {
      const nextValue = editForm[key];
      const currentValue = viewingOrder[key];

      if (numericKeys.has(key)) {
        const nextNumber = Number(nextValue ?? 0);
        const currentNumber = Number(currentValue ?? 0);

        if (Math.abs(nextNumber - currentNumber) > 0.000001) {
          changedFields[key] = nextValue === "" ? 0 : nextValue;
        }
        return;
      }

      const nextText = String(nextValue ?? "");
      const currentText = String(currentValue ?? "");

      if (nextText !== currentText) {
        changedFields[key] = nextValue;
      }
    });

    if (Object.keys(changedFields).length === 0) {
      setIsEditOpen(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: viewingOrder.id,
          ...changedFields,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setViewingOrder(data.order);
        setToastMsg("Order Updated!");
        setShowToast(true);
        setIsEditOpen(false);
        await fetchOrders();
      } else {
        alert(data.error || "Failed to update order.");
      }
    } catch (err) {
      console.error("EDIT_ERROR", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!viewingOrder) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) return alert("Enter a valid payment amount.");

    const currentBalance = getFinalBalanceDue(viewingOrder);
    if (amt > currentBalance + 0.01) {
      return alert(`Payment cannot be greater than the current balance ₹${currentBalance.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: viewingOrder.id,
          amount: amt,
          note: paymentNote,
          mode: paymentMode,
          referenceNumber: paymentMode === "UPI" || paymentMode === "CARD" ? paymentReferenceNumber.trim() || null : null,
          bankName: paymentMode === "CHECK" ? paymentBankName.trim() || null : null,
          checkNumber: paymentMode === "CHECK" ? paymentCheckNumber.trim() || null : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setViewingOrder(data.order);
        setToastMsg(`Payment of ₹${amt.toLocaleString()} recorded`);
        setShowToast(true);
        setIsPaymentOpen(false);
        setPaymentAmount("");
        setPaymentNote("");
        setPaymentMode("CASH");
        setPaymentReferenceNumber("");
        setPaymentBankName("");
        setPaymentCheckNumber("");
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to record payment.");
      }
    } catch (err) { console.error("PAYMENT_ERROR", err); }
    finally { setIsSubmitting(false); }
  };

  // ---------------------------------------------------------------------------
  // SEARCH, DATE FILTERS & DASHBOARD SUMMARY
  // ---------------------------------------------------------------------------
  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const start = parseDateInput(fromDate);
    const end = parseDateInput(toDate, true);

    return orders.filter((order) => {
      const searchableText = [
        order.orderId,
        order.customerName,
        order.phoneNumber,
        order.itemName,
        order.metalType,
        order.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? order.status !== "DELIVERED" : order.status === "DELIVERED");

      let matchesDate = true;
      if (start || end) {
        const orderDate = getOrderDate(order);
        if (!orderDate) {
          matchesDate = false;
        } else {
          if (start && orderDate < start) matchesDate = false;
          if (end && orderDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [orders, searchTerm, statusFilter, fromDate, toDate]);

  const registrySummary = useMemo(() => {
    return filteredOrders.reduce(
      (summary, order) => {
        summary.orderValue += calculateOriginalCartValue(order);
        summary.received += getPaidAmount(order);
        summary.pending += getFinalBalanceDue(order);
        summary.count += 1;
        return summary;
      },
      { orderValue: 0, received: 0, pending: 0, count: 0 }
    );
  }, [filteredOrders]);

  const paymentModeSummary = useMemo(() => getPaymentModeTotals(filteredOrders), [filteredOrders]);

  const viewingOrderPaymentModes = useMemo(
    () => getPaymentModeTotals(viewingOrder ? [viewingOrder] : []),
    [viewingOrder]
  );

  const clearRegistryFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  // ---------------------------------------------------------------------------
  // FULL CUSTOMER / FILTERED REGISTRY PDF EXPORT
  // ---------------------------------------------------------------------------
  const handleExportRegistryPdf = async (ordersToExport: any[] = filteredOrders) => {
    if (!ordersToExport.length) {
      alert("No orders available to export.");
      return;
    }

    try {
      const fontBytes = await fetch("/fonts/NotoSans-VariableFont_wdth,wght.ttf").then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const exportPaymentModes = getPaymentModeTotals(ordersToExport);

      const A4_W = 595.28;
      const A4_H = 841.89;
      const MARGIN = 42;
      const CONTENT_W = A4_W - MARGIN * 2;
      const gold = rgb(0.72, 0.52, 0.04);
      const black = rgb(0.08, 0.08, 0.08);
      const grey = rgb(0.42, 0.42, 0.42);
      const lightGrey = rgb(0.88, 0.88, 0.88);
      const emerald = rgb(0.06, 0.47, 0.23);
      const rose = rgb(0.72, 0.12, 0.12);
      const softGold = rgb(0.98, 0.96, 0.90);

      let page = pdfDoc.addPage([A4_W, A4_H]);
      let cursorY = A4_H - MARGIN;

      const textWidth = (value: string, size: number) => customFont.widthOfTextAtSize(String(value ?? ""), size);

      const splitText = (value: any, maxWidth: number, size = 9) => {
        const raw = String(value ?? "-").trim() || "-";
        const paragraphs = raw.split(/\r?\n/);
        const lines: string[] = [];

        paragraphs.forEach((paragraph) => {
          const words = paragraph.split(/\s+/).filter(Boolean);
          if (!words.length) {
            lines.push("");
            return;
          }
          let line = words[0];
          for (let i = 1; i < words.length; i++) {
            const test = `${line} ${words[i]}`;
            if (textWidth(test, size) <= maxWidth) line = test;
            else {
              lines.push(line);
              line = words[i];
            }
          }
          lines.push(line);
        });
        return lines;
      };

      const newPage = () => {
        page = pdfDoc.addPage([A4_W, A4_H]);
        cursorY = A4_H - MARGIN;
      };

      const ensureSpace = (needed = 40) => {
        if (cursorY - needed < MARGIN) newPage();
      };

      const drawText = (value: any, x: number, y: number, size = 9, color = black) => {
        page.drawText(String(value ?? "-"), { x, y, size, font: customFont, color });
      };

      const drawRight = (value: any, rightX: number, y: number, size = 9, color = black) => {
        const text = String(value ?? "-");
        drawText(text, rightX - textWidth(text, size), y, size, color);
      };

      const line = (y: number, color = lightGrey, thickness = 0.6) => {
        page.drawLine({ start: { x: MARGIN, y }, end: { x: A4_W - MARGIN, y }, thickness, color });
      };

      const drawWrapped = (value: any, x: number, maxWidth: number, size = 9, color = black, lineHeight = 13) => {
        const lines = splitText(value, maxWidth, size);
        lines.forEach((txt) => {
          ensureSpace(lineHeight + 4);
          drawText(txt || " ", x, cursorY, size, color);
          cursorY -= lineHeight;
        });
        return lines.length;
      };

      const fieldRow = (label: string, value: any, options?: { color?: any; bold?: boolean }) => {
        const labelW = 150;
        const valueX = MARGIN + labelW;
        const maxValueW = CONTENT_W - labelW;
        const lines = splitText(value, maxValueW, 9);
        const rowH = Math.max(18, lines.length * 13 + 3);
        ensureSpace(rowH + 4);
        drawText(label, MARGIN, cursorY, 8, grey);
        lines.forEach((txt, i) => drawText(txt || "-", valueX, cursorY - i * 13, 9, options?.color || black));
        cursorY -= rowH;
      };

      const sectionTitle = (title: string) => {
        ensureSpace(28);
        cursorY -= 4;
        drawText(title.toUpperCase(), MARGIN, cursorY, 8.5, gold);
        cursorY -= 9;
        line(cursorY, gold, 0.8);
        cursorY -= 15;
      };

      // ---------------- REPORT HEADER ----------------
      drawText("ORDER REGISTRY — CUSTOMER FULL DETAILS", MARGIN, cursorY, 16, black);
      drawRight(`Generated: ${format(new Date(), "dd MMM yyyy, h:mm a")}`, A4_W - MARGIN, cursorY + 1, 8, grey);
      cursorY -= 24;
      line(cursorY, gold, 1.2);
      cursorY -= 20;

      const filterText = [
        searchTerm ? `Search: ${searchTerm}` : null,
        statusFilter !== "ALL" ? `Status: ${statusFilter}` : null,
        fromDate ? `From: ${fromDate}` : null,
        toDate ? `To: ${toDate}` : null,
      ].filter(Boolean).join("  •  ") || "All current orders";

      drawWrapped(filterText, MARGIN, CONTENT_W, 8.5, grey, 12);
      cursorY -= 4;

      page.drawRectangle({
        x: MARGIN,
        y: cursorY - 88,
        width: CONTENT_W,
        height: 88,
        color: softGold,
        borderColor: gold,
        borderWidth: 0.7,
      });
      drawText(`Orders: ${ordersToExport.length}`, MARGIN + 14, cursorY - 18, 9, black);
      drawText(`Order Value: ₹${Math.round(ordersToExport.reduce((s, o) => s + calculateOriginalCartValue(o), 0)).toLocaleString()}`, MARGIN + 14, cursorY - 36, 9, black);
      drawText(`Received: ₹${Math.round(ordersToExport.reduce((s, o) => s + getPaidAmount(o), 0)).toLocaleString()}`, MARGIN + 190, cursorY - 18, 9, emerald);
      drawText(`Pending: ₹${Math.round(ordersToExport.reduce((s, o) => s + getFinalBalanceDue(o), 0)).toLocaleString()}`, MARGIN + 190, cursorY - 36, 9, rose);
      drawText(`Cash: ₹${Math.round(exportPaymentModes.CASH).toLocaleString()}`, MARGIN + 14, cursorY - 60, 8.5, black);
      drawText(`UPI: ₹${Math.round(exportPaymentModes.UPI).toLocaleString()}`, MARGIN + 132, cursorY - 60, 8.5, black);
      drawText(`Card: ₹${Math.round(exportPaymentModes.CARD).toLocaleString()}`, MARGIN + 245, cursorY - 60, 8.5, black);
      drawText(`Check: ₹${Math.round(exportPaymentModes.CHECK).toLocaleString()}`, MARGIN + 365, cursorY - 60, 8.5, black);
      if (exportPaymentModes.untracked > 0) {
        drawText(`Legacy / unclassified: ₹${Math.round(exportPaymentModes.untracked).toLocaleString()}`, MARGIN + 14, cursorY - 77, 7.5, grey);
      }
      cursorY -= 108;

      // ---------------- ORDER DETAILS ----------------
      ordersToExport.forEach((order, index) => {
        if (index > 0) {
          ensureSpace(90);
          cursorY -= 8;
          line(cursorY, lightGrey, 1);
          cursorY -= 24;
        }

        ensureSpace(120);
        const orderDate = getOrderDate(order);
        const totalPaid = getPaidAmount(order);
        const originalAmount = calculateOriginalCartValue(order);
        const basePayable = getBasePayableAfterExchange(order);
        const balance = getFinalBalanceDue(order);
        const bookedWeight = Number(order.netWeight) || 0;
        const adjustment = Number(order.weightAdjustmentGrams) || 0;
        const finalNetWeight = bookedWeight + adjustment;
        const stoneWeight = Number(order.stoneWeight) || 0;
        const grossWeight = Number(order.grossWeight) || finalNetWeight + stoneWeight;

        drawText(order.customerName || "Unnamed Customer", MARGIN, cursorY, 14, black);
        drawRight(`#${order.orderId || "-"}`, A4_W - MARGIN, cursorY, 10, gold);
        cursorY -= 18;
        drawText(`${order.phoneNumber ? `+91 ${order.phoneNumber}` : "No phone"}  •  ${order.status || "-"}`, MARGIN, cursorY, 8.5, grey);
        if (orderDate) drawRight(format(orderDate, "dd MMM yyyy, h:mm a"), A4_W - MARGIN, cursorY, 8, grey);
        cursorY -= 13;
        line(cursorY, lightGrey, 0.7);
        cursorY -= 14;

        sectionTitle("Customer & Booking");
        fieldRow("Customer Name", order.customerName || "-");
        fieldRow("Phone Number", order.phoneNumber ? `+91 ${order.phoneNumber}` : "-");
        fieldRow("Order ID", order.orderId || "-");
        fieldRow("Booking Date", orderDate ? format(orderDate, "dd MMM yyyy, h:mm a") : "-");
        fieldRow("Deadline Date", order.deadlineDate ? format(new Date(order.deadlineDate), "dd MMM yyyy") : "-");
        fieldRow("Current Status", order.status || "-");

        sectionTitle("Article Details");
        fieldRow("Item Name", order.itemName || "-");
        fieldRow("Description", order.itemDescription || "-");
        fieldRow("Metal", `${order.metalType || "-"} / ${order.purity || "-"}${order.metalType === "GOLD" ? "K" : "%"}`);
        fieldRow("Live Rate", `₹${Number(order.liveRate || 0).toLocaleString()}`);
        fieldRow("VA Percentage", `${Number(order.vaPercentage || 0)}%`);

        sectionTitle("Weight Details");
        fieldRow("Booked Net Weight", `${bookedWeight.toFixed(3)} g`);
        fieldRow("Weight Adjustment (Balance Only)", `${adjustment >= 0 ? "+" : ""}${adjustment.toFixed(3)} g`);
        fieldRow("Final Physical Net Weight", `${finalNetWeight.toFixed(3)} g`);
        fieldRow("Stone Weight", `${stoneWeight.toFixed(3)} g`);
        fieldRow("Gross Weight", `${grossWeight.toFixed(3)} g`);
        fieldRow(
          Number(order.adjustmentCost || 0) >= 0
            ? "Final Payment Adjustment Added"
            : "Final Payment Adjustment Deducted",
          `${Number(order.adjustmentCost || 0) >= 0 ? "+" : "-"}₹${Math.abs(Number(order.adjustmentCost || 0)).toLocaleString()}`
        );

        sectionTitle("Exchange & Charges");
        fieldRow("Exchange Jewellery", order.exchangeJewelleryName || "-");
        fieldRow("Exchange Grams", `${Number(order.exchangeJewelleryGrams || 0).toFixed(3)} g`);
        fieldRow("Stone Cost", `₹${Number(order.stoneCost || 0).toLocaleString()}`);
        fieldRow("Jewellery Exchange Value", `₹${Number(order.discountAmount || 0).toLocaleString()}`);
        fieldRow("Original Cart Value (Incl. GST, Before Exchange)", `₹${originalAmount.toLocaleString()}`);
        fieldRow("GST (3% on Metal + VA + Stone)", `₹${Number(order.gst ?? order.gstAmount ?? 0).toLocaleString()}`);

        sectionTitle("Payment Summary");
        const actualCashPaid = getActualCashPaid(order);
        const actualMoneyPaid = getActualMoneyPaid(order);
        const totalPaymentCleared = getTotalPaymentCleared(order);

        fieldRow("Original Cart Value", `₹${originalAmount.toLocaleString()}`, { color: black });
        fieldRow("Total Cash Paid", `₹${actualCashPaid.toLocaleString()}`, { color: emerald });

        if (actualMoneyPaid !== actualCashPaid) {
          fieldRow("Total Money Paid (All Modes)", `₹${actualMoneyPaid.toLocaleString()}`, { color: emerald });
        }

        fieldRow(
          "Jewellery Exchange Cleared",
          `₹${getExchangeValue(order).toLocaleString()}`,
          { color: emerald }
        );
        fieldRow(
          "Total Payment (Money + Exchange)",
          `₹${totalPaymentCleared.toLocaleString()}`,
          { color: emerald }
        );
        const balanceBeforeFinalAdjustment = getPreAdjustmentBalanceForFinalPayment(order);
        const finalPaymentAmount = getFinalPaymentAmount(order);

        fieldRow(
          "Balance Due Before Adjustment",
          `₹${balanceBeforeFinalAdjustment.toLocaleString()}`,
          { color: black }
        );

        if (Number(order.adjustmentCost || 0) !== 0) {
          fieldRow(
            "Final Payment",
            `₹${balanceBeforeFinalAdjustment.toLocaleString()} ${Number(order.adjustmentCost || 0) > 0 ? "+" : "-"} ₹${Math.abs(Number(order.adjustmentCost || 0)).toLocaleString()} = ₹${finalPaymentAmount.toLocaleString()}`,
            { color: gold }
          );
        } else {
          fieldRow(
            "Final Payment",
            `₹${finalPaymentAmount.toLocaleString()}`,
            { color: gold }
          );
        }
        const orderModeTotals = getPaymentModeTotals([order]);
        fieldRow("Cash Collected", `₹${orderModeTotals.CASH.toLocaleString()}`);
        fieldRow("UPI Collected", `₹${orderModeTotals.UPI.toLocaleString()}`);
        fieldRow("Card Collected", `₹${orderModeTotals.CARD.toLocaleString()}`);
        fieldRow("Check Collected", `₹${orderModeTotals.CHECK.toLocaleString()}`);
        if (orderModeTotals.untracked > 0) {
          fieldRow("Legacy / Unclassified", `₹${orderModeTotals.untracked.toLocaleString()}`);
        }
        fieldRow(
          "Final Balance Due",
          balance <= 0 ? "₹0 — FULLY PAID" : `₹${balance.toLocaleString()}`,
          { color: balance > 0 ? rose : emerald }
        );

        sectionTitle("Payment History");
        const payments = getAdjustedPaymentRows(order);
        if (payments.length) {
          payments.forEach((payment: any, paymentIndex: number) => {
            const paidDate = payment.paidAt ? format(new Date(payment.paidAt), "dd MMM yyyy, h:mm a") : "Date unavailable";
            const mode = paymentModeLabel(payment.mode || payment.paymentMode);
            const reference = payment.checkNumber || payment.referenceNumber;
            const meta = [mode, reference, payment.bankName].filter(Boolean).join(" • ");
            const note = payment.note ? ` • ${payment.note}` : "";
            const adjusted =
              paymentIndex === payments.length - 1 &&
              Number(order.adjustmentCost || 0) !== 0
                ? " • Final Payment Adjusted"
                : "";

            fieldRow(
              `Payment ${paymentIndex + 1}`,
              `₹${Number(payment.amount || 0).toLocaleString()} — ${paidDate}${meta ? ` • ${meta}` : ""}${adjusted}${note}`
            );
          });
        } else {
          fieldRow("Payments", "No payment recorded yet.");
        }

        ensureSpace(30);
        cursorY -= 4;
        line(cursorY, gold, 0.6);
        cursorY -= 15;
      });

      // Page numbers
      const pages = pdfDoc.getPages();
      pages.forEach((pdfPage: any, index: number) => {
        const footer = `Page ${index + 1} of ${pages.length}`;
        pdfPage.drawText(footer, {
          x: A4_W - MARGIN - textWidth(footer, 7),
          y: 20,
          size: 7,
          font: customFont,
          color: grey,
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const first = ordersToExport[0];
      const safeCustomer = String(first?.customerName || "Customer").replace(/[^a-zA-Z0-9_-]+/g, "_");
      const filename = ordersToExport.length === 1
        ? `${safeCustomer}_${first?.orderId || "Order"}_Full_Details.pdf`
        : `Order_Registry_Full_Details_${format(new Date(), "dd-MM-yyyy")}.pdf`;
      link.href = pdfUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
    } catch (error) {
      console.error("REGISTRY_PDF_EXPORT_ERROR", error);
      alert("Could not generate the PDF report.");
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <DashboardSidebar />

        <main className="flex-1 min-w-0 flex flex-col min-h-screen text-left">
          <header className="bg-white/95 backdrop-blur-md border-b border-gold/10 px-6 lg:px-10 py-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sticky top-0 z-30">
            <div>
              <h1 className="text-3xl lg:text-4xl font-serif font-bold text-slate-900 tracking-tight">Order Registry</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold font-sans">
                  Active Booking Ledger • Real-time Monitoring
                </p>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <Button variant="outline" size="icon" onClick={fetchOrders} className="h-9 w-9 rounded-lg border-gold/20 text-gold hover:bg-gold/5 transition-all">
                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
              </Button>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-slate-900 hover:bg-black text-gold gap-2 px-5 h-11 rounded-xl font-serif font-bold shadow-lg shadow-slate-200 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" /> New Booking
              </Button>
            </div>
          </header>

          <div className="p-5 lg:p-7 flex flex-col gap-4 pb-12">
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <LuxuryCard className="p-4 rounded-2xl border-gold/10 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">Amount Received</p>
                    <p className="text-xl lg:text-2xl font-serif font-bold text-emerald-700 mt-1.5">₹{Math.round(registrySummary.received).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Cached total received</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                </div>
              </LuxuryCard>

              <LuxuryCard className="p-4 rounded-2xl border-gold/10 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">Order Value</p>
                    <p className="text-xl lg:text-2xl font-serif font-bold text-slate-900 mt-1.5">₹{Math.round(registrySummary.orderValue).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Value of visible bookings</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-slate-700" /></div>
                </div>
              </LuxuryCard>

              <LuxuryCard className="p-4 rounded-2xl border-gold/10 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">Pending Balance</p>
                    <p className="text-xl lg:text-2xl font-serif font-bold text-rose-600 mt-1.5">₹{Math.round(registrySummary.pending).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Still to be collected</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0"><IndianRupee className="w-5 h-5 text-rose-500" /></div>
                </div>
              </LuxuryCard>

              <LuxuryCard className="p-4 rounded-2xl border-gold/10 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">Orders</p>
                    <p className="text-xl lg:text-2xl font-serif font-bold text-gold mt-1.5">{registrySummary.count}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Matching current filters</p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-gold/10 flex items-center justify-center shrink-0"><ShoppingBag className="w-5 h-5 text-gold" /></div>
                </div>
              </LuxuryCard>
            </div>

            {/* COLLECTION BY PAYMENT MODE */}
            <LuxuryCard className="p-4 rounded-2xl border-gold/10 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-gold" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-700">Collection by Payment Mode</h2>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Breakdown for the orders matching the current filters</p>
                </div>
                <p className="text-xs font-bold text-emerald-700">Tracked: ₹{Math.round(paymentModeSummary.tracked).toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-white border border-emerald-100 flex items-center justify-center shrink-0"><Banknote className="w-5 h-5 text-emerald-700" /></div>
                  <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Cash</p><p className="text-lg font-serif font-bold text-slate-900 truncate">₹{Math.round(paymentModeSummary.CASH).toLocaleString()}</p></div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-white border border-blue-100 flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5 text-blue-700" /></div>
                  <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-blue-700">UPI</p><p className="text-lg font-serif font-bold text-slate-900 truncate">₹{Math.round(paymentModeSummary.UPI).toLocaleString()}</p></div>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3 flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-white border border-violet-100 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5 text-violet-700" /></div>
                  <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-violet-700">Card</p><p className="text-lg font-serif font-bold text-slate-900 truncate">₹{Math.round(paymentModeSummary.CARD).toLocaleString()}</p></div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-white border border-amber-100 flex items-center justify-center shrink-0"><Landmark className="w-5 h-5 text-amber-700" /></div>
                  <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-widest text-amber-700">Check</p><p className="text-lg font-serif font-bold text-slate-900 truncate">₹{Math.round(paymentModeSummary.CHECK).toLocaleString()}</p></div>
                </div>
              </div>

              {paymentModeSummary.untracked > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-[10px] text-amber-800">
                  ₹{Math.round(paymentModeSummary.untracked).toLocaleString()} is from older advances without a stored payment mode. It stays in Total Collected but is not assigned to Cash, UPI, Card, or Check.
                </div>
              )}
            </LuxuryCard>

            {/* SEARCH + FILTER BAR */}
            <LuxuryCard className="p-4 rounded-2xl border-gold/10 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_170px_170px_170px_auto_auto] items-end gap-3">
                <div className="min-w-0">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Search Orders</label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Order ID, customer, phone, item..."
                      className="h-11 pl-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="w-full">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Status</label>
                  <div className="relative mt-1.5">
                    <ListFilter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "DELIVERED")}
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-gold/20"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="ACTIVE">Pending / Active</option>
                      <option value="DELIVERED">Delivered</option>
                    </select>
                  </div>
                </div>

                <div className="w-full">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">From Date</label>
                  <div className="relative mt-1.5">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="h-11 pl-10 rounded-xl" />
                  </div>
                </div>

                <div className="w-full">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">To Date</label>
                  <div className="relative mt-1.5">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className="h-11 pl-10 rounded-xl" />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={clearRegistryFilters}
                  className="h-11 px-4 rounded-xl border-slate-200 text-slate-600 gap-2 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" /> Clear
                </Button>

                <Button
                  type="button"
                  onClick={() => handleExportRegistryPdf(filteredOrders)}
                  disabled={!filteredOrders.length || isLoading}
                  className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-black text-gold gap-2 disabled:opacity-40 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" /> Export PDF
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  Showing {filteredOrders.length} of {orders.length} orders
                </p>
                {(fromDate || toDate) && (
                  <p className="text-[10px] font-bold text-gold">
                    Booking date: {fromDate || "Beginning"} → {toDate || "Today"}
                  </p>
                )}
              </div>
            </LuxuryCard>

            {/* ORDERS TABLE — natural page flow so every order remains visible */}
            <LuxuryCard className="overflow-hidden p-0 border-gold/5 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.035)] rounded-[2rem]">
              <div className="px-5 lg:px-6 py-4 border-b border-gold/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-[0.14em]">Customer Orders</h2>
                  <p className="text-[11px] text-slate-400 mt-1">All matching orders are listed below. Scroll the page to view the complete registry.</p>
                </div>
                <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  {filteredOrders.length} visible / {orders.length} total
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead className="bg-slate-50 border-b border-gold/10 text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400">
                    <tr>
                      <th className="px-6 py-4 text-left">Order Reference</th>
                      <th className="px-6 py-4 text-left">Article Details</th>
                      <th className="px-6 py-4 text-left">Financial Core</th>
                      <th className="px-6 py-4 text-left">Current Phase</th>
                      <th className="px-6 py-4 text-right">Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/5">
                    {isLoading ? (
                      <tr><td colSpan={5} className="py-40 text-center"><Loader2 className="animate-spin w-10 h-10 text-gold mx-auto" /><p className="text-slate-400 mt-4 italic font-serif">Synchronizing Ledger...</p></td></tr>
                    ) : filteredOrders.length > 0 ? filteredOrders.map((o) => (
                      <tr key={o.id} className="group hover:bg-slate-50/50 cursor-pointer transition-all duration-300" onClick={() => setViewingOrder(o)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Hash className="w-4 h-4 text-gold" />
                            <span className="text-sm font-bold font-mono tracking-tighter text-slate-500">{o.orderId}</span>
                          </div>
                          <p className="text-base font-serif font-bold text-slate-800">{o.customerName}</p>
                          <p className="text-xs text-slate-400 font-medium">Contact: {o.phoneNumber}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block text-[11px] font-bold text-gold uppercase bg-gold/5 px-3 py-1 rounded-lg border border-gold/10 mb-2">
                            {o.itemName}
                          </span>
                          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                            <div className="flex items-center gap-1"><Scale className="w-3 h-3" /> {(Number(o.netWeight) + Number(o.weightAdjustmentGrams || 0)).toFixed(3)}g</div>
                            <div className="flex items-center gap-1"><Gem className="w-3 h-3" /> {o.purity}K {o.metalType}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-base font-serif font-bold text-slate-900">₹{calculateOriginalCartValue(o).toLocaleString()}</p>
                          <p className="text-xs text-slate-400 mt-1">Original Cart Value</p>
                          {getExchangeValue(o) > 0 && (
                            <p className="text-xs text-rose-500 mt-1">
                              Exchange Cleared: ₹{getExchangeValue(o).toLocaleString()}
                            </p>
                          )}
                          {(o.exchangeJewelleryName || o.exchangeJewelleryGrams) && (
                            <p className="text-xs text-slate-400 mt-1">Exchange: {o.exchangeJewelleryName || "Item"} · {Number(o.exchangeJewelleryGrams || 0)}g</p>
                          )}
                          {o.payments?.length > 0 && (
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Receipt className="w-3 h-3" /> {o.payments.length} payment{o.payments.length > 1 ? "s" : ""}
                            </p>
                          )}
                          <div className={cn("flex items-center gap-1.5 text-[11px] font-bold mt-1", o.status === "DELIVERED" ? "text-emerald-500" : "text-rose-500")}>
                            {o.status === "DELIVERED" ? <CheckCircle2 className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                            {o.status === "DELIVERED" ? "Payment Completed" : `Balance: ₹${getFinalBalanceDue(o).toLocaleString()}`}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all",
                            o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200"
                          )}>
                            {o.status === "DELIVERED" ? <PackageCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {o.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="h-10 w-10 rounded-full border border-slate-100 flex items-center justify-center ml-auto group-hover:border-gold group-hover:bg-gold/5 transition-all">
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-gold" />
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-40 text-center"><AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" /><p className="text-slate-400 italic">{orders.length === 0 ? "No bookings recorded in the system yet." : "No orders match the current filters."}</p></td></tr>
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
        <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] max-h-[92vh] rounded-[3rem] p-0 overflow-hidden border-gold/20 shadow-2xl bg-white outline-none flex flex-col">
          <DialogHeader className="shrink-0 p-6 md:p-8 lg:p-10 bg-slate-900 text-white flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-20 bg-gold/5 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none" />
            <div className="relative z-10 text-left">
              <div className="flex items-center gap-3 text-gold mb-3">
                <Hash className="w-6 h-6" />
                <span className="text-lg font-mono font-bold tracking-[0.3em] uppercase">{viewingOrder?.orderId}</span>
              </div>
              <DialogTitle className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold italic tracking-tight">Booking Ledger</DialogTitle>
              <p className="text-slate-400 text-xs mt-2 uppercase tracking-[0.1em] font-bold">Client Transaction Record</p>
            </div>

            <div className="flex flex-wrap gap-3 relative z-10">
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
                <p className="text-[10px] uppercase text-emerald-300 font-bold tracking-widest text-center">Full Details</p>
                <Button
                  onClick={() => viewingOrder && handleExportRegistryPdf([viewingOrder])}
                  variant="outline"
                  className="h-14 w-14 border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10 rounded-2xl"
                  title="Download complete customer details PDF"
                >
                  <Download className="w-5 h-5" />
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

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 md:p-8 lg:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-left bg-white custom-scrollbar">
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
                  <p className="text-xs text-slate-500 mt-1">
                    Balance-only impact: {Number(viewingOrder?.adjustmentCost || 0) >= 0 ? "+" : "-"}₹{Math.abs(Number(viewingOrder?.adjustmentCost || 0)).toLocaleString()}
                  </p>
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
                    <div className="flex justify-between text-xs text-rose-600 font-bold"><span>Jewellery Exchange Value</span><span>-₹{Number(viewingOrder?.discountAmount).toLocaleString()}</span></div>
                  </div>
                )}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-emerald-700 font-bold">
                      <span>Total Cash Paid</span>
                      <span>₹{getActualCashPaid(viewingOrder).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-700 font-bold">
                      <span>Jewellery Exchange Cleared</span>
                      <span>₹{getExchangeValue(viewingOrder).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>Total Payment</span>
                      <span>₹{getTotalPaymentCleared(viewingOrder).toLocaleString()}</span>
                    </div>
                    {Number(viewingOrder?.adjustmentCost || 0) !== 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                          <span>Balance Due Before Adjustment</span>
                          <span>₹{getPreAdjustmentBalanceForFinalPayment(viewingOrder).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-gold">
                          <span>Final Payment</span>
                          <span>
                            ₹{getPreAdjustmentBalanceForFinalPayment(viewingOrder).toLocaleString()}
                            {" "}{Number(viewingOrder?.adjustmentCost || 0) > 0 ? "+" : "-"}{" "}
                            ₹{Math.abs(Number(viewingOrder?.adjustmentCost || 0)).toLocaleString()}
                            {" = "}
                            ₹{getFinalPaymentAmount(viewingOrder).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PAYMENT STATUS + HISTORY */}
            <div className="space-y-6">
              <div className={cn(
                "p-8 rounded-[2rem] text-white shadow-2xl transition-all duration-700 relative overflow-hidden",
                viewingOrder?.status === "DELIVERED" ? "bg-emerald-900" : "bg-slate-900"
              )}>
                <h4 className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-6 border-b border-white/10 pb-3">Payment Status</h4>
                <div className="space-y-5 relative z-10">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Total Bill</p>
                    <p className="text-3xl font-serif font-bold text-white">₹{calculateOriginalCartValue(viewingOrder).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Original Cart Value</p>
                    {getExchangeValue(viewingOrder) > 0 && (
                      <p className="text-xs text-emerald-300 mt-2">
                        Jewellery exchange cleared: ₹{getExchangeValue(viewingOrder).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <p className="text-[10px] text-slate-300 uppercase font-bold mb-2">Total Cash Paid</p>
                    <p className="text-2xl font-serif font-bold text-emerald-400">
                      ₹{getActualCashPaid(viewingOrder).toLocaleString()}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <p className="text-[10px] text-emerald-300 uppercase font-bold mb-2">Jewellery Exchange Cleared</p>
                    <p className="text-xl font-serif font-bold text-emerald-300">₹{getExchangeValue(viewingOrder).toLocaleString()}</p>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <p className="text-[10px] text-gold uppercase font-bold mb-2">Total Payment</p>
                    <p className="text-2xl font-serif font-bold text-gold">
                      ₹{getTotalPaymentCleared(viewingOrder).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">
                      Actual Money Paid + Jewellery Exchange
                    </p>
                  </div>

                  <GoldDivider className="opacity-20" />
                  <div>
                    <p className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-2">Balance Due</p>
                    <p className="text-4xl font-serif font-bold text-white tracking-tighter">₹{getFinalBalanceDue(viewingOrder).toLocaleString()}</p>
                    {Number(viewingOrder?.adjustmentCost || 0) !== 0 && (
                      <div className="mt-3 text-xs font-bold text-gold">
                        <p>
                          Balance before adjustment: ₹{getPreAdjustmentBalanceForFinalPayment(viewingOrder).toLocaleString()}
                        </p>
                        <p className="mt-1">
                          Final payment: ₹{getPreAdjustmentBalanceForFinalPayment(viewingOrder).toLocaleString()}
                          {" "}{Number(viewingOrder?.adjustmentCost || 0) > 0 ? "+" : "-"}{" "}
                          ₹{Math.abs(Number(viewingOrder?.adjustmentCost || 0)).toLocaleString()}
                          {" = "}
                          ₹{getFinalPaymentAmount(viewingOrder).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {getFinalBalanceDue(viewingOrder) <= 0 && (
                      <p className="text-xs text-emerald-300 font-bold mt-2 uppercase tracking-widest">✓ Fully Paid</p>
                    )}
                  </div>
                </div>
              </div>

              {/* CUSTOMER PAYMENT MODE BREAKDOWN */}
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Collected by Mode</h4>
                  <span className="text-[10px] font-bold text-emerald-700">₹{Math.round(viewingOrderPaymentModes.tracked).toLocaleString()} tracked</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-emerald-100 rounded-xl p-3"><p className="text-[9px] uppercase font-bold text-emerald-700">Cash</p><p className="font-serif font-bold text-slate-900">₹{Math.round(viewingOrderPaymentModes.CASH).toLocaleString()}</p></div>
                  <div className="bg-white border border-blue-100 rounded-xl p-3"><p className="text-[9px] uppercase font-bold text-blue-700">UPI</p><p className="font-serif font-bold text-slate-900">₹{Math.round(viewingOrderPaymentModes.UPI).toLocaleString()}</p></div>
                  <div className="bg-white border border-violet-100 rounded-xl p-3"><p className="text-[9px] uppercase font-bold text-violet-700">Card</p><p className="font-serif font-bold text-slate-900">₹{Math.round(viewingOrderPaymentModes.CARD).toLocaleString()}</p></div>
                  <div className="bg-white border border-amber-100 rounded-xl p-3"><p className="text-[9px] uppercase font-bold text-amber-700">Check</p><p className="font-serif font-bold text-slate-900">₹{Math.round(viewingOrderPaymentModes.CHECK).toLocaleString()}</p></div>
                </div>
                {viewingOrderPaymentModes.untracked > 0 && <p className="text-[9px] text-amber-700 mt-2">Legacy / unclassified: ₹{Math.round(viewingOrderPaymentModes.untracked).toLocaleString()}</p>}
              </div>

              {/* PAYMENT HISTORY */}
              <div className="p-6 bg-white border border-slate-100 rounded-[2rem] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Payment History</h4>
                  {viewingOrder?.status !== "DELIVERED" && (
                    <Button
                      onClick={() => setIsPaymentOpen(true)}
                      size="sm"
                      className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3"
                    >
                      + Add Payment
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Math.max(0, getPaidAmount(viewingOrder) - getPaymentsTotal(viewingOrder)) > 0 && (
                    <div className="flex justify-between items-center text-xs p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <div>
                        <p className="font-bold text-emerald-800">
                          Initial {paymentModeLabel(viewingOrder?.advancePaymentMode)}
                        </p>
                        <p className="text-[10px] text-emerald-600">
                          {viewingOrder?.advanceReferenceNumber ||
                           viewingOrder?.advanceCheckNumber ||
                           "Initial booking payment"}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-700">
                        ₹{Math.round(Math.max(0, getPaidAmount(viewingOrder) - getPaymentsTotal(viewingOrder))).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {getOrderPayments(viewingOrder).length > 0 ? (
                    getOrderPayments(viewingOrder).map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-700">₹{Number(p.amount).toLocaleString()}</p>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[9px] font-bold uppercase text-slate-500">
                              {paymentModeLabel(p.mode)}
                            </span>
                          </div>
                          <p className="text-slate-400">{format(new Date(p.paidAt), "dd MMM yyyy, h:mm a")}</p>
                          {(p.referenceNumber || p.checkNumber) && <p className="text-slate-500">Ref: {p.checkNumber || p.referenceNumber}</p>}
                          {p.bankName && <p className="text-slate-500">Bank: {p.bankName}</p>}
                          {p.note && <p className="text-slate-400 italic">{p.note}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No payments recorded yet.</p>
                  )}
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

      {/* ================= RECORD PAYMENT DIALOG ================= */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md rounded-[2rem] p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif font-bold">Record Payment — {viewingOrder?.orderId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-slate-50 rounded-xl flex justify-between text-sm">
              <span className="text-slate-500">Remaining Balance</span>
              <span className="font-bold text-slate-900">₹{getFinalBalanceDue(viewingOrder).toLocaleString()}</span>
            </div>
            <Input
              placeholder="Amount Received (₹)"
              type="number"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="h-14 font-bold"
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mode of Payment</label>
              <select
                value={paymentMode}
                onChange={(e) => {
                  const mode = e.target.value as PaymentMode;
                  setPaymentMode(mode);
                  setPaymentReferenceNumber("");
                  setPaymentBankName("");
                  setPaymentCheckNumber("");
                }}
                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="CHECK">Check</option>
              </select>
            </div>

            {(paymentMode === "UPI" || paymentMode === "CARD") && (
              <Input
                placeholder={paymentMode === "UPI" ? "UPI Transaction / UTR Number" : "Card Transaction / Receipt Reference"}
                value={paymentReferenceNumber}
                onChange={(e) => setPaymentReferenceNumber(e.target.value)}
                className="h-12"
              />
            )}

            {paymentMode === "CHECK" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Check Number"
                  value={paymentCheckNumber}
                  onChange={(e) => setPaymentCheckNumber(e.target.value)}
                  className="h-12"
                />
                <Input
                  placeholder="Bank Name"
                  value={paymentBankName}
                  onChange={(e) => setPaymentBankName(e.target.value)}
                  className="h-12"
                />
              </div>
            )}

            <Input
              placeholder="Note (optional)"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              className="h-12"
            />
            <Button onClick={handleRecordPayment} disabled={isSubmitting} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold">
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Payment"}
            </Button>
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
          <p className="text-[10px] text-slate-400 mt-2">
            Note: +/- weight and adjustment cost affect Balance Due only. They do not recalculate Metal Cost, VA, GST, or Base Order Amount. Advance/payments already collected are not editable here.
          </p>
          <Button onClick={handleSaveEdit} disabled={isSubmitting} className="w-full h-14 mt-4 bg-slate-900 text-gold rounded-2xl font-bold">
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
                  <Input placeholder="Initial Payment (₹)" type="number" min="0" value={form.advanceCash} onChange={(e) => handleInputChange("advanceCash", e.target.value)} className="h-12 border-emerald-100 text-emerald-600 font-bold" />
                </div>

                {Number(form.advanceCash || 0) > 0 && (
                  <div className="space-y-4 p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Initial Payment Mode</label>
                      <select
                        value={form.advancePaymentMode}
                        onChange={(e) => handleInputChange("advancePaymentMode", e.target.value)}
                        className="w-full h-12 rounded-xl border border-emerald-100 bg-white px-4 text-sm font-bold outline-none"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="CHECK">Check</option>
                      </select>
                    </div>

                    {(form.advancePaymentMode === "UPI" || form.advancePaymentMode === "CARD") && (
                      <Input
                        placeholder={form.advancePaymentMode === "UPI" ? "UPI Transaction / UTR Number" : "Card Transaction / Receipt Reference"}
                        value={form.advanceReferenceNumber}
                        onChange={(e) => handleInputChange("advanceReferenceNumber", e.target.value)}
                        className="h-12 bg-white"
                      />
                    )}

                    {form.advancePaymentMode === "CHECK" && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Check Number" value={form.advanceCheckNumber} onChange={(e) => handleInputChange("advanceCheckNumber", e.target.value)} className="h-12 bg-white" />
                        <Input placeholder="Bank Name" value={form.advanceBankName} onChange={(e) => handleInputChange("advanceBankName", e.target.value)} className="h-12 bg-white" />
                      </div>
                    )}
                  </div>
                )}
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
                    <div className="flex justify-between text-sm"><span className="text-slate-400 italic">GST (3% on Metal + VA + Stone)</span><span className="text-slate-300">+ ₹{Math.round(totals.gstAmount).toLocaleString()}</span></div>
                  </div>
                  <GoldDivider className="opacity-20 my-8" />
                  <div className="py-2 text-center"><p className="text-[11px] text-gold font-bold uppercase tracking-[0.3em] mb-3">Projected Total</p><h2 className="text-6xl font-serif font-bold text-white tracking-tighter">
                      ₹{totals.totalWithGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2></div>
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 flex justify-between items-center mt-10 shadow-2xl backdrop-blur-sm">
                    <div className="text-left"><p className="text-[11px] text-rose-400 font-bold uppercase tracking-widest">Contract</p><p className="text-xs text-slate-400">Balance Owed</p></div>
                    <p className="text-3xl font-serif font-bold text-white">
                      ₹{Math.max(0, totals.balanceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
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