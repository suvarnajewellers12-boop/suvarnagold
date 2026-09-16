"use client";

import { useState, useMemo, useEffect } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import{AdminSidebar} from "@/components/AdminSidebar";
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

type PaymentSplit = {
  mode: PaymentMode;
  amount: string;
  referenceNumber: string;
  checkNumber: string;
  bankName: string;
};

const PAYMENT_MODE_OPTIONS: Array<{ mode: PaymentMode; label: string }> = [
  { mode: "CASH", label: "Cash" },
  { mode: "UPI", label: "UPI" },
  { mode: "CARD", label: "Card" },
  { mode: "CHECK", label: "Check" },
];

const createPaymentSplit = (mode: PaymentMode): PaymentSplit => ({
  mode,
  amount: "",
  referenceNumber: "",
  checkNumber: "",
  bankName: "",
});

const getSplitTotal = (splits: PaymentSplit[]) =>
  roundMoneyValue(
    splits.reduce((sum, split) => sum + Math.max(0, Number(split.amount) || 0), 0)
  );

const toPaymentPayload = (splits: PaymentSplit[], note: string) =>
  splits
    .filter((split) => Math.max(0, Number(split.amount) || 0) > 0)
    .map((split) => ({
      amount: roundMoneyValue(Math.max(0, Number(split.amount) || 0)),
      mode: split.mode,
      referenceNumber:
        split.mode === "UPI" || split.mode === "CARD"
          ? split.referenceNumber.trim() || null
          : null,
      checkNumber:
        split.mode === "CHECK" ? split.checkNumber.trim() || null : null,
      bankName:
        split.mode === "CHECK" ? split.bankName.trim() || null : null,
      note,
    }));

