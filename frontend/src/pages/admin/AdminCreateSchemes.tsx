"use client";

import { useEffect, useMemo, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { LuxuryCard } from "@/components/LuxuryCard";
import { SuccessToast } from "@/components/SuccessToast";
import {
  Calendar,
  Clock3,
  Gem,
  LayoutGrid,
  RefreshCw,
  Search,
  PackageSearch,
  Plus,
  X,
  FilePlus2,
  Loader2,
  Coins,
  CircleDollarSign,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

type SchemeRateType =
  | "GOLD_22K"
  | "GOLD_18K"
  | "SILVER"
  | "CASH";

type CreateSchemeForm = {
  name: string;
  durationMonths: string;
  rateType: SchemeRateType;
  maturityMonths: string;
};

// ============================================================
// CACHE
// ============================================================

let schemesCache: any[] | null = null;

// ============================================================
// HELPERS
// ============================================================

const getSchemeRateType = (scheme: any): SchemeRateType => {
  const raw = String(scheme?.rateType ?? "").toUpperCase();

  if (raw === "GOLD_22K") return "GOLD_22K";
  if (raw === "GOLD_18K") return "GOLD_18K";
  if (raw === "SILVER") return "SILVER";

  // Backward compatibility for old schemes created before rateType existed.
  if (scheme?.isWeightBased === true) {
    return "GOLD_22K";
  }

  return "CASH";
};

const getRateTypeLabel = (rateType: SchemeRateType) => {
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

const getRateTypeDescription = (rateType: SchemeRateType) => {
  switch (rateType) {
    case "GOLD_22K":
      return "Locks grams using the live 22K gold rate on each payment day.";
    case "GOLD_18K":
      return "Locks grams using the live 18K gold rate on each payment day.";
    case "SILVER":
      return "Locks grams using the live silver rate on each payment day.";
    case "CASH":
      return "Cash savings scheme with no metal-rate conversion.";
  }
};

const getTypeIcon = (rateType: SchemeRateType) => {
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

// ============================================================
// SKELETON
// ============================================================

const SchemeSkeleton = () => (
  <div className="border border-gold/10 rounded-[22px] overflow-hidden bg-white animate-pulse">
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

const AdminSchemesView = () => {
  const { isAuthChecking, isAuthenticated } = useAuth();

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  const [schemes, setSchemes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | SchemeRateType>("ALL");

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showCreateBox, setShowCreateBox] = useState(false);

  const [form, setForm] = useState<CreateSchemeForm>({
    name: "",
    durationMonths: "",
    rateType: "GOLD_22K",
    maturityMonths: "",
  });

  // ==========================================================
  // FETCH SCHEMES
  // ==========================================================

  const fetchSchemes = async (forceRefresh = false) => {
    if (!forceRefresh && schemesCache !== null) {
      setSchemes(schemesCache);
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);

    try {
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
        const fetchedData = data.schemes || [];

        setSchemes(fetchedData);
        schemesCache = fetchedData;
      } else {
        setToastMessage(data?.error || "Unable to load schemes.");
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
  // FORM
  // ==========================================================

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRateTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const nextRateType = e.target.value as SchemeRateType;

    setForm((current) => ({
      ...current,
      rateType: nextRateType,

      // Metal-locking schemes do not use cash maturity months.
      maturityMonths:
        nextRateType === "CASH"
          ? current.maturityMonths
          : "",
    }));
  };

  // ==========================================================
  // CREATE
  // ==========================================================

  const handleCreateScheme = async () => {
    const name = form.name.trim();
    const duration = Number(form.durationMonths);

    if (!name) {
      setToastMessage("Scheme title is required.");
      setShowToast(true);
      return;
    }

    if (
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      setToastMessage("Enter a valid scheme duration.");
      setShowToast(true);
      return;
    }

    if (form.rateType === "CASH") {
      const maturity = Number(form.maturityMonths);

      if (
        form.maturityMonths.trim() === "" ||
        !Number.isInteger(maturity) ||
        maturity < 0
      ) {
        setToastMessage(
          "Benefit months are required for a cash scheme."
        );
        setShowToast(true);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name,
        durationMonths: duration,
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
          `${getRateTypeLabel(form.rateType)} created successfully.`
        );
        setShowToast(true);

        setForm({
          name: "",
          durationMonths: "",
          rateType: "GOLD_22K",
          maturityMonths: "",
        });

        setShowCreateBox(false);
        schemesCache = null;
        await fetchSchemes(true);
      } else {
        setToastMessage(
          data?.error || "Failed to create scheme."
        );
        setShowToast(true);
      }
    } catch (error) {
      console.error("Create scheme error", error);
      setToastMessage("Backend communication error.");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================
  // FILTERS
  // ==========================================================

  const filteredSchemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return schemes.filter((scheme) => {
      const rateType = getSchemeRateType(scheme);

      const matchesSearch =
        !query ||
        String(scheme?.name ?? "")
          .toLowerCase()
          .includes(query);

      const matchesType =
        typeFilter === "ALL" ||
        rateType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [schemes, searchQuery, typeFilter]);

  // ==========================================================
  // AUTH
  // ==========================================================

  if (isAuthChecking) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#fdfdfc]">
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
      <div className="min-h-screen flex w-full bg-[#fdfdfc] dark:bg-[#0a0a0a] overflow-hidden">
        <AdminSidebar />

        <main className="flex-1 flex flex-col h-screen w-full overflow-hidden">
          {/* HEADER */}
          <header className="bg-white/80 backdrop-blur-md border-b border-gold/10 px-4 md:px-8 py-5 md:py-6 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 shrink-0 w-full z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600/80">
                Scheme Registry
              </span>

              <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight text-slate-900">
                Savings Schemes
              </h1>

              <p className="text-xs text-muted-foreground mt-1">
                Manage 22K gold, 18K gold, silver locking and cash schemes.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search schemes..."
                  className="pl-9 w-64 h-11 rounded-xl border-gold/10 bg-slate-50/50"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                />
              </div>

              <Button
                onClick={() => {
                  schemesCache = null;
                  fetchSchemes(true);
                }}
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-gold/20 text-gold hover:bg-gold/5"
                aria-label="Refresh schemes"
              >
                <RefreshCw
                  className={cn(
                    "w-5 h-5",
                    isInitialLoading && "animate-spin"
                  )}
                />
              </Button>

              <Button
                onClick={() =>
                  setShowCreateBox((value) => !value)
                }
                variant={
                  showCreateBox
                    ? "outline"
                    : "gold"
                }
                className="gap-2 h-11 px-5 md:px-6 rounded-xl font-bold shadow-sm transition-all"
              >
                {showCreateBox ? (
                  <X size={18} />
                ) : (
                  <Plus size={18} />
                )}

                {showCreateBox
                  ? "Cancel"
                  : "Add Scheme"}
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden w-full relative">
            {/* CREATE PANEL */}
            <aside
              className={cn(
                "h-full transition-all duration-500 ease-in-out shrink-0 z-20",
                showCreateBox
                  ? "w-full md:w-[420px] opacity-100"
                  : "w-0 opacity-0 overflow-hidden"
              )}
            >
              <div className="h-[calc(100vh-140px)] m-4 bg-white border border-gold/10 rounded-[2.5rem] shadow-2xl flex flex-col border-b-4 border-b-gold/20 overflow-hidden">
                <div className="p-6 md:p-8 h-full flex flex-col overflow-y-auto">
                  <div className="flex items-center gap-3 mb-7 shrink-0">
                    <div className="p-2 bg-gold/10 rounded-xl">
                      <FilePlus2 className="w-5 h-5 text-gold" />
                    </div>

                    <div>
                      <h2 className="text-xl font-serif font-bold text-slate-900">
                        Create New Scheme
                      </h2>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Select the locking type for this scheme.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 flex-1">
                    {/* TITLE */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="scheme-name"
                        className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1"
                      >
                        Scheme Title
                      </label>

                      <Input
                        id="scheme-name"
                        name="name"
                        placeholder="Example: Suvarna 22K Savings"
                        value={form.name}
                        onChange={handleInputChange}
                        className="h-12 rounded-xl border-gold/10 focus-visible:ring-gold/20"
                      />
                    </div>

                    {/* TYPE */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="rate-type"
                        className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1"
                      >
                        Scheme Type
                      </label>

                      <select
                        id="rate-type"
                        value={form.rateType}
                        onChange={handleRateTypeChange}
                        className="flex h-12 w-full rounded-xl border border-gold/10 bg-white px-4 py-2 text-sm text-slate-800 outline-none transition focus:border-gold/40 focus:ring-2 focus:ring-gold/10"
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
                    <div className="rounded-2xl border border-gold/10 bg-amber-50/50 p-4">
                      <div className="flex gap-3 items-start">
                        {(() => {
                          const Icon = getTypeIcon(
                            form.rateType
                          );

                          return (
                            <div className="p-2 rounded-xl bg-white border border-gold/10 shrink-0">
                              <Icon className="w-4 h-4 text-amber-600" />
                            </div>
                          );
                        })()}

                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {getRateTypeLabel(
                              form.rateType
                            )}
                          </p>

                          <p className="text-[11px] leading-5 text-muted-foreground mt-1">
                            {getRateTypeDescription(
                              form.rateType
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* DURATION */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="duration-months"
                        className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1"
                      >
                        Duration (Months)
                      </label>

                      <Input
                        id="duration-months"
                        name="durationMonths"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="11"
                        value={form.durationMonths}
                        onChange={handleInputChange}
                        className="h-12 rounded-xl border-gold/10"
                      />
                    </div>

                    {/* CASH-ONLY BENEFIT */}
                    {form.rateType === "CASH" && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="maturity-months"
                          className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1"
                        >
                          Benefit Months
                        </label>

                        <Input
                          id="maturity-months"
                          name="maturityMonths"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="1"
                          value={form.maturityMonths}
                          onChange={handleInputChange}
                          className="h-12 rounded-xl border-gold/10"
                        />

                        <p className="text-[10px] leading-4 text-muted-foreground px-1">
                          Used only for the cash scheme maturity benefit.
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex gap-3 items-start">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />

                      <p className="text-[11px] leading-5 text-slate-600">
                        Customers choose their allowed installment amount when they enroll.
                        Metal grams are calculated using the live applicable rate on the actual payment day.
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 shrink-0">
                    <Button
                      variant="gold"
                      className="w-full h-14 rounded-2xl text-[11px] uppercase tracking-[0.2em] font-bold shadow-xl shadow-gold/20"
                      onClick={handleCreateScheme}
                      disabled={isSubmitting}
                    >
                      {isSubmitting && (
                        <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      )}

                      {isSubmitting
                        ? "Creating Scheme..."
                        : "Confirm Creation"}
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            {/* MAIN CATALOG */}
            <section className="flex-1 flex flex-col min-w-0 bg-[#fdfdfc]">
              <div className="px-4 md:px-8 py-5 md:py-6 shrink-0 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg shadow-sm border border-amber-100">
                      <LayoutGrid className="w-4 h-4 text-amber-600" />
                    </div>

                    <h2 className="text-lg font-serif font-bold text-slate-800">
                      Active Schemes
                    </h2>
                  </div>

                  <Badge
                    variant="outline"
                    className="border-gold/30 text-[10px] text-gold px-4 py-1 uppercase tracking-widest font-bold rounded-full bg-gold/5"
                  >
                    Results: {filteredSchemes.length}
                  </Badge>
                </div>

                {/* TYPE FILTERS */}
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
                      className={cn(
                        "px-4 h-9 rounded-full text-[11px] font-bold border transition-all",
                        typeFilter === value
                          ? "bg-gold text-white border-gold shadow-sm"
                          : "bg-white text-slate-600 border-gold/10 hover:border-gold/30"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="relative md:hidden">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search schemes..."
                    className="pl-9 h-11 rounded-xl border-gold/10 bg-white"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 custom-scrollbar">
                <div
                  className={cn(
                    "grid gap-6 transition-all duration-500",
                    showCreateBox
                      ? "grid-cols-1 xl:grid-cols-2"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  )}
                >
                  {isInitialLoading ? (
                    Array.from({
                      length: 10,
                    }).map((_, i) => (
                      <SchemeSkeleton key={i} />
                    ))
                  ) : (
                    <>
                      {filteredSchemes.map((scheme) => {
                        const rateType =
                          getSchemeRateType(scheme);

                        const TypeIcon =
                          getTypeIcon(rateType);

                        const isLegacy =
                          !scheme?.rateType &&
                          scheme?.isWeightBased === true;

                        return (
                          <LuxuryCard
                            key={scheme.id}
                            className="group hover:border-gold/40 transition-all duration-300 p-0 overflow-hidden flex flex-col shadow-sm hover:shadow-xl rounded-[22px] border-gold/10"
                          >
                            <div className="p-6 flex-1 bg-white">
                              <div className="flex justify-between items-start gap-3 mb-6">
                                <div className="min-w-0">
                                  <h3 className="font-serif font-bold text-sm group-hover:text-gold transition-colors truncate uppercase text-slate-800">
                                    {scheme.name}
                                  </h3>

                                  {isLegacy && (
                                    <p className="text-[9px] text-amber-600 mt-1 font-semibold">
                                      Legacy weighted scheme
                                    </p>
                                  )}
                                </div>

                                <Badge className="shrink-0 bg-gold/10 text-amber-700 hover:bg-gold/10 border border-gold/10 text-[9px] px-2.5 py-1">
                                  {getRateTypeLabel(
                                    rateType
                                  )}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="w-3.5 h-3.5 text-gold/60" />
                                    <span className="text-[8px] uppercase font-bold tracking-tighter">
                                      Tenure
                                    </span>
                                  </div>

                                  <p className="font-bold text-xs pl-5 text-slate-700">
                                    {scheme.durationMonths} Mo
                                  </p>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <TypeIcon className="w-3.5 h-3.5 text-gold/60" />
                                    <span className="text-[8px] uppercase font-bold tracking-tighter">
                                      Type
                                    </span>
                                  </div>

                                  <p className="font-bold text-xs pl-5 text-slate-700">
                                    {rateType === "GOLD_22K"
                                      ? "22K Gold"
                                      : rateType === "GOLD_18K"
                                      ? "18K Gold"
                                      : rateType === "SILVER"
                                      ? "Silver"
                                      : "Cash"}
                                  </p>
                                </div>

                                {rateType === "CASH" ? (
                                  <div className="space-y-1 col-span-2">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Clock3 className="w-3.5 h-3.5 text-gold/60" />
                                      <span className="text-[8px] uppercase font-bold tracking-tighter">
                                        Benefit Months
                                      </span>
                                    </div>

                                    <p className="font-bold text-xs pl-5 text-slate-700">
                                      {Number(
                                        scheme.maturityMonths ?? 0
                                      )}{" "}
                                      Mo
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1 col-span-2">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <ShieldCheck className="w-3.5 h-3.5 text-gold/60" />
                                      <span className="text-[8px] uppercase font-bold tracking-tighter">
                                        Locking Method
                                      </span>
                                    </div>

                                    <p className="font-bold text-xs pl-5 text-slate-700">
                                      Live rate on payment day
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-gold/[0.03] border-t border-gold/5 px-6 py-4 group-hover:bg-gold/[0.06] transition-colors">
                              <p className="text-[10px] leading-5 font-medium text-muted-foreground">
                                {getRateTypeDescription(
                                  rateType
                                )}
                              </p>
                            </div>
                          </LuxuryCard>
                        );
                      })}

                      {filteredSchemes.length === 0 && (
                        <div className="col-span-full h-80 flex flex-col items-center justify-center border-2 border-dashed border-gold/10 rounded-[2.5rem] bg-slate-50/50 px-6">
                          <PackageSearch className="w-12 h-12 text-slate-300 mb-4" />

                          <p className="text-muted-foreground font-serif italic text-lg text-center">
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

export default AdminSchemesView;
