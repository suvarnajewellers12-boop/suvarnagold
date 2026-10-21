"use client";

import { useEffect, useMemo, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuccessToast } from "@/components/SuccessToast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FilePlus2,
  Calendar,
  Users,
  LayoutGrid,
  Plus,
  X,
  CheckCircle2,
  ShieldCheck,
  Scale,
  FileText,
  Table as TableIcon,
  Ticket,
  Loader2,
  Gem,
  Coins,
  CircleDollarSign,
  Clock3,
  Search,
  RefreshCw,
  PackageSearch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ============================================================
// TYPES
// ============================================================

type SchemeRateType =
  | "GOLD_22K"
  | "GOLD_18K"
  | "SILVER"
  | "CASH";

type SchemeForm = {
  name: string;
  rateType: SchemeRateType;
  durationMonths: string;
  maturityMonths: string;
};

// ============================================================
// CACHE
// ============================================================

let schemesCache: any[] | null = null;

// ============================================================
// HELPERS
// ============================================================

const normalizeRateType = (scheme: any): SchemeRateType => {
  const raw = String(scheme?.rateType ?? "").toUpperCase();

  if (raw === "GOLD_22K") return "GOLD_22K";
  if (raw === "GOLD_18K") return "GOLD_18K";
  if (raw === "SILVER") return "SILVER";
  if (raw === "CASH") {
    // Backward compatibility:
    // old weighted schemes may have defaulted to CASH after migration.
    if (scheme?.isWeightBased === true) {
      return "GOLD_22K";
    }
    return "CASH";
  }

  // Older data created before rateType existed.
  if (scheme?.isWeightBased === true) {
    return "GOLD_22K";
  }

  return "CASH";
};

const getTypeLabel = (rateType: SchemeRateType) => {
  switch (rateType) {
    case "GOLD_22K":
      return "22K Gold Lock";
    case "GOLD_18K":
      return "18K Gold Lock";
    case "SILVER":
      return "Silver Lock";
    case "CASH":
      return "Cash Scheme";
  }
};

const getShortTypeLabel = (rateType: SchemeRateType) => {
  switch (rateType) {
    case "GOLD_22K":
      return "22K Gold";
    case "GOLD_18K":
      return "18K Gold";
    case "SILVER":
      return "Silver";
    case "CASH":
      return "Cash";
  }
};

const getTypeDescription = (rateType: SchemeRateType) => {
  switch (rateType) {
    case "GOLD_22K":
      return "Grams are locked using the live 22K gold rate on each payment day.";
    case "GOLD_18K":
      return "Grams are locked using the live 18K gold rate on each payment day.";
    case "SILVER":
      return "Grams are locked using the live silver rate on each payment day.";
    case "CASH":
      return "Cash savings scheme with no metal-rate conversion.";
  }
};

const getSchemeIcon = (rateType: SchemeRateType) => {
  switch (rateType) {
    case "GOLD_22K":
    case "GOLD_18K":
      return Gem;
    case "SILVER":
      return Coins;
    case "CASH":
      return CircleDollarSign;
  }
};

const isMetalScheme = (rateType: SchemeRateType) =>
  rateType !== "CASH";

// ============================================================
// SKELETON
// ============================================================

const SchemeSkeleton = () => (
  <div className="border border-gold/10 rounded-[22px] overflow-hidden bg-white/50 animate-pulse">
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="h-6 w-32 bg-slate-200 rounded-md" />
        <div className="h-8 w-20 bg-slate-100 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-y-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>

    <div className="bg-slate-50/50 border-t border-gold/5 px-6 py-4">
      <div className="h-4 w-40 bg-slate-100 rounded" />
    </div>
  </div>
);

// ============================================================
// PAGE
// ============================================================