function PaymentSplitEditor({
  splits,
  onChange,
  targetAmount,
  title,
}: {
  splits: PaymentSplit[];
  onChange: (next: PaymentSplit[]) => void;
  targetAmount?: number;
  title: string;
}) {
  const total = getSplitTotal(splits);
  const enabled = new Set(splits.map((split) => split.mode));

  const toggleMode = (mode: PaymentMode) => {
    if (enabled.has(mode)) {
      onChange(splits.filter((split) => split.mode !== mode));
    } else {
      onChange([...splits, createPaymentSplit(mode)]);
    }
  };

  const updateSplit = (
    mode: PaymentMode,
    field: keyof Omit<PaymentSplit, "mode">,
    value: string
  ) => {
    onChange(
      splits.map((split) =>
        split.mode === mode ? { ...split, [field]: value } : split
      )
    );
  };

  const difference =
    typeof targetAmount === "number"
      ? roundMoneyValue(targetAmount - total)
      : 0;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Select every mode the customer is using.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase text-slate-400">Split Total</p>
          <p className="font-serif text-xl font-bold text-slate-900">
            ₹{total.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_MODE_OPTIONS.map(({ mode, label }) => {
          const checked = enabled.has(mode);
          return (
            <label
              key={mode}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                checked
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleMode(mode)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                {label}
              </span>
            </label>
          );
        })}
      </div>

      <div className="space-y-3">
        {splits.map((split) => (
          <div
            key={split.mode}
            className="rounded-2xl border border-white bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-700">
                {paymentModeLabel(split.mode)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Payment portion
              </span>
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={`${paymentModeLabel(split.mode)} amount (₹)`}
              value={split.amount}
              onChange={(e) => updateSplit(split.mode, "amount", e.target.value)}
              className="h-11 font-bold"
            />

            {(split.mode === "UPI" || split.mode === "CARD") && (
              <Input
                placeholder={
                  split.mode === "UPI"
                    ? "UPI Transaction / UTR Number"
                    : "Card Transaction / Receipt Reference"
                }
                value={split.referenceNumber}
                onChange={(e) =>
                  updateSplit(split.mode, "referenceNumber", e.target.value)
                }
                className="mt-2 h-11"
              />
            )}

            {split.mode === "CHECK" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Check Number"
                  value={split.checkNumber}
                  onChange={(e) =>
                    updateSplit(split.mode, "checkNumber", e.target.value)
                  }
                  className="h-11"
                />
                <Input
                  placeholder="Bank Name"
                  value={split.bankName}
                  onChange={(e) =>
                    updateSplit(split.mode, "bankName", e.target.value)
                  }
                  className="h-11"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {typeof targetAmount === "number" && (
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-bold",
            Math.abs(difference) <= 0.01
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          <span>
            {Math.abs(difference) <= 0.01
              ? "Split matches required amount"
              : difference > 0
              ? "Still to allocate"
              : "Over allocated"}
          </span>
          <span>₹{Math.abs(difference).toLocaleString("en-IN")}</span>
        </div>
      )}
    </div>
  );
}


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
//
// FIX (was causing the Balance Due dialog to drift ~5k away from the
// printed receipt): the functions below used to read `order.originalCartValue`
// / `order.totalAmount`, snapshot fields that are written ONCE when the order
// is first created (see the `totals` useMemo in the creation form) and are
// never re-written by the edit flow (handleSaveEdit only PATCHes the raw
// fields — netWeight, liveRate, vaPercentage, stoneCost, weightAdjustmentGrams,
// adjustmentCost, discountAmount, etc). So the moment an order was edited
// (e.g. a weight/amount adjustment), those cached totals went stale while the
// receipt PDF kept recomputing everything live from the raw fields — hence
// the mismatch between the dialog and the receipt.
//
// The fix: never trust the cached snapshot for display math. Every figure
// below is recomputed live from the same raw fields, using the exact same
// Metal -> VA -> Stone -> GST -> Weight Adjustment -> Exchange pipeline the
// receipt uses, so the dialog and the printed receipt can never disagree.
// ---------------------------------------------------------------------------
const roundMoneyValue = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const getGoldExchangeValue = (order: any) =>
  Math.max(0, Number(order?.discountAmount) || 0);

const getSilverExchangeValue = (order: any) =>
  Math.max(0, Number(order?.silverExchangeValue) || 0);

const getExchangeValue = (order: any) =>
  roundMoneyValue(
    getGoldExchangeValue(order) + getSilverExchangeValue(order)
  );

// "Amount Before Adjustment" on the receipt: Metal + VA + Stone, then GST
// on top of all three. Always recomputed live — never read from a cached
// originalCartValue snapshot, which is what used to go stale after edits.
const calculateOriginalCartValue = (order: any) => {
  const pricingMode = String(order?.pricingMode || "GRAMS").toUpperCase();
  const isPieceCost = pricingMode === "PIECE";

  const bookedWeight = Math.max(0, Number(order?.netWeight) || 0);
  const rate = Math.max(0, Number(order?.liveRate) || 0);
  const vaPercent = Math.max(0, Number(order?.vaPercentage) || 0);
  const stoneCost = Math.max(0, Number(order?.stoneCost) || 0);

  const metalCost = roundMoneyValue(
    isPieceCost
      ? Math.max(0, Number(order?.pieceCost) || 0)
      : bookedWeight * rate
  );

  // Piece-cost 92.5 silver never carries VA.
  const vaAmount = isPieceCost
    ? 0
    : roundMoneyValue(metalCost * (vaPercent / 100));

  // GST taxable base includes stone cost (matches the printed receipt).
  const gstTaxableBase = roundMoneyValue(
    Math.max(0, metalCost + vaAmount + stoneCost)
  );
  const gstAmount = roundMoneyValue(gstTaxableBase * 0.03);

  return roundMoneyValue(gstTaxableBase + gstAmount);
};

// Amount Before Adjustment +/- the weight adjustment cost.
// adjustmentCost already carries its own sign (e.g. -710 or +710).
const getAdjustedAmountBeforeExchange = (order: any) =>
  roundMoneyValue(
    Math.max(
      0,
      calculateOriginalCartValue(order) + (Number(order?.adjustmentCost) || 0)
    )
  );

// Payable amount BEFORE the weight adjustment is applied, net of exchange.
// Used only for the "Balance Due Before Adjustment" breakdown line.
const getBasePayableAfterExchange = (order: any) =>
  roundMoneyValue(
    Math.max(0, calculateOriginalCartValue(order) - getExchangeValue(order))
  );

// Final payable amount: Amount Before Adjustment, +/- weight adjustment,
// minus exchange. This is exactly the receipt's "Payable After Exchange".
const getFinalPayableBeforePayments = (order: any) =>
  roundMoneyValue(
    Math.max(0, getAdjustedAmountBeforeExchange(order) - getExchangeValue(order))
  );

const getOriginalPaymentRows = (order: any) =>
  getOrderPayments(order).map((payment: any) => ({
    ...payment,
    amount: Math.max(0, Number(payment?.amount) || 0),
  }));

const getActualMoneyPaid = (order: any) =>
  roundMoneyValue(
    getOriginalPaymentRows(order).reduce(
      (sum: number, payment: any) =>
        sum + Math.max(0, Number(payment?.amount) || 0),
      0
    )
  );

const getActualCashPaid = (order: any) =>
  roundMoneyValue(
    getOriginalPaymentRows(order).reduce((sum: number, payment: any) => {
      const mode = String(payment?.mode || payment?.paymentMode || "").toUpperCase();
      return mode === "CASH"
        ? sum + Math.max(0, Number(payment?.amount) || 0)
        : sum;
    }, 0)
  );

const getTotalPaymentCleared = (order: any) =>
  roundMoneyValue(getActualMoneyPaid(order) + getExchangeValue(order));

const getFinalBalanceDue = (order: any) =>
  roundMoneyValue(
    Math.max(0, getFinalPayableBeforePayments(order) - getActualMoneyPaid(order))
  );

// These remain for the existing detail/receipt labels.
const getPreAdjustmentBalanceForFinalPayment = (order: any) =>
  roundMoneyValue(
    Math.max(
      0,
      getBasePayableAfterExchange(order) - getActualMoneyPaid(order)
    )
  );

const getFinalPaymentAmount = (order: any) => getFinalBalanceDue(order);

const getAdjustedPaymentRows = (order: any) => getOriginalPaymentRows(order);

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
  const [datePreset, setDatePreset] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR" | "OVERALL" | "CUSTOM">("OVERALL");

  // Creation Form State
  const [form, setForm] = useState({
    customerName: "",
    phoneNumber: "",
    address: "",
    itemName: "",
    itemDescription: "",
    exchangeJewelleryName: "",
    exchangeJewelleryGrams: "",
    hasSilverExchange: false,
    silverExchangeJewelleryName: "",
    silverExchangeJewelleryGrams: "",
    silverExchangeValue: "",
    purity: "22",
    pricingMode: "GRAMS" as "GRAMS" | "PIECE",
    pieceCost: "",
    liveRate: "",
    requiredGrams: "", // used only when pricingMode === "GRAMS"
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

  // Split-payment state
  const [initialPaymentSplits, setInitialPaymentSplits] = useState<PaymentSplit[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentPurpose, setPaymentPurpose] = useState<"ADD" | "SETTLE">("ADD");

  useEffect(() => {
    if (viewingOrder) {
      setEditForm({
        customerName: viewingOrder.customerName || "",
        phoneNumber: viewingOrder.phoneNumber || "",
        address: viewingOrder.address || "",
        itemName: viewingOrder.itemName || "",
        itemDescription: viewingOrder.itemDescription || "",
        metalType: viewingOrder.metalType || "GOLD",
        purity: viewingOrder.purity || "22",
        pricingMode: viewingOrder.pricingMode || "GRAMS",
        pieceCost: viewingOrder.pieceCost ?? 0,
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
        hasSilverExchange:
          Boolean(viewingOrder.silverExchangeJewelleryName) ||
          Number(viewingOrder.silverExchangeJewelleryGrams || 0) > 0 ||
          Number(viewingOrder.silverExchangeValue || 0) > 0,
        silverExchangeJewelleryName: viewingOrder.silverExchangeJewelleryName || "",
        silverExchangeJewelleryGrams: viewingOrder.silverExchangeJewelleryGrams ?? "",
        silverExchangeValue: viewingOrder.silverExchangeValue ?? "",
      });
    }
  }, [viewingOrder]);

  // ---------------------------------------------------------------------------
  // PDF GENERATION
  // ---------------------------------------------------------------------------
  const handleOrderReceipt = async (
  order: any,
  mode: "download" | "print",
  type: "BOOKING" | "DELIVERY" = "BOOKING"
) => {
  try {
    const fontBytes = await fetch(
      "/fonts/NotoSans-VariableFont_wdth,wght.ttf"
    ).then((res) => res.arrayBuffer());

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

    // ============================================================
    // PDF SETUP
    // ============================================================

    let pdfDoc: any;

    if (mode === "download") {
      const templateBytes = await fetch("/receipt.pdf").then((res) =>
        res.arrayBuffer()
      );

      pdfDoc = await PDFDocument.load(templateBytes);
      pdfDoc.getPages()[0].setSize(A5_W, A5_H);
    } else {
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([A5_W, A5_H]);
    }

    pdfDoc.registerFontkit(fontkit);

    const customFont = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.getPages()[0];

    // ============================================================
    // DRAW HELPERS
    // ============================================================

    const makePen = (page: any) => {
      const draw = (
        text: string,
        x: number,
        yFromTop: number,
        size = 9,
        color = black
      ) => {
        page.drawText(String(text ?? ""), {
          x,
          y: A5_H - yFromTop,
          size,
          font: customFont,
          color,
        });
      };

      const drawR = (
        text: string,
        rightX: number,
        yFromTop: number,
        size = 9,
        color = black
      ) => {
        const safeText = String(text ?? "");

        const width = customFont.widthOfTextAtSize(
          safeText,
          size
        );

        page.drawText(safeText, {
          x: rightX - width,
          y: A5_H - yFromTop,
          size,
          font: customFont,
          color,
        });
      };

      const hLine = (
        yFromTop: number,
        lineColor = lightGrey,
        thickness = 0.4
      ) => {
        page.drawLine({
          start: {
            x: MARGIN_L,
            y: A5_H - yFromTop,
          },
          end: {
            x: MARGIN_R,
            y: A5_H - yFromTop,
          },
          thickness,
          color: lineColor,
        });
      };

      return {
        draw,
        drawR,
        hLine,
      };
    };

    const { draw, drawR, hLine } =
      makePen(page);

    // ============================================================
    // BASIC VALUES
    // ============================================================

    const bookedWt =
      Number(order.netWeight) || 0;

    const weightAdj =
      Number(order.weightAdjustmentGrams) || 0;

    // adjustmentCost MUST already contain the correct sign.
    // Example:
    // -0.05g => -710
    // +0.05g => +710
    const adjustmentCost =
      Number(order.adjustmentCost) || 0;

    const finalNetWt =
      bookedWt + weightAdj;

    const stoneWt =
      Number(order.stoneWeight) || 0;

    const grossWt =
      Number(order.grossWeight) ||
      finalNetWt + stoneWt;

    const rate =
      Number(order.liveRate) || 0;

    const vaPer =
      Number(order.vaPercentage) || 0;

    const stoneCost =
      Number(order.stoneCost) || 0;

    // TOTAL EXCHANGE DEDUCTION used by receipt calculations.
    //
    // Existing discountAmount = GOLD exchange value.
    // silverExchangeValue = SILVER exchange value.
    //
    // IMPORTANT: use BOTH here. Previously the receipt used only
    // discountAmount, so Silver Exchange was displayed but was not
    // deducted from Payable After Exchange / Balance Due.
    const exchangeValue =
      roundMoneyValue(
        getGoldExchangeValue(order) +
          getSilverExchangeValue(order)
      );

    // ============================================================
    // PRICING MODE
    //
    // Works for:
    // - Gold all carats
    // - Silver all purities
    // - GRAMS pricing
    // - PIECE pricing
    //
    // Do NOT hard-code 22K, 18K, 92.5 etc.
    // ============================================================

    const pricingMode =
      String(
        order.pricingMode || "GRAMS"
      ).toUpperCase();

    const isPieceCostOrder =
      pricingMode === "PIECE";

    // ============================================================
    // 1. METAL / PIECE VALUE
    // ============================================================

    const metalValue =
      isPieceCostOrder
        ? Math.max(
            0,
            Number(order.pieceCost) || 0
          )
        : bookedWt * rate;

    // ============================================================
    // 2. VA
    // ============================================================

    const vaAmount =
      isPieceCostOrder
        ? 0
        : metalValue * (vaPer / 100);

    // ============================================================
    // 3. STONE COST
    //
    // Added exactly ONCE.
    // ============================================================

    const gstTaxableBase =
      roundMoneyValue(
        Math.max(
          0,
          metalValue +
            vaAmount +
            stoneCost
        )
      );

    // ============================================================
    // 4. GST AFTER STONE COST
    // ============================================================

    const gstAmount =
      roundMoneyValue(
        gstTaxableBase * 0.03
      );

    // ============================================================
    // 5. ORIGINAL BILL BEFORE +/- ADJUSTMENT
    //
    // Metal/Piece
    // + VA
    // + Stone
    // + GST
    // ============================================================

    const amountBeforeAdjustment =
      roundMoneyValue(
        gstTaxableBase +
          gstAmount
      );

    // ============================================================
    // 6. APPLY WEIGHT / AMOUNT ADJUSTMENT ONCE
    //
    // Example:
    //
    // 169,641
    // -   710
    // --------
    // 168,931
    // ============================================================

    const adjustedAmountBeforeExchange =
      roundMoneyValue(
        Math.max(
          0,
          amountBeforeAdjustment +
            adjustmentCost
        )
      );

    // ============================================================
    // 7. DEDUCT TOTAL JEWELLERY EXCHANGE
    //
    // totalExchange =
    // Gold Exchange Value + Silver Exchange Value
    //
    // Example:
    //
    // 12,360
    // -2,360 Silver Exchange
    // -------
    // 10,000
    // ============================================================

    const payableAfterExchange =
      roundMoneyValue(
        Math.max(
          0,
          adjustedAmountBeforeExchange -
            exchangeValue
        )
      );

    // ============================================================
    // PAYMENT CALCULATION
    //
    // IMPORTANT:
    //
    // DO NOT USE:
    // getAdjustedPaymentRows(order)
    //
    // Because adjustmentCost was ALREADY applied above.
    //
    // The top calculation is now the ONLY source of truth.
    // ============================================================

    const rawPayments: any[] =
      (getOrderPayments(order) || []).map(
        (payment: any) => ({
          ...payment,
          amount: Math.max(
            0,
            Number(payment.amount || 0)
          ),
        })
      );

    let payments: any[] =
      rawPayments.map((payment: any) => ({
        ...payment,
      }));
    // ============================================================
    // DELIVERY / FINAL SETTLEMENT
    // ============================================================
    // IMPORTANT: never rewrite the last row.
    // A final settlement may contain several rows (Cash + UPI + Card + Check).
    // The API already stores the exact final split, so the receipt prints those
    // rows exactly as recorded.
    // ============================================================

    // ============================================================
    // TOTAL CASH / UPI / CARD / CHEQUE PAID
    // ============================================================

    const totalMoneyPaid =
      roundMoneyValue(
        payments.reduce(
          (
            total: number,
            payment: any
          ) =>
            total +
            Math.max(
              0,
              Number(
                payment.amount || 0
              )
            ),
          0
        )
      );

    // ============================================================
    // TOTAL CLEARED INCLUDING GOLD + SILVER EXCHANGE
    // ============================================================

    const totalPaidCleared =
      roundMoneyValue(
        totalMoneyPaid +
          exchangeValue
      );

    // ============================================================
    // FINAL BALANCE
    //
    // IMPORTANT:
    //
    // Use PAYABLE AFTER EXCHANGE.
    //
    // Do NOT subtract exchange again here.
    //
    // payableAfterExchange
    // - money paid
    // = balance
    // ============================================================

    const balance =
      roundMoneyValue(
        Math.max(
          0,
          payableAfterExchange -
            totalMoneyPaid
        )
      );

    // ============================================================
    // HEADER
    // ============================================================

    const HDR_Y =
      SAFE_TOP + 10;

    const typeLabel =
      type === "DELIVERY"
        ? "DELIVERY CONFIRMATION"
        : "BOOKING RECEIPT";

    draw(
      typeLabel,
      MARGIN_L,
      HDR_Y,
      9.5,
      black
    );

    drawR(
      `Order: ${order.orderId}`,
      MARGIN_R,
      HDR_Y,
      8,
      grey
    );

    drawR(
      `Date: ${format(
        new Date(),
        "dd-MM-yyyy"
      )}`,
      MARGIN_R,
      HDR_Y + 12,
      7.5,
      grey
    );

    hLine(HDR_Y + 26);

    // ============================================================
    // CUSTOMER
    // ============================================================

    const CUST_Y =
      HDR_Y + 38;

    draw(
      "CUSTOMER",
      MARGIN_L,
      CUST_Y,
      7.5,
      grey
    );

    draw(
      order.customerName || "",
      MARGIN_L,
      CUST_Y + 11,
      8.5,
      black
    );

    draw(
      `Ph: +91 ${
        order.phoneNumber || ""
      }`,
      MARGIN_L,
      CUST_Y + 22,
      7.5,
      grey
    );

    const customerAddress = String(order.address || "").trim();
    if (customerAddress) {
      const shortAddress =
        customerAddress.length > 68
          ? `${customerAddress.slice(0, 65)}...`
          : customerAddress;
      draw(`Address: ${shortAddress}`, MARGIN_L, CUST_Y + 32, 7, grey);
    }

    hLine(CUST_Y + (customerAddress ? 43 : 32));

    // ============================================================
    // ITEM TABLE
    // ============================================================

    const TBL_Y =
      CUST_Y + (customerAddress ? 61 : 50);

    const col = {
      name: MARGIN_L,
      gross: 130,
      stone: 185,
      net: 245,
      va: 305,
      total: MARGIN_R,
    };

    draw(
      "ITEM",
      col.name,
      TBL_Y,
      7,
      grey
    );

    draw(
      "GROSS",
      col.gross,
      TBL_Y,
      7,
      grey
    );

    draw(
      "STONE",
      col.stone,
      TBL_Y,
      7,
      grey
    );

    draw(
      isPieceCostOrder
        ? "PIECE COST"
        : "NET",
      col.net,
      TBL_Y,
      7,
      grey
    );

    draw(
      "VA",
      col.va,
      TBL_Y,
      7,
      grey
    );

    drawR(
      "AMOUNT",
      col.total,
      TBL_Y,
      7,
      grey
    );

    hLine(TBL_Y + 9);

    const ROW_Y =
      TBL_Y + 19;

    draw(
      order.itemName ||
        "Custom Item",
      col.name,
      ROW_Y,
      7.5,
      black
    );

    draw(
      `${grossWt}g`,
      col.gross,
      ROW_Y,
      7.5,
      black
    );

    draw(
      `${stoneWt}g`,
      col.stone,
      ROW_Y,
      7.5,
      black
    );

    draw(
      isPieceCostOrder
        ? `₹${Math.round(
            Number(
              order.pieceCost || 0
            )
          ).toLocaleString()}`
        : `${bookedWt}g`,
      col.net,
      ROW_Y,
      7.5,
      black
    );

    draw(
      `₹${Math.round(
        vaAmount
      ).toLocaleString()}`,
      col.va,
      ROW_Y,
      7.5,
      black
    );

    // Original bill BEFORE adjustment/exchange.
    drawR(
      `₹${Math.round(
        amountBeforeAdjustment
      ).toLocaleString()}`,
      col.total,
      ROW_Y,
      7.5,
      black
    );

    hLine(ROW_Y + 13);

    // ============================================================
    // CART SUMMARY
    // ============================================================

    let cursorY =
      ROW_Y + 22;

    draw(
      "CART SUMMARY",
      MARGIN_L,
      cursorY,
      7.5,
      grey
    );

    hLine(cursorY + 8);

    const cartRow = (
      label: string,
      value: string,
      y: number,
      valueColor = black
    ) => {
      draw(
        label,
        MARGIN_L,
        y,
        6.5,
        grey
      );

      drawR(
        value,
        MARGIN_R,
        y,
        6.5,
        valueColor
      );
    };

    let offset = 14;

    // ============================================================
    // METAL / PIECE VALUE
    // ============================================================

    cartRow(
      isPieceCostOrder
        ? "Piece Cost"
        : "Metal Value",
      `₹${Math.round(
        metalValue
      ).toLocaleString()}`,
      cursorY + offset
    );

    offset += 7;

    // ============================================================
    // PRICING BASIS
    // ============================================================

    const metalName =
      String(
        order.metalType || ""
      ).toUpperCase();

    const purityName =
      String(
        order.purity || ""
      );


    // ============================================================
    // VA
    // ============================================================

    cartRow(
      "VA",
      isPieceCostOrder
        ? "₹0 (Not Applied)"
        : `₹${Math.round(
            vaAmount
          ).toLocaleString()}`,
      cursorY + offset
    );

    offset += 7;

    // ============================================================
    // STONE
    // ============================================================

    cartRow(
      "Stone Cost",
      `+₹${Math.round(
        stoneCost
      ).toLocaleString()}`,
      cursorY + offset,
      gold
    );

    offset += 7;

    // ============================================================
    // GST TAXABLE BASE
    // ============================================================

    cartRow(
      "GST Taxable Base",
      `₹${Math.round(
        gstTaxableBase
      ).toLocaleString()}`,
      cursorY + offset
    );

    offset += 7;

    // ============================================================
    // GST
    // ============================================================

    cartRow(
      "GST (3%)",
      `+₹${Math.round(
        gstAmount
      ).toLocaleString()}`,
      cursorY + offset
    );

    offset += 7;

    // ============================================================
    // ORIGINAL AMOUNT
    // ============================================================

    cartRow(
      "Amount Before Adjustment",
      `₹${Math.round(
        amountBeforeAdjustment
      ).toLocaleString()}`,
      cursorY + offset,
      emerald
    );

    offset += 7;

    // ============================================================
    // WEIGHT / MONEY ADJUSTMENT
    // ============================================================

    if (
      weightAdj !== 0 ||
      adjustmentCost !== 0
    ) {
      const adjustmentSign =
        adjustmentCost > 0
          ? "+"
          : adjustmentCost < 0
            ? "-"
            : "";

      const adjustmentColor =
        adjustmentCost > 0
          ? rose
          : adjustmentCost < 0
            ? emerald
            : black;

      cartRow(
        `Weight Adjustment (${
          weightAdj > 0
            ? "+"
            : ""
        }${weightAdj}g)`,
        `${adjustmentSign}₹${Math.round(
          Math.abs(
            adjustmentCost
          )
        ).toLocaleString()}`,
        cursorY + offset,
        adjustmentColor
      );

      offset += 7;
    }

    // ============================================================
    // ADJUSTED AMOUNT
    // ============================================================

    cartRow(
      "Adjusted Amount Before Exchange",
      `₹${Math.round(
        adjustedAmountBeforeExchange
      ).toLocaleString()}`,
      cursorY + offset,
      emerald
    );

    offset += 7;

    // ============================================================
    // JEWELLERY EXCHANGE
    // ============================================================

    const goldExchangeValue = getGoldExchangeValue(order);
    const silverExchangeValue = getSilverExchangeValue(order);

    if (goldExchangeValue > 0) {
      cartRow(
        `Gold Exchange [${
          order.exchangeJewelleryName || "N/A"
        }]`,
        `-₹${Math.round(goldExchangeValue).toLocaleString()}`,
        cursorY + offset,
        gold
      );
      offset += 7;
    }

    if (silverExchangeValue > 0) {
      cartRow(
        `Silver Exchange [${
          order.silverExchangeJewelleryName || "N/A"
        }]`,
        `-₹${Math.round(silverExchangeValue).toLocaleString()}`,
        cursorY + offset,
        grey
      );
      offset += 7;
    }

    // ============================================================
    // FINAL PAYABLE AFTER EXCHANGE
    // ============================================================

    cartRow(
      "Payable After Exchange",
      `₹${Math.round(
        payableAfterExchange
      ).toLocaleString()}`,
      cursorY + offset,
      emerald
    );

    offset += 7;

    hLine(
      cursorY +
        offset +
        6
    );

    cursorY =
      cursorY +
      offset +
      6;

    // ============================================================
    // ROW HELPER
    // ============================================================

    const finRow = (
      label: string,
      value: string,
      y: number,
      color = black
    ) => {
      draw(
        label,
        MARGIN_L,
        y,
        6.5,
        grey
      );

      drawR(
        value,
        MARGIN_R,
        y,
        6.5,
        color
      );
    };

    // ============================================================
    // WEIGHT DETAILS
    // ============================================================

    cursorY += 10;

    draw(
      "WEIGHT DETAILS",
      MARGIN_L,
      cursorY,
      7.5,
      grey
    );

    hLine(cursorY + 8);

    finRow(
      "Required (Booked / Pricing Weight)",
      `${bookedWt}g`,
      cursorY + 14
    );

    finRow(
      "Weight Adjustment",
      `${
        weightAdj > 0
          ? "+"
          : ""
      }${weightAdj}g`,
      cursorY + 21,
      weightAdj > 0
        ? rose
        : weightAdj < 0
          ? emerald
          : black
    );

    finRow(
      "Adjustment Amount",
      `${
        adjustmentCost > 0
          ? "+"
          : adjustmentCost < 0
            ? "-"
            : ""
      }₹${Math.round(
        Math.abs(
          adjustmentCost
        )
      ).toLocaleString()}`,
      cursorY + 28,
      adjustmentCost > 0
        ? rose
        : adjustmentCost < 0
          ? emerald
          : black
    );

    finRow(
      "Final Physical Net Weight",
      `${finalNetWt}g`,
      cursorY + 35
    );

    hLine(cursorY + 41);

    cursorY += 41;

    // ============================================================
    // PAYMENT HISTORY
    // ============================================================

    cursorY += 10;

    draw(
      "PAYMENT HISTORY",
      MARGIN_L,
      cursorY,
      7.5,
      grey
    );

    hLine(cursorY + 8);

    cursorY += 8;

    let payLineY =
      cursorY + 6;

    // ============================================================
    // SHOW FINAL ADJUSTED BILL BEFORE EXCHANGE
    // ============================================================

    finRow(
      "Adjusted Amount Before Exchange",
      `₹${Math.round(
        adjustedAmountBeforeExchange
      ).toLocaleString()}`,
      payLineY,
      black
    );

    payLineY += 7;

    // Also show the actual payable after exchange.
    finRow(
      "Payable After Exchange",
      `₹${Math.round(
        payableAfterExchange
      ).toLocaleString()}`,
      payLineY,
      emerald
    );

    payLineY += 9;

    // ============================================================
    // PAYMENT ROWS
    // ============================================================

    if (payments.length > 0) {
      payments.forEach(
        (
          payment: any,
          index: number
        ) => {
          const dateStr =
            payment.paidAt
              ? format(
                  new Date(
                    payment.paidAt
                  ),
                  "dd MMM yy"
                )
              : "Payment";

          const modeLabel =
            paymentModeLabel(
              payment.mode ||
                payment.paymentMode
            );

          const ref =
            payment.checkNumber ||
            payment.referenceNumber;

          const isFinalSettlement =
            type === "DELIVERY" &&
            String(payment.note || "").toLowerCase().includes("final settlement");

          const label =
            `${modeLabel} • ${dateStr}` +
            `${
              ref
                ? ` • ${ref}`
                : ""
            }` +
            `${
              isFinalSettlement
                ? " • Settlement"
                : ""
            }`;

          finRow(
            label,
            `₹${Math.round(
              Number(
                payment.amount || 0
              )
            ).toLocaleString()}`,
            payLineY,
            isFinalSettlement
              ? gold
              : black
          );

          payLineY += 7;
        }
      );
    } else {
      finRow(
        "No payment received yet",
        "₹0",
        payLineY,
        grey
      );

      payLineY += 7;
    }

    // ============================================================
    // TOTAL MONEY PAID
    // ============================================================

    hLine(payLineY + 1);

    payLineY += 8;

    finRow(
      "Total Amount Paid",
      `₹${Math.round(
        totalMoneyPaid
      ).toLocaleString()}`,
      payLineY,
      emerald
    );

    payLineY += 8;

    const receiptModeTotals = payments.reduce(
      (acc: Record<PaymentMode, number>, payment: any) => {
        const mode = String(payment.mode || "").toUpperCase() as PaymentMode;
        if (mode in acc) {
          acc[mode] = roundMoneyValue(
            acc[mode] + Math.max(0, Number(payment.amount) || 0)
          );
        }
        return acc;
      },
      { CASH: 0, UPI: 0, CARD: 0, CHECK: 0 }
    );

    (["CASH", "UPI", "CARD", "CHECK"] as PaymentMode[]).forEach((mode) => {
      if (receiptModeTotals[mode] > 0) {
        finRow(
          `${paymentModeLabel(mode)} Total`,
          `₹${Math.round(receiptModeTotals[mode]).toLocaleString()}`,
          payLineY,
          black
        );
        payLineY += 7;
      }
    });

    // ============================================================
    // EXCHANGE
    // ============================================================

    if (goldExchangeValue > 0) {
      finRow(
        `Gold Exchange [${
          order.exchangeJewelleryName || "N/A"
        }]`,
        `₹${Math.round(goldExchangeValue).toLocaleString()}`,
        payLineY,
        emerald
      );
      payLineY += 8;
    }

    if (silverExchangeValue > 0) {
      finRow(
        `Silver Exchange [${
          order.silverExchangeJewelleryName || "N/A"
        }]`,
        `₹${Math.round(silverExchangeValue).toLocaleString()}`,
        payLineY,
        emerald
      );
      payLineY += 8;
    }

    // ============================================================
    // TOTAL PAID / CLEARED
    //
    // This should equal adjustedAmountBeforeExchange
    // when fully settled.
    // ============================================================

    finRow(
      "Total Paid / Cleared",
      `₹${Math.round(
        totalPaidCleared
      ).toLocaleString()}`,
      payLineY,
      emerald
    );

    payLineY += 8;

    hLine(payLineY);

    payLineY += 8;

    // ============================================================
    // BALANCE
    // ============================================================

    if (balance <= 0) {
      finRow(
        "Balance Due",
        "₹0 — FULLY PAID",
        payLineY,
        emerald
      );
    } else {
      finRow(
        "Balance Due",
        `₹${Math.round(
          balance
        ).toLocaleString()}`,
        payLineY,
        rose
      );
    }

    hLine(payLineY + 7);

    cursorY =
      payLineY + 7;

    // ============================================================
    // SETTLEMENT BOX
    // ============================================================

    const settBoxW = 160;
    const settBoxH = 45;

    const settBoxX =
      MARGIN_R -
      settBoxW;

    const SETT_TOP_Y =
      cursorY + 10;

    const settBoxBottomY =
      A5_H -
      SETT_TOP_Y -
      settBoxH;

    page.drawRectangle({
      x: settBoxX,
      y: settBoxBottomY,
      width: settBoxW,
      height: settBoxH,
      color: rgb(
        0.98,
        0.95,
        0.88
      ),
      borderColor:
        balance <= 0
          ? emerald
          : gold,
      borderWidth: 1.2,
    });

    page.drawText(
      "SETTLEMENT",
      {
        x: settBoxX + 10,
        y:
          settBoxBottomY +
          23,
        size: 7,
        font: customFont,
        color: grey,
      }
    );

    if (balance <= 0) {
      const text =
        "FULLY PAID";

      const textWidth =
        customFont.widthOfTextAtSize(
          text,
          10
        );

      page.drawText(
        text,
        {
          x:
            settBoxX +
            (settBoxW -
              textWidth) /
              2,
          y:
            settBoxBottomY +
            6,
          size: 10,
          font: customFont,
          color: emerald,
        }
      );
    } else {
      const text =
        `₹${Math.round(
          balance
        ).toLocaleString()} Pending`;

      const textWidth =
        customFont.widthOfTextAtSize(
          text,
          9
        );

      page.drawText(
        text,
        {
          x:
            settBoxX +
            (settBoxW -
              textWidth) /
              2,
          y:
            settBoxBottomY +
            6,
          size: 9,
          font: customFont,
          color: gold,
        }
      );
    }

    // ============================================================
    // SAVE PDF
    // ============================================================

    const pdfBytes =
      await pdfDoc.save();

    const blob =
      new Blob(
        [
          new Uint8Array(
            pdfBytes
          ),
        ],
        {
          type: "application/pdf",
        }
      );

    const pdfUrl =
      URL.createObjectURL(
        blob
      );

    // ============================================================
    // DOWNLOAD / PRINT
    // ============================================================

    if (mode === "download") {
      const link =
        document.createElement(
          "a"
        );

      link.href = pdfUrl;

      link.download =
        `${type}_${order.orderId}_${format(
          new Date(),
          "ddMMyy"
        )}.pdf`;

      link.click();
    } else {
      const printWindow =
        window.open(pdfUrl);

      if (printWindow) {
        printWindow.addEventListener(
          "load",
          () =>
            printWindow.print()
        );
      }
    }
  } catch (error) {
    console.error(
      "Order PDF Error:",
      error
    );
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
    const isSilver925 =
      metalType === "SILVER" &&
      String(form.purity) === "92.5";

    const isPieceCost =
      isSilver925 &&
      form.pricingMode === "PIECE";

    const netWeight = isPieceCost
      ? 0
      : Math.max(0, Number(form.requiredGrams) || 0);

    const stoneW = Math.max(0, Number(form.stoneWeight) || 0);
    const rate = isPieceCost ? 0 : Math.max(0, Number(form.liveRate) || 0);
    const vaPer = isPieceCost ? 0 : Math.max(0, Number(form.vaPercentage) || 0);
    const pieceCost = isPieceCost ? Math.max(0, Number(form.pieceCost) || 0) : 0;
    const sCost = Math.max(0, Number(form.stoneCost) || 0);
    const goldExchangeValue = Math.max(0, Number(form.discountAmount) || 0);
    const silverExchangeValue = form.hasSilverExchange
      ? Math.max(0, Number(form.silverExchangeValue) || 0)
      : 0;
    const totalExchangeValue = roundMoneyValue(
      goldExchangeValue + silverExchangeValue
    );
    const advance = getSplitTotal(initialPaymentSplits);

    const roundMoney = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    // GRAMS MODE:
    // Metal Value = grams × live rate, VA applies.
    //
    // PIECE MODE (Silver 92.5 only):
    // Metal Value = piece cost directly, VA = 0.
    const metalValue = roundMoney(
      isPieceCost
        ? pieceCost
        : netWeight * rate
    );

    const vaAmount = isPieceCost
      ? 0
      : roundMoney(metalValue * (vaPer / 100));

    // Original Cart Value is based only on Metal Value + VA + GST.
    // Stone Cost is added only at the final payable stage.
    const gstTaxableBase = roundMoney(
      metalValue + vaAmount
    );

    const gstAmount = roundMoney(gstTaxableBase * 0.03);
    const originalCartValue = roundMoney(gstTaxableBase + gstAmount);

    // Final payable:
    // Original Cart - Exchange + Stone Cost.
    const totalWithGST = roundMoney(
      Math.max(
        0,
        originalCartValue -
          totalExchangeValue +
          sCost
      )
    );

    const normalizedAdvance =
      advance > totalWithGST &&
      Math.abs(advance - Math.round(totalWithGST)) < 0.01
        ? totalWithGST
        : advance;

    const balanceAmount = roundMoney(
      Math.max(0, totalWithGST - normalizedAdvance)
    );

    return {
      isSilver925,
      isPieceCost,
      pricingMode: isPieceCost ? "PIECE" : "GRAMS",
      pieceCost,
      netWeight,
      metalValue,
      goldValue: metalValue, // backward-compatible alias used by existing UI
      vaAmount,
      discount: goldExchangeValue,
      goldExchangeValue,
      silverExchangeValue,
      totalExchangeValue,
      gstTaxableBase,
      gstAmount,
      totalWithGST,
      balanceAmount,
      stoneCost: sCost,
      originalCartValue,
      grossWeight: netWeight + stoneW,
    };
  }, [form, metalType, initialPaymentSplits]);

  const handleSubmit = async () => {
    if (!form.customerName || form.phoneNumber.length < 10) {
      return alert("Complete Customer Name and provide 10-digit phone number.");
    }
    if (totals.isPieceCost) {
      if (!form.pieceCost || Number(form.pieceCost) <= 0) {
        return alert("Enter the Piece Cost for 92.5 silver.");
      }
    } else if (!form.requiredGrams || Number(form.requiredGrams) <= 0) {
      return alert("Enter the grams required to make this item.");
    }

    const enteredAdvance = getSplitTotal(initialPaymentSplits);
    const normalizedAdvance = enteredAdvance;

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
          pricingMode: totals.pricingMode,
          pieceCost: totals.pieceCost,
          netWeight: totals.netWeight,
          liveRate: totals.isPieceCost ? 0 : Number(form.liveRate || 0),
          vaPercentage: totals.isPieceCost ? 0 : Number(form.vaPercentage || 0),
          discountAmount: totals.goldExchangeValue,
          silverExchangeJewelleryName: form.hasSilverExchange
            ? form.silverExchangeJewelleryName
            : "",
          silverExchangeJewelleryGrams: form.hasSilverExchange
            ? Number(form.silverExchangeJewelleryGrams || 0)
            : 0,
          silverExchangeValue: totals.silverExchangeValue,
          grossWeight: totals.grossWeight,
          gstAmount: totals.gstAmount,
          originalCartValue: totals.originalCartValue,
          totalAmount: totals.totalWithGST,
          advanceCash: normalizedAdvance,
          balanceAmount: Math.max(0, totals.totalWithGST - normalizedAdvance),
          initialPayments: toPaymentPayload(initialPaymentSplits, "Initial payment"),
        }),
      });

      if (res.ok) {
        setToastMsg("Order Registry Updated!");
        setShowToast(true);
        setIsFormOpen(false);
        setForm({
          customerName: "", phoneNumber: "", address: "", itemName: "", itemDescription: "",
          exchangeJewelleryName: "", exchangeJewelleryGrams: "",
          hasSilverExchange: false, silverExchangeJewelleryName: "",
          silverExchangeJewelleryGrams: "", silverExchangeValue: "",
          purity: "22", pricingMode: "GRAMS", pieceCost: "", liveRate: "", requiredGrams: "",
          stoneWeight: "", vaPercentage: "", stoneCost: "", discountAmount: "",
          advanceCash: "", advancePaymentMode: "CASH", advanceReferenceNumber: "",
          advanceBankName: "", advanceCheckNumber: "", deadlineDate: "",
        });
        setInitialPaymentSplits([]);
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create order.");
      }
    } catch (err) { console.error("SUBMIT_ERROR", err); }
    finally { setIsSubmitting(false); }
  };

  const resetPaymentDialog = () => {
    setPaymentSplits([]);
    setPaymentNote("");
    setPaymentPurpose("ADD");
  };

  const openAddPaymentDialog = () => {
    resetPaymentDialog();
    setPaymentPurpose("ADD");
    setIsPaymentOpen(true);
  };

  const openSettlementDialog = () => {
    if (!viewingOrder) return;
    const remaining = getFinalBalanceDue(viewingOrder);
    resetPaymentDialog();
    setPaymentPurpose("SETTLE");

    // If already completely paid, delivery can be confirmed with no payment rows.
    if (remaining <= 0.01) {
      handleIssueOrderToClient([]);
      return;
    }

    setIsPaymentOpen(true);
  };

  const handleIssueOrderToClient = async (splits: PaymentSplit[] = paymentSplits) => {
    if (!viewingOrder) return;

    const required = getFinalBalanceDue(viewingOrder);
    const settlementTotal = getSplitTotal(splits);

    if (required > 0.01 && Math.abs(settlementTotal - required) > 0.01) {
      return alert(
        `Final settlement split must exactly equal ₹${required.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`
      );
    }

    const invalidCheck = splits.find(
      (split) =>
        split.mode === "CHECK" &&
        Number(split.amount || 0) > 0 &&
        !split.checkNumber.trim()
    );
    if (invalidCheck) return alert("Enter the check number for the check payment.");

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/issue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: viewingOrder.id,
          payments: toPaymentPayload(splits, "Final settlement at pickup"),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const deliveredOrder = { ...viewingOrder, ...data.order, status: "DELIVERED" };

        // The API has now stored every settlement split as a real Payment row.
        // Therefore the delivered order must calculate to exactly zero.
        if (getFinalBalanceDue(deliveredOrder) > 0.01) {
          console.error("SETTLEMENT_INVARIANT_FAILED", deliveredOrder);
          return alert("Settlement was saved, but the returned balance is not zero. Please refresh before printing.");
        }

        setToastMsg("Payment Settled & Item Delivered!");
        setShowToast(true);
        setIsPaymentOpen(false);
        resetPaymentDialog();

        await handleOrderReceipt(deliveredOrder, "download", "DELIVERY");

        setViewingOrder(null);
        fetchOrders();
      } else {
        alert(data.error || "Failed to settle order.");
      }
    } catch (err) {
      console.error("ISSUE_ERROR", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!viewingOrder) return;

    const editableKeys = [
      "customerName", "phoneNumber", "address", "itemName", "itemDescription",
      "metalType", "purity", "pricingMode", "pieceCost", "liveRate",
      "netWeight", "stoneWeight", "vaPercentage", "stoneCost",
      "discountAmount", "exchangeJewelleryName", "exchangeJewelleryGrams",
      "silverExchangeJewelleryName", "silverExchangeJewelleryGrams", "silverExchangeValue",
      "weightAdjustmentGrams", "adjustmentCost", "deadlineDate",
    ] as const;

    const numericKeys = new Set([
      "pieceCost", "liveRate", "netWeight", "stoneWeight", "vaPercentage",
      "stoneCost", "discountAmount", "exchangeJewelleryGrams",
      "silverExchangeJewelleryGrams", "silverExchangeValue",
      "weightAdjustmentGrams", "adjustmentCost",
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

      if (String(nextValue ?? "") !== String(currentValue ?? "")) {
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
        body: JSON.stringify({ orderId: viewingOrder.id, ...changedFields }),
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

    if (paymentPurpose === "SETTLE") {
      await handleIssueOrderToClient(paymentSplits);
      return;
    }

    const amt = getSplitTotal(paymentSplits);
    if (amt <= 0) return alert("Select at least one payment mode and enter an amount.");

    const currentBalance = getFinalBalanceDue(viewingOrder);
    if (amt > currentBalance + 0.01) {
      return alert(
        `Payment cannot be greater than the current balance ₹${currentBalance.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`
      );
    }

    const invalidCheck = paymentSplits.find(
      (split) =>
        split.mode === "CHECK" &&
        Number(split.amount || 0) > 0 &&
        !split.checkNumber.trim()
    );
    if (invalidCheck) return alert("Enter the check number for the check payment.");

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId: viewingOrder.id,
          payments: toPaymentPayload(paymentSplits, paymentNote || "Order payment"),
          note: paymentNote,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setViewingOrder(data.order);
        setToastMsg(`Payment of ₹${amt.toLocaleString("en-IN")} recorded`);
        setShowToast(true);
        setIsPaymentOpen(false);
        resetPaymentDialog();
        fetchOrders();
      } else {
        alert(data.error || "Failed to record payment.");
      }
    } catch (err) {
      console.error("PAYMENT_ERROR", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SEARCH, DATE FILTERS & DASHBOARD SUMMARY
  // ---------------------------------------------------------------------------
  const formatDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const applyDatePreset = (
    preset: "DAY" | "WEEK" | "MONTH" | "YEAR" | "OVERALL" | "CUSTOM"
  ) => {
    setDatePreset(preset);

    if (preset === "CUSTOM") return;

    if (preset === "OVERALL") {
      setFromDate("");
      setToDate("");
      return;
    }

    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let start = new Date(end);

    if (preset === "WEEK") {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
    } else if (preset === "MONTH") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === "YEAR") {
      start = new Date(today.getFullYear(), 0, 1);
    }

    setFromDate(formatDateInputValue(start));
    setToDate(formatDateInputValue(end));
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const start = parseDateInput(fromDate);
    const end = parseDateInput(toDate, true);

    return orders.filter((order) => {
      const searchableText = [
        order.orderId,
        order.customerName,
        order.phoneNumber,
        order.address,
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
        const recorded = getActualMoneyPaid(order);
        const pending = getFinalBalanceDue(order);
        const payable = getFinalPayableBeforePayments(order);

        summary.totalAmount += payable;
        summary.received += recorded;
        summary.pending += pending;
        summary.cleared += Math.max(0, payable - pending);
        summary.exchange += getExchangeValue(order);
        summary.adjustments += Number(order.adjustmentCost || 0);
        summary.count += 1;
        if (order.status === "DELIVERED") summary.delivered += 1;
        else summary.active += 1;
        return summary;
      },
      {
        totalAmount: 0,
        received: 0,
        pending: 0,
        cleared: 0,
        exchange: 0,
        adjustments: 0,
        count: 0,
        delivered: 0,
        active: 0,
      }
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
    setDatePreset("OVERALL");
  };

  // ---------------------------------------------------------------------------
  // FULL CUSTOMER / FILTERED REGISTRY PDF EXPORT
  // ---------------------------------------------------------------------------
  const handleExportRegistryPdf = async (ordersToExport: any[] = filteredOrders) => {
    if (!ordersToExport.length) {
      alert("No orders available for this filter.");
      return;
    }

    try {
      const fontBytes = await fetch("/fonts/NotoSans-VariableFont_wdth,wght.ttf").then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const font = await pdfDoc.embedFont(fontBytes);

      // A4 landscape — concise business report.
      const PAGE_W = 841.89;
      const PAGE_H = 595.28;
      const MARGIN = 22;
      const ROW_H = 24;
      const HEADER_H = 23;

      const black = rgb(0.08, 0.08, 0.08);
      const grey = rgb(0.42, 0.42, 0.42);
      const lineGrey = rgb(0.82, 0.82, 0.82);
      const soft = rgb(0.97, 0.97, 0.97);
      const gold = rgb(0.72, 0.52, 0.04);
      const emerald = rgb(0.06, 0.47, 0.23);
      const rose = rgb(0.72, 0.12, 0.12);

      const money = (value: any) =>
        `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;

      const columns = [
        ["customer", "Customer", 75],
        ["phone", "Phone", 58],
        ["total", "Total", 58],
        ["cash", "Cash", 52],
        ["upi", "UPI", 52],
        ["card", "Card", 52],
        ["check", "Check", 52],
        ["goldGrams", "Gold Ex g", 52],
        ["goldValue", "Gold Ex ₹", 58],
        ["silverGrams", "Silver Ex g", 55],
        ["silverValue", "Silver Ex ₹", 60],
        ["pending", "Pending", 58],
        ["status", "Status", 58],
      ] as const;

      const baseWidth = columns.reduce((sum, column) => sum + column[2], 0);
      const scale = (PAGE_W - MARGIN * 2) / baseWidth;
      const widths = columns.map((column) => column[2] * scale);

      const textWidth = (text: string, size = 6.4) =>
        font.widthOfTextAtSize(String(text ?? ""), size);

      const fit = (value: any, width: number, size = 6.4) => {
        const original = String(value ?? "-").replace(/\s+/g, " ").trim() || "-";
        if (textWidth(original, size) <= width) return original;
        let text = original;
        while (text.length > 1 && textWidth(`${text}…`, size) > width) {
          text = text.slice(0, -1);
        }
        return `${text}…`;
      };

      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - MARGIN;

      const drawTop = () => {
        page.drawText("SUVARNA JEWELLERS — CUSTOMER ORDER REPORT", {
          x: MARGIN,
          y,
          size: 12,
          font,
          color: black,
        });

        const rangeLabel =
          datePreset === "OVERALL"
            ? "Overall"
            : `${datePreset === "CUSTOM" ? "Custom" : datePreset}: ${fromDate || "Beginning"} to ${toDate || "Today"}`;

        page.drawText(
          `${rangeLabel} | Status: ${statusFilter} | Generated: ${format(new Date(), "dd MMM yyyy, h:mm a")}`,
          {
            x: MARGIN,
            y: y - 16,
            size: 6.8,
            font,
            color: grey,
          }
        );

        y -= 34;
      };

      const drawHeader = () => {
        let x = MARGIN;
        page.drawRectangle({
          x: MARGIN,
          y: y - HEADER_H + 4,
          width: PAGE_W - MARGIN * 2,
          height: HEADER_H,
          color: soft,
          borderColor: gold,
          borderWidth: 0.7,
        });

        columns.forEach((column, index) => {
          const width = widths[index];
          page.drawText(fit(column[1], width - 4, 6), {
            x: x + 2,
            y: y - 9,
            size: 6,
            font,
            color: black,
          });
          x += width;
        });

        y -= HEADER_H;
      };

      const newPage = () => {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        drawTop();
        drawHeader();
      };

      drawTop();
      drawHeader();

      ordersToExport.forEach((order, index) => {
        if (y - ROW_H < 125) newPage();

        const modes = getPaymentModeTotals([order]);

        const row = {
          customer: order.customerName || "-",
          phone: order.phoneNumber || "-",
          total: money(getFinalPayableBeforePayments(order)),
          cash: money(modes.CASH),
          upi: money(modes.UPI),
          card: money(modes.CARD),
          check: money(modes.CHECK),
          goldGrams: `${Number(order.exchangeJewelleryGrams || 0).toFixed(3)}g`,
          goldValue: money(getGoldExchangeValue(order)),
          silverGrams: `${Number(order.silverExchangeJewelleryGrams || 0).toFixed(3)}g`,
          silverValue: money(getSilverExchangeValue(order)),
          pending: money(getFinalBalanceDue(order)),
          status: order.status || "-",
        };

        if (index % 2 === 1) {
          page.drawRectangle({
            x: MARGIN,
            y: y - ROW_H + 3,
            width: PAGE_W - MARGIN * 2,
            height: ROW_H,
            color: rgb(0.992, 0.992, 0.992),
          });
        }

        let x = MARGIN;
        columns.forEach((column, columnIndex) => {
          const width = widths[columnIndex];
          const key = column[0] as keyof typeof row;
          page.drawText(fit(row[key], width - 4), {
            x: x + 2,
            y: y - 10,
            size: 6.4,
            font,
            color:
              key === "pending" && getFinalBalanceDue(order) > 0
                ? rose
                : key === "status" && order.status === "DELIVERED"
                ? emerald
                : black,
          });
          x += width;
        });

        page.drawLine({
          start: { x: MARGIN, y: y - ROW_H + 3 },
          end: { x: PAGE_W - MARGIN, y: y - ROW_H + 3 },
          thickness: 0.3,
          color: lineGrey,
        });

        y -= ROW_H;
      });

      if (y < 210) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }

      const paymentTotals = getPaymentModeTotals(ordersToExport);
      const summary = ordersToExport.reduce(
        (acc, order) => {
          acc.total += getFinalPayableBeforePayments(order);
          acc.pending += getFinalBalanceDue(order);
          acc.goldGrams += Math.max(0, Number(order.exchangeJewelleryGrams) || 0);
          acc.goldValue += getGoldExchangeValue(order);
          acc.silverGrams += Math.max(0, Number(order.silverExchangeJewelleryGrams) || 0);
          acc.silverValue += getSilverExchangeValue(order);
          return acc;
        },
        {
          total: 0,
          pending: 0,
          goldGrams: 0,
          goldValue: 0,
          silverGrams: 0,
          silverValue: 0,
        }
      );

      const totalReceived =
        paymentTotals.CASH +
        paymentTotals.UPI +
        paymentTotals.CARD +
        paymentTotals.CHECK +
        paymentTotals.untracked;

      const cleared = Math.max(0, summary.total - summary.pending);

      y -= 12;
      page.drawText("OVERALL SUMMARY", {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: gold,
      });
      y -= 18;

      const rows = [
        ["Overall Order Amount", money(summary.total)],
        ["Cash", money(paymentTotals.CASH)],
        ["UPI", money(paymentTotals.UPI)],
        ["Card", money(paymentTotals.CARD)],
        ["Check", money(paymentTotals.CHECK)],
        ["Total Money Received", money(totalReceived)],
        ["Cleared Amount", money(cleared)],
        ["Pending Amount", money(summary.pending)],
        ["Gold Exchange Grams", `${summary.goldGrams.toFixed(3)}g`],
        ["Gold Exchange Value", money(summary.goldValue)],
        ["Silver Exchange Grams", `${summary.silverGrams.toFixed(3)}g`],
        ["Silver Exchange Value", money(summary.silverValue)],
      ];

      const boxW = (PAGE_W - MARGIN * 2 - 12) / 2;
      rows.forEach(([label, value], index) => {
        const col = index % 2;
        const rowIndex = Math.floor(index / 2);
        const x = MARGIN + col * (boxW + 12);
        const boxY = y - rowIndex * 27;

        page.drawRectangle({
          x,
          y: boxY - 19,
          width: boxW,
          height: 23,
          color: soft,
          borderColor: lineGrey,
          borderWidth: 0.5,
        });

        page.drawText(String(label), {
          x: x + 7,
          y: boxY - 11,
          size: 7,
          font,
          color: grey,
        });

        const valueText = String(value);
        page.drawText(valueText, {
          x: x + boxW - 7 - textWidth(valueText, 7.8),
          y: boxY - 11,
          size: 7.8,
          font,
          color: String(label).includes("Pending")
            ? rose
            : String(label).includes("Cleared")
            ? emerald
            : black,
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const name =
        datePreset === "OVERALL"
          ? "OVERALL"
          : `${datePreset}_${fromDate || "START"}_${toDate || "TODAY"}`;

      link.download = `ORDER_REPORT_${name}_${format(new Date(), "ddMMyy")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("REPORT_PDF_ERROR", error);
      alert("Failed to generate report PDF.");
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
        <AdminSidebar />

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
                    <p className="text-xl lg:text-2xl font-serif font-bold text-slate-900 mt-1.5">₹{Math.round(registrySummary.totalAmount).toLocaleString()}</p>
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
            <LuxuryCard className="p-5 rounded-2xl border-gold/10 bg-white space-y-4">
              {/* Main presets: always visible side by side */}
              <div className="overflow-x-auto">
                <div className="grid grid-cols-5 gap-2 min-w-[620px]">
                  {([
                    ["DAY", "Day"],
                    ["WEEK", "Week"],
                    ["MONTH", "Month"],
                    ["YEAR", "Year"],
                    ["OVERALL", "Overall"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => applyDatePreset(value)}
                      className={cn(
                        "h-11 rounded-xl border text-[10px] font-black uppercase tracking-[0.14em] transition-all",
                        datePreset === value
                          ? "bg-slate-900 text-gold border-slate-900 shadow-lg"
                          : "bg-white text-slate-500 border-slate-200 hover:border-gold/40"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing custom date filter remains available */}
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_170px_170px_170px_auto_auto] items-end gap-3">
                <div className="min-w-0">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Search Customer / Order</label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Customer, phone, order ID..."
                      className="h-11 pl-11 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "DELIVERED")}
                    className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none"
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">From Date</label>
                  <Input
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => {
                      setDatePreset("CUSTOM");
                      setFromDate(e.target.value);
                    }}
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">To Date</label>
                  <Input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => {
                      setDatePreset("CUSTOM");
                      setToDate(e.target.value);
                    }}
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={clearRegistryFilters}
                  className="h-11 rounded-xl border-slate-200 gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Clear
                </Button>

                <Button
                  type="button"
                  onClick={() => handleExportRegistryPdf(filteredOrders)}
                  disabled={!filteredOrders.length || isLoading}
                  className="h-11 rounded-xl bg-slate-900 hover:bg-black text-gold gap-2"
                >
                  <Download className="w-4 h-4" /> Report PDF
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  Showing {filteredOrders.length} of {orders.length} orders
                </p>
                <p className="text-[10px] font-bold text-gold">
                  {datePreset === "OVERALL"
                    ? "Overall records"
                    : `${datePreset === "CUSTOM" ? "Custom" : datePreset}: ${fromDate || "Beginning"} → ${toDate || "Today"}`}
                </p>
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
                          {o.address && <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">Address: {o.address}</p>}
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
                          {(o.exchangeJewelleryName || Number(o.exchangeJewelleryGrams || 0) > 0) && (
                            <p className="text-xs text-amber-600 mt-1">
                              Gold Exchange: {o.exchangeJewelleryName || "Item"} · {Number(o.exchangeJewelleryGrams || 0)}g · ₹{Number(o.discountAmount || 0).toLocaleString("en-IN")}
                            </p>
                          )}
                          {(o.silverExchangeJewelleryName || Number(o.silverExchangeJewelleryGrams || 0) > 0) && (
                            <p className="text-xs text-slate-500 mt-1">
                              Silver Exchange: {o.silverExchangeJewelleryName || "Item"} · {Number(o.silverExchangeJewelleryGrams || 0)}g · ₹{Number(o.silverExchangeValue || 0).toLocaleString("en-IN")}
                            </p>
                          )}
                          {o.payments?.length > 0 && (
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Receipt className="w-3 h-3" /> {o.payments.length} payment{o.payments.length > 1 ? "s" : ""}
                            </p>
                          )}
                          <div className={cn("flex items-center gap-1.5 text-[11px] font-bold mt-1", getFinalBalanceDue(o) <= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {getFinalBalanceDue(o) <= 0 ? <CheckCircle2 className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                            {getFinalBalanceDue(o) <= 0 ? "Payment Completed" : `Balance: ₹${getFinalBalanceDue(o).toLocaleString()}`}
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
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-1">
                  <div className="flex justify-between text-xs text-amber-800 font-bold">
                    <span>Gold Exchange</span>
                    <span>{viewingOrder?.exchangeJewelleryName || "-"}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-amber-700">
                    <span>Grams</span>
                    <span className="font-bold">{Number(viewingOrder?.exchangeJewelleryGrams || 0)}g</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-rose-600 font-bold">
                    <span>Value</span>
                    <span>-₹{Number(viewingOrder?.discountAmount || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-xs text-slate-800 font-bold">
                    <span>Silver Exchange</span>
                    <span>{viewingOrder?.silverExchangeJewelleryName || "-"}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Grams</span>
                    <span className="font-bold">{Number(viewingOrder?.silverExchangeJewelleryGrams || 0)}g</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-700 font-bold">
                    <span>Value</span>
                    <span>-₹{Number(viewingOrder?.silverExchangeValue || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-emerald-700 font-bold">
                      <span>Total Money Paid</span>
                      <span>₹{getActualMoneyPaid(viewingOrder).toLocaleString()}</span>
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
                    <p className="text-[10px] text-slate-300 uppercase font-bold mb-2">Total Money Paid</p>
                    <p className="text-2xl font-serif font-bold text-emerald-400">
                      ₹{getActualMoneyPaid(viewingOrder).toLocaleString()}
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
                      onClick={openAddPaymentDialog}
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
                  onClick={openSettlementDialog}
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

      {/* ================= SPLIT PAYMENT / FINAL SETTLEMENT DIALOG ================= */}
      <Dialog
        open={isPaymentOpen}
        onOpenChange={(open) => {
          setIsPaymentOpen(open);
          if (!open) resetPaymentDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-[2rem] p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif font-bold">
              {paymentPurpose === "SETTLE" ? "Final Settlement" : "Record Payment"} — {viewingOrder?.orderId}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-900 p-4 text-white">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Current Balance</p>
                <p className="mt-1 font-serif text-2xl font-bold text-gold">
                  ₹{getFinalBalanceDue(viewingOrder).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">
                  Selected Payments
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-emerald-800">
                  ₹{getSplitTotal(paymentSplits).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <PaymentSplitEditor
              splits={paymentSplits}
              onChange={setPaymentSplits}
              targetAmount={paymentPurpose === "SETTLE" ? getFinalBalanceDue(viewingOrder) : undefined}
              title={paymentPurpose === "SETTLE" ? "Final payment methods" : "Payment methods"}
            />

            {paymentPurpose === "ADD" && (
              <Input
                placeholder="Note (optional)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="h-12"
              />
            )}

            {paymentPurpose === "SETTLE" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                Delivery is confirmed only when the selected payment methods add up to the exact remaining balance.
                After settlement, Balance Due must be ₹0.
              </div>
            )}

            <Button
              onClick={handleRecordPayment}
              disabled={isSubmitting}
              className={cn(
                "w-full h-14 text-white rounded-2xl font-bold",
                paymentPurpose === "SETTLE"
                  ? "bg-slate-900 hover:bg-slate-800"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : paymentPurpose === "SETTLE" ? (
                "Settle Full Balance & Confirm Delivery"
              ) : (
                "Save Split Payment"
              )}
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
            <textarea
              placeholder="Customer Address"
              value={editForm.address || ""}
              onChange={(e) => handleEditChange("address", e.target.value)}
              className="w-full min-h-[90px] border border-slate-200 rounded-xl p-3 text-sm outline-none"
            />
            <Input placeholder="Item Name" value={editForm.itemName || ""} onChange={(e) => handleEditChange("itemName", e.target.value)} />

            {String(editForm.metalType || viewingOrder?.metalType || "").toUpperCase() === "SILVER" &&
             String(editForm.purity || viewingOrder?.purity || "") === "92.5" && (
              <select
                value={editForm.pricingMode || "GRAMS"}
                onChange={(e) => handleEditChange("pricingMode", e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="GRAMS">Pricing by Grams</option>
                <option value="PIECE">Direct Piece Cost</option>
              </select>
            )}

            {String(editForm.pricingMode || "GRAMS") === "PIECE" ? (
              <Input
                placeholder="Piece Cost / Metal Value (₹)"
                type="number"
                value={editForm.pieceCost || ""}
                onChange={(e) => handleEditChange("pieceCost", e.target.value)}
              />
            ) : (
              <>
                <Input placeholder="Live Rate" type="number" value={editForm.liveRate || ""} onChange={(e) => handleEditChange("liveRate", e.target.value)} />
                <Input placeholder="Grams Required (Net Weight)" type="number" step="0.001" value={editForm.netWeight || ""} onChange={(e) => handleEditChange("netWeight", e.target.value)} />
              </>
            )}
            <Input placeholder="Stone Weight (g)" type="number" value={editForm.stoneWeight || ""} onChange={(e) => handleEditChange("stoneWeight", e.target.value)} />
            <Input
              placeholder="VA %"
              type="number"
              value={String(editForm.pricingMode || "GRAMS") === "PIECE" ? 0 : (editForm.vaPercentage || "")}
              onChange={(e) => handleEditChange("vaPercentage", e.target.value)}
              disabled={String(editForm.pricingMode || "GRAMS") === "PIECE"}
            />
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
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Address</label>
                    <textarea
                      placeholder="Customer billing / delivery address"
                      value={form.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="w-full min-h-[88px] border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-gold/10"
                    />
                  </div>
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
                  <select
                    value={form.purity}
                    onChange={(e) => {
                      const nextPurity = e.target.value;
                      handleInputChange("purity", nextPurity);
                      if (!(metalType === "SILVER" && nextPurity === "92.5")) {
                        setForm((prev) => ({ ...prev, pricingMode: "GRAMS", pieceCost: "" }));
                      }
                    }} className="h-14 border border-slate-200 rounded-xl px-4 text-sm bg-white font-bold">{metalType === "GOLD" ? (<><option value="24">24K</option><option value="22">22K</option><option value="18">18K</option></>) : (<><option value="999">999%</option><option value="92.5">92.5%</option><option value="80">80%</option></>)}</select>
                  <Input type="number" min="0" value={form.liveRate} onChange={(e) => handleInputChange("liveRate", e.target.value)} placeholder="Live Rate" className="h-14 font-bold" />
                </div>
              </section>
            </div>

            <div className="space-y-10">
              <section className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-gold/10 space-y-8">
                <div className="flex items-center gap-3 border-b border-gold/5 pb-3"><Scale className="w-5 h-5 text-slate-400" /><h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Weight Requirement</h3></div>
                <div className="space-y-6">
                  {metalType === "SILVER" && String(form.purity) === "92.5" && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Pricing Basis
                      </label>
                      <div className="grid grid-cols-2 gap-2 p-1.5 bg-white rounded-2xl border border-slate-200">
                        {(["GRAMS", "PIECE"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                pricingMode: mode,
                                pieceCost: mode === "PIECE" ? prev.pieceCost : "",
                                requiredGrams: mode === "PIECE" ? "" : prev.requiredGrams,
                                vaPercentage: mode === "PIECE" ? "0" : prev.vaPercentage,
                              }))
                            }
                            className={cn(
                              "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                              form.pricingMode === mode
                                ? "bg-slate-900 text-white shadow"
                                : "text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            {mode === "GRAMS" ? "By Grams" : "Piece Cost"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {totals.isPieceCost ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Piece Cost
                      </label>
                      <Input
                        placeholder="Enter direct piece cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.pieceCost}
                        onChange={(e) => handleInputChange("pieceCost", e.target.value)}
                        className="h-12 bg-white font-bold"
                      />
                      <p className="text-[10px] text-slate-400 ml-2">
                        92.5 silver piece pricing: Metal Value = Piece Cost, VA is not applied.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Grams Required to Make
                      </label>
                      <Input
                        placeholder="Enter grams needed for this item"
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.requiredGrams}
                        onChange={(e) => handleInputChange("requiredGrams", e.target.value)}
                        className="h-12 bg-white"
                      />
                      <p className="text-[10px] text-slate-400 ml-2">
                        This becomes the order's Net Weight.
                      </p>
                    </div>
                  )}

                  <Input
                    placeholder="Stone Weight"
                    type="number"
                    min="0"
                    value={form.stoneWeight}
                    onChange={(e) => handleInputChange("stoneWeight", e.target.value)}
                    className="h-12 bg-white"
                  />

                  <div className="p-8 bg-white border border-gold/20 rounded-3xl flex justify-between items-center shadow-xl border-dashed">
                    <span className="text-[11px] font-bold text-gold uppercase tracking-widest">
                      {totals.isPieceCost ? "Metal Value / Piece Cost" : "Required Weight"}
                    </span>
                    <span className="text-3xl font-serif font-bold text-slate-900">
                      {totals.isPieceCost
                        ? `₹${totals.pieceCost.toLocaleString("en-IN")}`
                        : `${totals.netWeight.toFixed(3)}g`}
                    </span>
                  </div>
                </div>
              </section>
              <section className="space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3"><Tag className="w-5 h-5 text-gold" /><h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Commercials</h3></div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Input
                      type="number"
                      min="0"
                      value={totals.isPieceCost ? "0" : form.vaPercentage}
                      onChange={(e) => handleInputChange("vaPercentage", e.target.value)}
                      placeholder="VA %"
                      disabled={totals.isPieceCost}
                      className="h-12"
                    />
                    {totals.isPieceCost && (
                      <p className="text-[9px] text-slate-400 mt-1 ml-2">
                        VA is not applied for Piece Cost pricing.
                      </p>
                    )}
                  </div>
                  <Input type="number" min="0" value={form.stoneCost} onChange={(e) => handleInputChange("stoneCost", e.target.value)} placeholder="Stone ₹" className="h-12" />
                </div>
                <div className="rounded-[2rem] border border-amber-200 bg-amber-50/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Gold Exchange</p>
                      <p className="text-[10px] text-amber-600 mt-1">Existing exchange fields are treated as Gold.</p>
                    </div>
                    <span className="text-xs font-bold text-amber-800">
                      -₹{totals.goldExchangeValue.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      placeholder="Gold Jewellery Name"
                      value={form.exchangeJewelleryName}
                      onChange={(e) => handleInputChange("exchangeJewelleryName", e.target.value)}
                      className="h-12 bg-white"
                    />
                    <Input
                      placeholder="Gold Exchange Grams"
                      type="number"
                      min="0"
                      value={form.exchangeJewelleryGrams}
                      onChange={(e) => handleInputChange("exchangeJewelleryGrams", e.target.value)}
                      className="h-12 bg-white"
                    />
                    <Input
                      placeholder="Gold Exchange Value (₹)"
                      type="number"
                      min="0"
                      value={form.discountAmount}
                      onChange={(e) => handleInputChange("discountAmount", e.target.value)}
                      className="h-12 bg-white font-bold text-rose-600"
                    />
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 space-y-4">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">Silver Exchange</p>
                      <p className="text-[10px] text-slate-400 mt-1">Tick to add a separate silver exchange entry.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(form.hasSilverExchange)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev: any) => ({
                          ...prev,
                          hasSilverExchange: checked,
                          silverExchangeJewelleryName: checked ? prev.silverExchangeJewelleryName : "",
                          silverExchangeJewelleryGrams: checked ? prev.silverExchangeJewelleryGrams : "",
                          silverExchangeValue: checked ? prev.silverExchangeValue : "",
                        }));
                      }}
                      className="h-5 w-5 accent-slate-900"
                    />
                  </label>

                  {form.hasSilverExchange && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        placeholder="Silver Jewellery Name"
                        value={form.silverExchangeJewelleryName}
                        onChange={(e) => handleInputChange("silverExchangeJewelleryName", e.target.value)}
                        className="h-12 bg-white"
                      />
                      <Input
                        placeholder="Silver Exchange Grams"
                        type="number"
                        min="0"
                        value={form.silverExchangeJewelleryGrams}
                        onChange={(e) => handleInputChange("silverExchangeJewelleryGrams", e.target.value)}
                        className="h-12 bg-white"
                      />
                      <Input
                        placeholder="Silver Exchange Value (₹)"
                        type="number"
                        min="0"
                        value={form.silverExchangeValue}
                        onChange={(e) => handleInputChange("silverExchangeValue", e.target.value)}
                        className="h-12 bg-white font-bold text-slate-700"
                      />
                    </div>
                  )}

                  {form.hasSilverExchange && (
                    <div className="flex justify-between rounded-xl bg-white border border-slate-200 px-4 py-3 text-xs">
                      <span className="font-bold text-slate-500">Silver Exchange Deduction</span>
                      <span className="font-black text-slate-900">
                        -₹{totals.silverExchangeValue.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>

                {(totals.goldExchangeValue > 0 || totals.silverExchangeValue > 0) && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Total Exchange Deduction</span>
                    <span className="font-serif text-lg font-bold text-emerald-800">
                      -₹{totals.totalExchangeValue.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                <div className="space-y-4">
                  <Input
                    type="date"
                    value={form.deadlineDate}
                    onChange={(e) => handleInputChange("deadlineDate", e.target.value)}
                    className="h-12"
                  />

                  <PaymentSplitEditor
                    splits={initialPaymentSplits}
                    onChange={setInitialPaymentSplits}
                    title="Initial payment methods"
                  />

                  <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
                        Initial Payment Total
                      </p>
                      <p className="text-[10px] text-emerald-600">
                        Sum of all selected payment methods
                      </p>
                    </div>
                    <p className="font-serif text-2xl font-bold text-emerald-800">
                      ₹{getSplitTotal(initialPaymentSplits).toLocaleString("en-IN")}
                    </p>
                  </div>
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
                    {totals.totalExchangeValue > 0 && (
                      <div className="space-y-1 text-sm font-bold text-rose-400 bg-rose-400/5 p-2 rounded-lg border border-rose-400/20">
                        {totals.goldExchangeValue > 0 && (
                          <div className="flex justify-between"><span>Gold Exchange</span><span>- ₹{totals.goldExchangeValue.toLocaleString()}</span></div>
                        )}
                        {totals.silverExchangeValue > 0 && (
                          <div className="flex justify-between"><span>Silver Exchange</span><span>- ₹{totals.silverExchangeValue.toLocaleString()}</span></div>
                        )}
                      </div>
                    )}
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