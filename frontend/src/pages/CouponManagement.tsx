"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Search,
  RefreshCcw,
  Ticket,
  X,
  CheckCircle2,
  Lock,
  RotateCcw,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  Wallet,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const API_BASE = "https://suvarnagold-16e5.vercel.app";

interface CouponRecord {
  id: string;
  couponCode: string;
  createdAt: string;
  activeDate: string | null;
  redeemedAt: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  weightAssigned: number;
  status: "Active" | "Locked" | "Redeemed";
  schemeCode: string | null;
  schemeName: string | null;
  customerName: string;
  customerPhone: string;
  redeemedValue: number;
  isPreClosed: boolean;
  preClosedAt: string | null;
}

const STATUS_FILTERS = ["All", "Active", "Locked", "Redeemed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusConfig: Record<
  "Active" | "Locked" | "Redeemed",
  { label: string; icon: React.ReactNode; className: string }
> = {
  Active: {
    label: "Active",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  Locked: {
    label: "Locked",
    icon: <Lock className="w-3 h-3" />,
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  Redeemed: {
    label: "Redeemed",
    icon: <RotateCcw className="w-3 h-3" />,
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

const fmt = (d: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy") : "—";

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pre-close dialog state
  const [preCloseTarget, setPreCloseTarget] = useState<CouponRecord | null>(null);
  const [preCloseStep, setPreCloseStep] = useState<"confirm" | "otp">("confirm");
  const [preCloseOtp, setPreCloseOtp] = useState("");
  const [preCloseLoading, setPreCloseLoading] = useState(false);
  const [preCloseError, setPreCloseError] = useState("");
  const [preCloseSuccess, setPreCloseSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const handlePreCloseSendOtp = (coupon: CouponRecord) => {
    setPreCloseTarget(coupon);
    setPreCloseStep("confirm");
    setPreCloseOtp("");
    setPreCloseError("");
    setPreCloseSuccess(false);
  };

  const handlePreCloseRequestOtp = async () => {
    if (!preCloseTarget) return;
    setPreCloseLoading(true);
    setPreCloseError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/coupon/preclose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ couponId: preCloseTarget.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreCloseStep("otp");
      } else {
        setPreCloseError(data.error || "Failed to send OTP");
      }
    } catch {
      setPreCloseError("Network error. Please try again.");
    } finally {
      setPreCloseLoading(false);
    }
  };

  const handlePreCloseVerify = async () => {
    if (!preCloseTarget || !preCloseOtp) return;
    setPreCloseLoading(true);
    setPreCloseError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/coupon/preclose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ couponId: preCloseTarget.id, otp: preCloseOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreCloseSuccess(true);
        fetchCoupons();
      } else {
        setPreCloseError(data.error || "Invalid OTP");
      }
    } catch {
      setPreCloseError("Network error. Please try again.");
    } finally {
      setPreCloseLoading(false);
    }
  };

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/coupon/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error("Failed to fetch coupons:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return coupons.filter((c) => {
      const matchesSearch =
        c.couponCode.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        (c.schemeName?.toLowerCase().includes(q) ?? false);
      const matchesStatus =
        statusFilter === "All" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [coupons, searchQuery, statusFilter]);

  const counts = useMemo(
    () => ({
      All: coupons.length,
      Active: coupons.filter((c) => c.status === "Active").length,
      Locked: coupons.filter((c) => c.status === "Locked").length,
      Redeemed: coupons.filter((c) => c.status === "Redeemed").length,
    }),
    [coupons]
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden">

          {/* ── Hero Header ──────────────────────────────────────────── */}
          <header className="relative gradient-luxury px-10 py-8 shrink-0 overflow-hidden">
            {/* Decorative orbs */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white/5 rounded-full blur-2xl translate-y-1/2 pointer-events-none" />

            <div className="relative flex items-center justify-between gap-6">
              {/* Title */}
              <div className="flex items-center gap-5">
                <div className="p-3 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
                  <Ticket className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-serif font-bold text-white tracking-tight leading-tight">
                    Coupon Management
                  </h1>
                  <p className="text-white/60 text-xs uppercase tracking-[0.25em] mt-0.5 font-medium">
                    Gold Scheme Vouchers & Redemptions
                  </p>
                </div>
              </div>

              {/* Search + Refresh */}
              <div className="flex items-center gap-3">
                <div className="relative w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <Input
                    placeholder="Search code, customer, scheme…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-white/30 focus-visible:border-white/40"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-white/50 hover:text-white" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchCoupons}
                  disabled={isLoading}
                  className="h-11 w-11 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

            {/* ── Stat Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              {/* Total */}
              <div className="cursor-pointer" onClick={() => setStatusFilter("All")}>
                <LuxuryCard className={cn("p-5 transition-all relative overflow-hidden", statusFilter === "All" && "border-primary shadow-md glow-gold")}>
                  <div className="absolute top-0 right-0 w-20 h-20 gradient-gold opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Coupons</p>
                      <p className="text-4xl font-serif font-bold text-primary mt-1">{counts.All}</p>
                    </div>
                    <div className="p-2.5 gradient-gold rounded-xl shadow-md">
                      <Ticket className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </LuxuryCard>
              </div>

              {/* Active */}
              <div className="cursor-pointer" onClick={() => setStatusFilter("Active")}>
                <LuxuryCard className={cn("p-5 transition-all relative overflow-hidden", statusFilter === "Active" && "border-emerald-400 shadow-md")}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active</p>
                      <p className="text-4xl font-serif font-bold text-emerald-600 mt-1">{counts.Active}</p>
                    </div>
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                  </div>
                </LuxuryCard>
              </div>

              {/* Locked */}
              <div className="cursor-pointer" onClick={() => setStatusFilter("Locked")}>
                <LuxuryCard className={cn("p-5 transition-all relative overflow-hidden", statusFilter === "Locked" && "border-amber-400 shadow-md")}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Locked</p>
                      <p className="text-4xl font-serif font-bold text-amber-600 mt-1">{counts.Locked}</p>
                    </div>
                    <div className="p-2.5 bg-amber-100 rounded-xl">
                      <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                </LuxuryCard>
              </div>

              {/* Redeemed */}
              <div className="cursor-pointer" onClick={() => setStatusFilter("Redeemed")}>
                <LuxuryCard className={cn("p-5 transition-all relative overflow-hidden", statusFilter === "Redeemed" && "border-blue-400 shadow-md")}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Redeemed</p>
                      <p className="text-4xl font-serif font-bold text-blue-600 mt-1">{counts.Redeemed}</p>
                    </div>
                    <div className="p-2.5 bg-blue-100 rounded-xl">
                      <RotateCcw className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </LuxuryCard>
              </div>
            </div>

            {/* ── Filter Pills + Result Info ──────────────────────────── */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
                      statusFilter === s
                        ? "gradient-gold text-white border-transparent shadow-md"
                        : "bg-background border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-primary"
                    )}
                  >
                    {s} <span className="opacity-60 ml-0.5">({counts[s]})</span>
                  </button>
                ))}
              </div>
              {!isLoading && (
                <p className="text-xs text-muted-foreground">
                  Showing <span className="font-bold text-primary">{filtered.length}</span> of <span className="font-bold">{coupons.length}</span> coupons
                </p>
              )}
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            <LuxuryCard className="p-0 overflow-hidden">
              {/* Table header accent bar */}
              <div className="gradient-luxury h-1 w-full" />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5 border-b border-primary/10 hover:bg-primary/5">
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap pl-6">
                        Coupon Code
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Customer
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Mobile
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Scheme
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Created
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Active Since
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Redeemed On
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Invoice
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap text-right">
                        Weight
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap text-right">
                        Value
                      </TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap pr-6">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-b border-border/50">
                          {Array.from({ length: 12 }).map((_, j) => (
                            <TableCell key={j} className={j === 0 ? "pl-6" : ""}>
                              <div className="h-4 bg-muted rounded-full w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-20 text-muted-foreground">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-6 rounded-full bg-primary/5 border-2 border-dashed border-primary/20">
                              <Ticket className="w-10 h-10 text-primary/30" />
                            </div>
                            <p className="font-serif font-semibold text-lg text-primary/40">No coupons found</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your search or filter</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => {
                        const sc = statusConfig[c.status];
                        return (
                          <TableRow
                            key={c.id}
                            className="border-b border-border/40 hover:bg-primary/[0.03] transition-colors group"
                          >
                            {/* Coupon Code */}
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 rounded-full gradient-gold opacity-60 group-hover:opacity-100 transition-opacity" />
                                <span className="font-mono text-sm font-bold text-primary tracking-wider">
                                  {c.couponCode}
                                </span>
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <Badge className={cn("flex items-center gap-1.5 w-fit text-xs font-semibold border px-2.5 py-1", sc.className)}>
                                {sc.icon}
                                {sc.label}
                                {c.isPreClosed && (
                                  <span className="ml-1 text-[9px] bg-red-600/20 text-red-700 px-1 rounded">PRE</span>
                                )}
                              </Badge>
                            </TableCell>

                            {/* Customer */}
                            <TableCell>
                              <p className="font-semibold text-sm text-foreground whitespace-nowrap">{c.customerName}</p>
                            </TableCell>

                            {/* Mobile */}
                            <TableCell>
                              <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">{c.customerPhone}</span>
                            </TableCell>

                            {/* Scheme */}
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium whitespace-nowrap">{c.schemeName ?? "—"}</span>
                                {c.schemeCode && (
                                  <span className="font-mono text-[10px] text-muted-foreground">{c.schemeCode}</span>
                                )}
                              </div>
                            </TableCell>

                            {/* Created */}
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmt(c.createdAt)}</TableCell>

                            {/* Active Since */}
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmt(c.activeDate)}</TableCell>

                            {/* Redeemed On */}
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmt(c.redeemedAt)}</TableCell>

                            {/* Invoice */}
                            <TableCell>
                              {c.invoiceNumber ? (
                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                  {c.invoiceNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>

                            {/* Weight */}
                            <TableCell className="text-right">
                              {c.weightAssigned > 0 ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Scale className="w-3 h-3 text-primary/50" />
                                  <span className="font-bold text-sm">{c.weightAssigned.toFixed(3)}<span className="text-xs font-normal text-muted-foreground ml-0.5">g</span></span>
                                </div>
                              ) : "—"}
                            </TableCell>

                            {/* Value */}
                            <TableCell className="text-right pr-2">
                              {c.redeemedValue > 0 ? (
                                <span className="font-bold text-sm text-primary">
                                  ₹{Math.round(c.redeemedValue).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>

                            {/* Action */}
                            <TableCell className="pr-6">
                              {c.status === "Locked" && !c.isPreClosed ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 whitespace-nowrap rounded-xl font-bold"
                                  onClick={() => handlePreCloseSendOtp(c)}
                                >
                                  <ShieldAlert className="w-3 h-3 mr-1.5" />
                                  Pre-Close
                                </Button>
                              ) : c.isPreClosed ? (
                                <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold border whitespace-nowrap px-2.5 py-1">
                                  Pre-Closed{c.preClosedAt ? ` · ${fmt(c.preClosedAt)}` : ""}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </LuxuryCard>

          </div>
        </main>
      </div>
      {/* ── Pre-Close Dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!preCloseTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPreCloseTarget(null);
            setPreCloseStep("confirm");
            setPreCloseOtp("");
            setPreCloseError("");
            setPreCloseSuccess(false);
          }
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-2 border-primary/20">
          {/* Dialog header bar */}
          <div className="gradient-luxury px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-white text-lg font-serif">
                <div className="p-2 bg-white/15 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                Pre-Close Scheme Coupon
              </DialogTitle>
              <DialogDescription className="text-white/60 text-xs mt-1.5">
                <span className="font-mono font-bold text-white/90 bg-white/10 px-2 py-0.5 rounded-lg">{preCloseTarget?.couponCode}</span>
                <span className="ml-2">· {preCloseTarget?.customerName}</span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6">
            {preCloseSuccess ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="p-5 rounded-full bg-emerald-50 border-2 border-emerald-100">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="font-serif font-bold text-xl text-emerald-700">Pre-Closed Successfully!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The coupon is now active for redemption.<br />
                    VA and additional-month benefits have been blocked.
                  </p>
                </div>
                <Button
                  variant="gold"
                  className="mt-2 px-8 rounded-xl"
                  onClick={() => { setPreCloseTarget(null); setPreCloseSuccess(false); }}
                >
                  Done
                </Button>
              </div>
            ) : preCloseStep === "confirm" ? (
              <div className="space-y-5">
                {/* Warning box */}
                <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-red-700">This action will permanently:</p>
                      <ul className="space-y-1 text-xs text-red-600">
                        {[
                          "Force-complete the scheme immediately",
                          "Block VA (making charge) benefits",
                          "Block additional-month bonuses",
                          "Activate coupon with only accumulated grams / cash",
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-1.5">
                            <span className="mt-0.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Scale className="w-3.5 h-3.5 text-primary/60" />
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Weight</p>
                    </div>
                    <p className="font-serif font-bold text-xl text-primary">{preCloseTarget?.weightAssigned.toFixed(3)}<span className="text-sm font-normal ml-1">g</span></p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-primary/60" />
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cash Value</p>
                    </div>
                    <p className="font-serif font-bold text-xl text-primary">₹{Math.round(preCloseTarget?.redeemedValue ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                {preCloseError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 font-medium">{preCloseError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPreCloseTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl font-bold"
                    disabled={preCloseLoading}
                    onClick={handlePreCloseRequestOtp}
                  >
                    {preCloseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP to Admin"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Enter Admin OTP</p>
                  <p className="text-xs text-muted-foreground">A verification code was sent to the admin email.</p>
                </div>

                <Input
                  placeholder="· · · · · ·"
                  value={preCloseOtp}
                  maxLength={6}
                  onChange={(e) => setPreCloseOtp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-3xl font-mono tracking-[0.6em] h-16 rounded-2xl border-2 border-primary/20 focus-visible:ring-primary"
                />

                {preCloseError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 font-medium">{preCloseError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => { setPreCloseStep("confirm"); setPreCloseError(""); }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl font-bold"
                    disabled={preCloseLoading || preCloseOtp.length !== 6}
                    onClick={handlePreCloseVerify}
                  >
                    {preCloseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Pre-Close"}
                  </Button>
                </div>

                <button
                  className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4 w-full text-center disabled:opacity-40 transition-colors"
                  onClick={handlePreCloseRequestOtp}
                  disabled={preCloseLoading}
                >
                  Resend OTP
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