const SuperAdminCreateScheme = () => {
  const { token, isAuthChecking, isAuthenticated } = useAuth();

  const [form, setForm] = useState<SchemeForm>({
    name: "",
    rateType: "GOLD_22K",
    durationMonths: "",
    maturityMonths: "",
  });

  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<"ALL" | SchemeRateType>("ALL");

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showCreateBox, setShowCreateBox] = useState(false);

  const [selectedScheme, setSelectedScheme] =
    useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCouponDialogOpen, setIsCouponDialogOpen] =
    useState(false);
  const [selectedCoupon, setSelectedCoupon] =
    useState<any>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
    useState(false);

  // ==========================================================
  // FETCH SCHEMES
  // ==========================================================

  const fetchSchemes = async (forceRefresh = false) => {
    if (!forceRefresh && schemesCache !== null) {
      setSchemes(schemesCache);
      setIsInitialLoading(false);
      return;
    }

    try {
      setIsInitialLoading(true);

      const res = await fetch(
        "https://suvarnagold-16e5.vercel.app/api/schemes/all",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (res.ok) {
        const fetched = data.schemes || [];
        setSchemes(fetched);
        schemesCache = fetched;
      } else {
        setToastMessage(
          data?.error || "Unable to load schemes."
        );
        setShowToast(true);
      }
    } catch (error) {
      console.error("Fetch error", error);
      setToastMessage("Unable to connect to the schemes service.");
      setShowToast(true);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // EXPORTS
  // ==========================================================

  const exportToExcel = () => {
    const exportData = schemes.flatMap((scheme) => {
      const rateType = normalizeRateType(scheme);

      return (scheme.enrollments || []).map((en: any) => ({
        "Scheme Name": scheme.name,
        "Scheme Type": getTypeLabel(rateType),
        "Customer Name": en.customer?.name || "N/A",
        "Customer Installment": Number(en.installmentAmount || 0),
        "Benefit Months":
          rateType === "CASH"
            ? Number(scheme.maturityMonths || 0)
            : "N/A",
        "Installments Paid": en.installmentsPaid,
        "Installments Left": en.installmentsLeft,
        "Total Paid (INR)": en.totalPaid,
        "Remaining Balance": en.remainingAmount,
        "Accumulated Grams":
          rateType === "CASH"
            ? "N/A"
            : Number(en.accumulatedGrams || 0).toFixed(3),
        "Coupon Code": en.coupon?.code || "N/A",
        Status: en.isCompleted ? "Completed" : "Active",
      }));
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Suvarna_Registry"
    );

    XLSX.writeFile(
      wb,
      `Suvarna_Financial_Report_${new Date().toLocaleDateString()}.xlsx`
    );
  };

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");

    doc.setFontSize(16);
    doc.text(
      "Suvarna Gold - Detailed Financial Registry",
      14,
      15
    );

    const tableBody = schemes.flatMap((scheme) => {
      const rateType = normalizeRateType(scheme);

      return (scheme.enrollments || []).map((en: any) => [
        scheme.name,
        getShortTypeLabel(rateType),
        en.customer?.name || "N/A",
        Number(en.installmentAmount || 0),
        rateType === "CASH"
          ? Number(scheme.maturityMonths || 0)
          : "-",
        en.installmentsPaid,
        en.installmentsLeft,
        en.totalPaid,
        en.remainingAmount,
        rateType === "CASH"
          ? "-"
          : `${Number(en.accumulatedGrams || 0).toFixed(3)}g`,
        en.isCompleted ? "DONE" : "ACTIVE",
      ]);
    });

    autoTable(doc, {
      startY: 25,
      head: [[
        "Scheme",
        "Type",
        "Customer",
        "Installment",
        "Benefit",
        "Paid#",
        "Left#",
        "Total Paid",
        "Remaining",
        "Locked Grams",
        "Status",
      ]],
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [184, 134, 11],
      },
    });

    doc.save(
      `Suvarna_Finance_Registry_${new Date().toLocaleDateString()}.pdf`
    );
  };

  // ==========================================================
  // FORM
  // ==========================================================

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRateTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const rateType = e.target.value as SchemeRateType;

    setForm((current) => ({
      ...current,
      rateType,
      maturityMonths:
        rateType === "CASH"
          ? current.maturityMonths
          : "",
    }));
  };

  const handleCreateScheme = async () => {
    const cleanName = form.name.trim();
    const tenure = Number(form.durationMonths);

    if (!cleanName) {
      setToastMessage("Scheme name is required.");
      setShowToast(true);
      return;
    }

    if (
      !Number.isInteger(tenure) ||
      tenure <= 0
    ) {
      setToastMessage("Enter a valid tenure.");
      setShowToast(true);
      return;
    }

    if (form.rateType === "CASH") {
      const benefitMonths = Number(form.maturityMonths);

      if (
        form.maturityMonths.trim() === "" ||
        !Number.isInteger(benefitMonths) ||
        benefitMonths < 0
      ) {
        setToastMessage(
          "Benefit months are required for cash schemes."
        );
        setShowToast(true);
        return;
      }
    }

    setIsConfirmDialogOpen(true);
  };

  const confirmCreateScheme = async () => {
    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        durationMonths: Number(form.durationMonths),
        rateType: form.rateType,

        ...(form.rateType === "CASH"
          ? {
              maturityMonths: Number(form.maturityMonths),
            }
          : {}),
      };

      const res = await fetch(
        "https://suvarnagold-16e5.vercel.app/api/schemes/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setToastMessage(
          `${getTypeLabel(form.rateType)} created successfully.`
        );
        setShowToast(true);

        setForm({
          name: "",
          rateType: "GOLD_22K",
          durationMonths: "",
          maturityMonths: "",
        });

        setShowCreateBox(false);
        setIsConfirmDialogOpen(false);

        schemesCache = null;
        await fetchSchemes(true);
      } else {
        setToastMessage(
          data?.error || "Failed to create scheme."
        );
        setShowToast(true);
      }
    } catch (error) {
      console.error("Creation error", error);
      setToastMessage("Creation failed.");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // FILTERING
  // ==========================================================

  const filteredSchemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return schemes.filter((scheme) => {
      const rateType = normalizeRateType(scheme);

      const matchesText =
        !query ||
        String(scheme?.name || "")
          .toLowerCase()
          .includes(query);

      const matchesType =
        typeFilter === "ALL" ||
        typeFilter === rateType;

      return matchesText && matchesType;
    });
  }, [schemes, searchQuery, typeFilter]);

  // ==========================================================
  // AUTH
  // ==========================================================

  if (isAuthChecking) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#fafaf9]">
        <Loader2 className="w-7 h-7 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-[#fafaf9] dark:bg-[#0a0a0a] w-full overflow-hidden">
        <DashboardSidebar />

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          {/* HEADER */}
          <header className="bg-white dark:bg-[#0f0f0f] border-b border-gold/10 px-4 md:px-8 py-4 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/60">
                Administrative Dashboard
              </span>

              <h1 className="text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">
                Scheme Registry
              </h1>

              <p className="text-xs text-muted-foreground mt-1">
                Manage 22K gold, 18K gold, silver locking and cash schemes.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                className="rounded-full gap-2 border-red-100 text-red-600 hover:bg-red-50 font-bold px-4"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </Button>

              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="rounded-full gap-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-bold px-4"
              >
                <TableIcon className="w-3.5 h-3.5" />
                EXCEL
              </Button>

              <Button
                onClick={() => {
                  schemesCache = null;
                  fetchSchemes(true);
                }}
                variant="outline"
                size="icon"
                className="rounded-full border-gold/20 text-gold"
                aria-label="Refresh schemes"
              >
                <RefreshCw
                  className={isInitialLoading ? "w-4 h-4 animate-spin" : "w-4 h-4"}
                />
              </Button>

              <Button
                onClick={() =>
                  setShowCreateBox((value) => !value)
                }
                variant="gold"
                className="rounded-full gap-2 font-bold px-6 shadow-lg uppercase text-[11px] tracking-widest"
              >
                {showCreateBox ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}

                {showCreateBox
                  ? "Close"
                  : "New Scheme"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full relative">
            {/* CREATE PANEL */}
            <aside
              className={`h-full transition-all duration-500 shrink-0 z-20 ${
                showCreateBox
                  ? "w-full md:w-[420px] opacity-100"
                  : "w-0 opacity-0 overflow-hidden"
              }`}
            >
              <div className="h-[calc(100vh-120px)] m-4 md:ml-6 bg-white dark:bg-[#0c0c0c] border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col border-b-4 border-b-gold/20 p-6 md:p-7">
                <div className="flex items-center gap-3 mb-7">
                  <div className="p-2 bg-gold/10 rounded-xl">
                    <FilePlus2 className="w-5 h-5 text-gold" />
                  </div>

                  <div>
                    <h2 className="text-xl font-serif font-bold">
                      New Scheme
                    </h2>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      Select the scheme locking type.
                    </p>
                  </div>
                </div>

                <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                  {/* RATE TYPE */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="rateType"
                      className="text-[10px] uppercase font-bold text-muted-foreground ml-1"
                    >
                      Scheme Type
                    </label>

                    <select
                      id="rateType"
                      name="rateType"
                      value={form.rateType}
                      onChange={handleRateTypeChange}
                      className="w-full h-11 rounded-xl bg-slate-50 border border-gold/10 px-3 text-sm font-bold text-gold outline-none"
                    >
                      <option value="GOLD_22K">
                        22K Gold Locking
                      </option>
                      <option value="GOLD_18K">
                        18K Gold Locking
                      </option>
                      <option value="SILVER">
                        Silver Locking
                      </option>
                      <option value="CASH">
                        Cash Scheme
                      </option>
                    </select>
                  </div>

                  {/* TYPE INFO */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-gold/10">
                    <div className="flex gap-3 items-start">
                      {(() => {
                        const Icon = getSchemeIcon(form.rateType);

                        return (
                          <div className="p-2 bg-white rounded-xl border border-gold/10">
                            <Icon className="w-4 h-4 text-gold" />
                          </div>
                        );
                      })()}

                      <div>
                        <p className="text-xs font-black text-slate-800">
                          {getTypeLabel(form.rateType)}
                        </p>

                        <p className="text-[10px] leading-5 text-muted-foreground mt-1">
                          {getTypeDescription(form.rateType)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* NAME */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="scheme-name"
                      className="text-[10px] uppercase font-bold text-muted-foreground ml-1"
                    >
                      Scheme Name
                    </label>

                    <Input
                      id="scheme-name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Example: Suvarna 22K Savings"
                      className="h-11 rounded-xl bg-slate-50/50"
                    />
                  </div>

                  {/* TENURE */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="durationMonths"
                      className="text-[10px] uppercase font-bold text-muted-foreground ml-1"
                    >
                      Tenure (Months)
                    </label>

                    <Input
                      id="durationMonths"
                      name="durationMonths"
                      type="number"
                      min="1"
                      step="1"
                      value={form.durationMonths}
                      onChange={handleChange}
                      placeholder="11"
                      className="h-11 rounded-xl bg-slate-50/50"
                    />
                  </div>

                  {/* CASH BENEFIT MONTHS */}
                  {form.rateType === "CASH" && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="maturityMonths"
                        className="text-[10px] uppercase font-bold text-muted-foreground ml-1"
                      >
                        Benefit Months
                      </label>

                      <select
                        id="maturityMonths"
                        name="maturityMonths"
                        value={form.maturityMonths}
                        onChange={handleChange}
                        className="w-full h-11 rounded-xl bg-slate-50/50 border border-gold/10 px-3 text-sm"
                      >
                        <option value="">
                          Select
                        </option>

                        {Array.from(
                          { length: 25 },
                          (_, i) => i
                        ).map((n) => (
                          <option key={n} value={n}>
                            {n} Mo
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />

                    <p className="text-[10px] leading-5 text-slate-600">
                      Customers choose their allowed installment amount during enrollment.
                      Metal grams are locked using the applicable live rate on each payment day.
                    </p>
                  </div>
                </div>

                <Button
                  variant="gold"
                  className="w-full h-12 rounded-2xl font-bold mt-6 shadow-lg"
                  onClick={handleCreateScheme}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Authorize Scheme"
                  )}
                </Button>
              </div>
            </aside>

            {/* MAIN CONTENT */}
            <section className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="px-4 md:px-8 pt-5 pb-3 space-y-4 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                      <LayoutGrid className="w-4 h-4 text-amber-600" />
                    </div>

                    <h2 className="font-serif font-bold text-lg">
                      Active Schemes
                    </h2>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) =>
                        setSearchQuery(e.target.value)
                      }
                      placeholder="Search schemes..."
                      className="h-10 pl-9 w-full md:w-64 rounded-xl bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["ALL", "All"],
                      ["GOLD_22K", "22K Gold"],
                      ["GOLD_18K", "18K Gold"],
                      ["SILVER", "Silver"],
                      ["CASH", "Cash"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setTypeFilter(value)
                      }
                      className={`px-4 h-9 rounded-full border text-[10px] font-bold transition ${
                        typeFilter === value
                          ? "bg-gold text-white border-gold"
                          : "bg-white text-slate-600 border-gold/10 hover:border-gold/30"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-3 pb-8">
                <div
                  className={`grid gap-6 transition-all duration-500 ${
                    showCreateBox
                      ? "grid-cols-1 xl:grid-cols-2"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  }`}
                >
                  {isInitialLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <SchemeSkeleton key={i} />
                    ))
                  ) : (
                    <>
                      {filteredSchemes.map((scheme) => {
                        const rateType =
                          normalizeRateType(scheme);

                        const Icon =
                          getSchemeIcon(rateType);

                        return (
                          <div
                            key={scheme.id}
                            onClick={() => {
                              setSelectedScheme(scheme);
                              setIsDetailsOpen(true);
                            }}
                            className="cursor-pointer group"
                          >
                            <LuxuryCard className="h-full hover:border-gold/40 transition-all p-0 overflow-hidden flex flex-col rounded-[22px]">
                              <div className="p-6 flex-1">
                                <div className="flex justify-between items-start gap-3 mb-6">
                                  <div className="min-w-0">
                                    <h3 className="font-serif font-bold text-sm uppercase group-hover:text-gold transition-colors truncate">
                                      {scheme.name}
                                    </h3>

                                    <Badge
                                      variant="gold"
                                      className="text-[8px] h-5 mt-1 bg-gold/5 text-gold border-none"
                                    >
                                      {getTypeLabel(rateType)}
                                    </Badge>
                                  </div>

                                  <div className="p-1.5 rounded-full bg-amber-50">
                                    <Icon className="w-3.5 h-3.5 text-amber-600" />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[8px] font-bold text-muted-foreground">
                                      TENURE
                                    </p>
                                    <p className="font-bold text-xs">
                                      {scheme.durationMonths} Mo.
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-[8px] font-bold text-muted-foreground">
                                      MEMBERS
                                    </p>
                                    <p className="font-bold text-xs">
                                      {scheme.enrollments?.length || 0}
                                    </p>
                                  </div>

                                  {rateType === "CASH" ? (
                                    <div className="col-span-2">
                                      <p className="text-[8px] font-bold text-muted-foreground">
                                        BENEFIT MONTHS
                                      </p>
                                      <p className="font-bold text-xs">
                                        {Number(
                                          scheme.maturityMonths || 0
                                        )}{" "}
                                        Mo.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="col-span-2">
                                      <p className="text-[8px] font-bold text-muted-foreground">
                                        LOCKING METHOD
                                      </p>
                                      <p className="font-bold text-xs">
                                        Live rate on payment day
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-gold/[0.04] border-t border-gold/5 px-6 py-3 group-hover:bg-gold/[0.07]">
                                <p className="text-[9px] leading-4 font-medium text-muted-foreground">
                                  {getTypeDescription(rateType)}
                                </p>
                              </div>
                            </LuxuryCard>
                          </div>
                        );
                      })}

                      {filteredSchemes.length === 0 && (
                        <div className="col-span-full h-72 flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-gold/10 bg-white/50">
                          <PackageSearch className="w-11 h-11 text-slate-300 mb-3" />
                          <p className="font-serif text-muted-foreground">
                            No schemes match the current filters.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ====================================================== */}
      {/* MEMBER LIST DIALOG */}
      {/* ====================================================== */}

      <Dialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-[2.5rem] border-gold/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader className="px-2">
            <div className="flex justify-between items-center w-full pr-4 gap-4">
              <div>
                <DialogTitle className="text-2xl font-serif font-bold text-gold uppercase tracking-tight">
                  {selectedScheme?.name}
                </DialogTitle>

                <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                  {selectedScheme
                    ? `${getTypeLabel(
                        normalizeRateType(selectedScheme)
                      )} • Member Registry`
                    : "Portfolio Member Registry"}
                </DialogDescription>
              </div>

              <Badge
                variant="gold"
                className="rounded-full px-4 py-1 border-none bg-gold/10 text-gold font-black"
              >
                {selectedScheme?.enrollments?.length || 0} Members
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-6 custom-scrollbar pr-2 pb-6 px-2 space-y-4">
            {selectedScheme?.enrollments?.map((en: any) => {
              const rateType =
                normalizeRateType(selectedScheme);

              return (
                <div
                  key={en.id}
                  className="p-6 rounded-[2rem] bg-slate-50 border border-gold/5 flex flex-col lg:flex-row items-center justify-between gap-6 hover:border-gold/20 shadow-sm group"
                >
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="h-14 w-14 rounded-[1.2rem] bg-white shadow-sm border border-gold/5 flex items-center justify-center text-gold font-black text-xl">
                      {en.customer?.name?.[0]?.toUpperCase() || "?"}
                    </div>

                    <div>
                      <h4 className="font-bold text-base capitalize">
                        {en.customer?.name || "Unknown Customer"}
                      </h4>

                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className="text-[8px] h-5 border-gold/20 text-gold/70"
                        >
                          {en.id.slice(0, 8)}
                        </Badge>

                        {en.coupon && (
                          <Button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedCoupon(en.coupon);
                              setIsCouponDialogOpen(true);
                            }}
                            className="h-5 px-2 bg-gold/10 text-gold hover:bg-gold text-[8px] font-bold gap-1 border-none rounded group-hover:bg-gold group-hover:text-white"
                          >
                            <Ticket className="w-2.5 h-2.5" />
                            {en.coupon.code}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-left flex-1 lg:pl-10 lg:border-l border-gold/10">
                    <div>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">
                        Status
                      </p>
                      <p className="text-sm font-bold">
                        {en.installmentsPaid}/
                        {selectedScheme.durationMonths} Paid
                      </p>
                    </div>

                    <div>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">
                        Installment
                      </p>
                      <p className="text-sm font-bold">
                        ₹
                        {Number(
                          en.installmentAmount || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">
                        Contribution
                      </p>
                      <p className="text-sm font-bold text-emerald-600">
                        ₹
                        {Number(
                          en.totalPaid || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">
                        {rateType === "CASH"
                          ? "Type"
                          : "Accumulation"}
                      </p>

                      <p className="text-sm font-bold text-gold">
                        {rateType === "CASH"
                          ? "Cash"
                          : `${Number(
                              en.accumulatedGrams || 0
                            ).toFixed(3)} g`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {(selectedScheme?.enrollments?.length || 0) === 0 && (
              <div className="py-16 text-center text-muted-foreground">
                No members are enrolled in this scheme.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ====================================================== */}
      {/* COUPON DIALOG */}
      {/* ====================================================== */}

      <Dialog
        open={isCouponDialogOpen}
        onOpenChange={setIsCouponDialogOpen}
      >
        <DialogContent className="max-w-md rounded-[2.5rem] border-gold/20 bg-white p-0 overflow-hidden shadow-2xl">
          <div className="bg-gold p-10 text-white text-center relative overflow-hidden">
            <Ticket className="w-16 h-16 mx-auto mb-4 opacity-30" />

            <h3 className="text-4xl font-serif font-bold tracking-tighter uppercase">
              {selectedCoupon?.code}
            </h3>

            <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-80 mt-2">
              Suvarna Authenticated
            </p>

            <div className="absolute -bottom-5 left-0 right-0 flex justify-around">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-white"
                />
              ))}
            </div>
          </div>

          <div className="p-10 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">
                  Cash Value
                </p>

                <p className="text-xl font-bold">
                  ₹
                  {Number(
                    selectedCoupon?.totalCashValue || 0
                  ).toLocaleString()}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-gold/5 border border-gold/10 text-center">
                <p className="text-[9px] font-bold text-gold uppercase mb-1">
                  Locked Grams
                </p>

                <p className="text-xl font-bold text-gold">
                  {Number(
                    selectedCoupon?.totalWeightGrams || 0
                  ).toFixed(3)}
                  g
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-dashed border-slate-200">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase block mb-1">
                  Redemption
                </span>

                <Badge
                  className={
                    selectedCoupon?.isActive
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }
                >
                  {selectedCoupon?.isActive
                    ? "READY"
                    : "LOCKED"}
                </Badge>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black text-muted-foreground uppercase block mb-1">
                  Issued
                </span>

                <p className="text-xs font-bold">
                  {selectedCoupon?.createdAt
                    ? new Date(
                        selectedCoupon.createdAt
                      ).toLocaleDateString()
                    : "-"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-gold/20 text-gold uppercase font-bold text-[10px] tracking-widest"
              onClick={() =>
                setIsCouponDialogOpen(false)
              }
            >
              Return to Registry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====================================================== */}
      {/* CONFIRM CREATION */}
      {/* ====================================================== */}

      <Dialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
      >
        <DialogContent className="max-w-md rounded-[2.5rem] border-gold/20 bg-white p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-gold to-amber-600 p-8 text-white text-center relative overflow-hidden">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4" />

            <h3 className="text-2xl font-serif font-bold uppercase tracking-tight">
              Confirm Creation
            </h3>

            <p className="text-[11px] uppercase font-bold tracking-[0.2em] opacity-90 mt-2">
              Authorize New Scheme
            </p>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">
                    Scheme Name
                  </p>

                  <p className="text-lg font-serif font-bold text-slate-900">
                    {form.name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5">
                    Scheme Type
                  </p>

                  <Badge
                    variant="outline"
                    className="border-gold/30 bg-gold/5 text-gold font-bold"
                  >
                    {getTypeLabel(form.rateType)}
                  </Badge>
                </div>

                <div>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5">
                    Tenure
                  </p>

                  <p className="font-bold text-slate-900">
                    {form.durationMonths} Months
                  </p>
                </div>
              </div>

              {form.rateType === "CASH" ? (
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5">
                    Benefit Months
                  </p>

                  <p className="font-bold text-slate-900">
                    {form.maturityMonths} Months
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1.5">
                    Locking Method
                  </p>

                  <p className="font-bold text-gold">
                    Live {getShortTypeLabel(form.rateType)} rate on payment day
                  </p>
                </div>
              )}
            </div>

            <div className="text-center py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-bold text-amber-900">
                Are you sure you want to create this scheme?
              </p>

              <p className="text-[9px] text-amber-700 mt-1 uppercase font-bold">
                Check the scheme type and tenure before continuing
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-100 uppercase font-bold text-xs tracking-wider"
                onClick={() =>
                  setIsConfirmDialogOpen(false)
                }
              >
                No, Cancel
              </Button>

              <Button
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-green-200 uppercase font-bold text-xs tracking-wider flex items-center justify-center gap-2"
                onClick={confirmCreateScheme}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}

                {loading
                  ? "Creating..."
                  : "Yes, Authorize"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessToast
        message={toastMessage}
        isVisible={showToast}
        onClose={() =>
          setShowToast(false)
        }
      />
    </SidebarProvider>
  );
};

export default SuperAdminCreateScheme;
