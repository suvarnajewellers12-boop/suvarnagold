"use client";

import { useEffect, useState, useMemo } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import {
    Users, Plus, X, Phone, CreditCard, Calendar,
    UserCircle, Loader2, Search, ArrowUpDown
} from "lucide-react";

// ================= CACHE CONFIGURATION =================
// This lives outside the component to persist between tab switches
let staffCache: any[] | null = null;

const StaffSkeleton = () => (
    <div className="flex justify-between items-center p-6 border-b border-gold/5 animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
            </div>
        </div>
        <div className="flex gap-8">
            <div className="space-y-2"><div className="h-3 w-12 bg-muted rounded" /><div className="h-3 w-16 bg-muted rounded" /></div>
            <div className="space-y-2"><div className="h-3 w-12 bg-muted rounded" /><div className="h-4 w-20 bg-muted rounded" /></div>
        </div>
    </div>
);

export default function StaffManagement() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const [staff, setStaff] = useState<any[]>([]);
    const [toast, setToast] = useState(false);
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [genderFilter, setGenderFilter] = useState("all");
    const [salarySort, setSalarySort] = useState("none");

    const [form, setForm] = useState({
        fullName: "",
        dateOfJoining: new Date().toISOString().split("T")[0],
        monthlySalary: "",
        gender: "Male",
        phoneNumber: "",
        aadharNumber: ""
    });

    // ================= FETCH WITH CACHE LOGIC =================
    const fetchStaff = async (forceRefresh = false) => {
        // If data is in cache and we aren't forcing a refresh, use it
        if (!forceRefresh && staffCache !== null) {
            setStaff(staffCache);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch("https://suvarnagold-16e5.vercel.app/api/staff/all", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const staffData = data.staff || [];
            
            // Update both local state and global cache
            setStaff(staffData);
            staffCache = staffData;
        } catch (error) {
            console.error("Fetch Error:", error);
            setMessage("Connection error. Please try again.");
            setToast(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        fetchStaff(); 
    }, []);

    const filteredStaff = useMemo(() => {
        const result = [...staff].filter((s) => {
            const matchesSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.phoneNumber.includes(searchQuery);
            const matchesGender = genderFilter === "all" || s.gender === genderFilter;
            return matchesSearch && matchesGender;
        });

        if (salarySort === "asc") result.sort((a, b) => Number(a.monthlySalary) - Number(b.monthlySalary));
        if (salarySort === "desc") result.sort((a, b) => Number(b.monthlySalary) - Number(a.monthlySalary));

        return result;
    }, [staff, searchQuery, genderFilter, salarySort]);

    const createStaff = async () => {
        if (form.phoneNumber.length !== 10) return alert("Phone must be 10 digits");
        if (form.aadharNumber.length !== 12) return alert("Aadhar must be 12 digits");

        setIsSubmitting(true);
        try {
            const res = await fetch("https://suvarnagold-16e5.vercel.app/api/staff/create", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            
            if (res.ok) {
                setMessage("Staff Registered Successfully");
                setToast(true);
                
                // CRITICAL: After creating, we force a refresh to update the cache
                await fetchStaff(true);
                
                setForm({
                    fullName: "",
                    dateOfJoining: new Date().toISOString().split("T")[0],
                    monthlySalary: "",
                    gender: "Male",
                    phoneNumber: "",
                    aadharNumber: ""
                });
            }
        } catch (error) {
            console.error("Create Error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
                <DashboardSidebar />

                {selectedStaff && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="bg-gradient-to-r from-amber-800 to-amber-600 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <UserCircle className="w-10 h-10" />
                                    <h2 className="text-xl font-serif font-bold">{selectedStaff.fullName}</h2>
                                </div>
                                <button onClick={() => setSelectedStaff(null)}><X /></button>
                            </div>
                            <div className="p-8 space-y-4 text-sm">
                                <div className="flex justify-between border-b pb-2"><span>Phone</span><span className="font-bold">{selectedStaff.phoneNumber}</span></div>
                                <div className="flex justify-between border-b pb-2"><span>Aadhar</span><span className="font-mono">{selectedStaff.aadharNumber}</span></div>
                                <div className="flex justify-between border-b pb-2"><span>Salary</span><span className="text-amber-700 font-bold">₹{selectedStaff.monthlySalary}</span></div>
                                <div className="flex justify-between">
                                    <span>Joined</span>
                                    <span className="font-medium">
                                        {new Date(selectedStaff.dateOfJoining).toLocaleDateString("en-GB")}
                                    </span>
                                </div>
                                <Button variant="gold" className="w-full mt-4" onClick={() => setSelectedStaff(null)}>Close</Button>
                            </div>
                        </div>
                    </div>
                )}

                <main className="flex-1 flex flex-col lg:flex-row h-screen overflow-hidden">
                    <div className="flex-1 flex flex-col p-8 overflow-hidden">
                        <header className="mb-6 flex justify-between items-end">
                            <div>
                                <h1 className="text-3xl font-serif font-bold text-slate-900">Staff Registry</h1>
                                <p className="text-sm text-slate-500 italic">Managing the jewelry house experts</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-[10px] uppercase tracking-widest h-8"
                                onClick={() => fetchStaff(true)}
                            >
                                Refresh Data
                            </Button>
                        </header>

                        <LuxuryCard className="flex-1 flex flex-col overflow-hidden border-amber-200/20 shadow-none">
                            <div className="p-4 bg-muted/20 border-b border-gold/10 space-y-4">
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            placeholder="Search by name or phone..."
                                            className="pl-10 bg-white border-gold/10 focus:border-gold"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            className="h-10 rounded-md border border-gold/10 bg-white px-3 text-xs outline-none"
                                            value={genderFilter}
                                            onChange={(e) => setGenderFilter(e.target.value)}
                                        >
                                            <option value="all">All Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-gold/10 text-xs gap-2"
                                            onClick={() => setSalarySort(salarySort === "asc" ? "desc" : "asc")}
                                        >
                                            <ArrowUpDown className="w-3 h-3" /> Salary
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => <StaffSkeleton key={i} />)
                                ) : filteredStaff.length > 0 ? (
                                    filteredStaff.map((s) => (
                                        <div
                                            key={s.id}
                                            onClick={() => setSelectedStaff(s)}
                                            className="flex justify-between items-center p-6 hover:bg-amber-50/50 cursor-pointer border-b border-gold/5 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold group-hover:bg-amber-600 group-hover:text-white">
                                                    {s.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-serif font-bold text-slate-800">{s.fullName}</p>
                                                    <p className="text-xs text-slate-400">{s.phoneNumber}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-8 text-sm">
                                                <div className="hidden sm:block">
                                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-tighter">Joined</p>
                                                    <p className="font-medium text-slate-600">{new Date(s.dateOfJoining).toLocaleDateString("en-GB")}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-tighter">Salary</p>
                                                    <p className="font-bold text-slate-900">₹{s.monthlySalary}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-20 text-center text-slate-400">No staff members match your filters.</div>
                                )}
                            </div>
                        </LuxuryCard>
                    </div>

                    <div className="w-full lg:w-[420px] p-8 lg:pl-0 h-full overflow-y-auto">
                        <LuxuryCard className="p-8 border-amber-500/20 shadow-xl bg-white">
                            <h2 className="text-xl font-serif font-bold flex items-center gap-3 mb-2">
                                <Plus className="text-gold w-5 h-5" /> Register Staff
                            </h2>
                            <GoldDivider />

                            <div className="space-y-5 mt-8">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                                    <Input
                                        className="h-12 border-gold/10"
                                        placeholder="Enter name"
                                        value={form.fullName}
                                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date of Joining</label>
                                    <Input
                                        type="date"
                                        className="h-12 border-gold/10"
                                        value={form.dateOfJoining}
                                        onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Salary (₹)</label>
                                        <Input
                                            type="number"
                                            placeholder="Salary"
                                            className="h-12 border-gold/10"
                                            value={form.monthlySalary}
                                            onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gender</label>
                                        <select
                                            className="w-full h-12 rounded-md border border-gold/10 px-3 text-sm"
                                            value={form.gender}
                                            onChange={(e) => setForm({ ...form, gender: e.target.value })}
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</label>
                                    <Input
                                        maxLength={10}
                                        placeholder="Phone number"
                                        className="h-12 border-gold/10"
                                        value={form.phoneNumber}
                                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aadhar Number</label>
                                    <Input
                                        maxLength={12}
                                        placeholder="Aadhar number"
                                        className="h-12 border-gold/10 font-mono tracking-widest"
                                        value={form.aadharNumber}
                                        onChange={(e) => setForm({ ...form, aadharNumber: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>

                                <Button
                                    variant="gold"
                                    className="w-full h-14 text-lg font-serif font-bold shadow-lg"
                                    onClick={createStaff}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Registry"}
                                </Button>
                            </div>
                        </LuxuryCard>
                    </div>
                </main>
            </div>

            <SuccessToast message={message} isVisible={toast} onClose={() => setToast(false)} />
        </SidebarProvider>
    );
}