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
    UserCircle, Loader2, Search, ArrowUpDown, FileDown, Table as TableIcon, Edit2
} from "lucide-react";

// Library imports for exporting
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ================= CACHE CONFIGURATION =================
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
    const [editingStaff, setEditingStaff] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [genderFilter, setGenderFilter] = useState("all");
    const [salarySort, setSalarySort] = useState("none");

    const [form, setForm] = useState({
        fullName: "",
        dateOfJoining: new Date().toISOString().split("T")[0],
        monthlySalary: "",
        gender: "Male",
        phoneNumber: "",
        aadharNumber: "",
        panCardNumber: "",
        nomineeName: "",
        nomineeRelation: "Father",
        nomineePhoneNumber: "",
        nomineeAddress: ""
    });

    // ================= EXPORT FUNCTIONS =================
    const exportToExcel = () => {
        const dataToExport = filteredStaff.map(s => ({
            "Full Name": s.fullName,
            "Gender": s.gender,
            "Phone Number": s.phoneNumber,
            "Aadhar Number": s.aadharNumber,
            "Pan Card": s.panCardNumber || "N/A",
            "Monthly Salary (INR)": s.monthlySalary,
            "Date of Joining": new Date(s.dateOfJoining).toLocaleDateString("en-GB"),
            "Nominee Name": s.nomineeName,
            "Nominee Relation": s.nomineeRelation,
            "Nominee Phone": s.nomineePhoneNumber,
            "Nominee Address": s.nomineeAddress
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Registry");
        
        // Export with current date in filename
        XLSX.writeFile(workbook, `Staff_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        
        // Add Title and Header info
        doc.setFontSize(20);
        doc.setTextColor(40);
        doc.text("Suvarna Jewellery - Staff Registry", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Total Staff: ${filteredStaff.length} | Generated on: ${new Date().toLocaleString()}`, 14, 30);

        const tableColumn = ["Name", "Gender", "Phone", "Aadhar", "Pan", "Salary", "Nominee", "Relation"];
        const tableRows = filteredStaff.map(s => [
            s.fullName,
            s.gender,
            s.phoneNumber,
            s.aadharNumber,
            s.panCardNumber || "N/A",
            `Rs. ${s.monthlySalary}`,
            s.nomineeName,
            s.nomineeRelation
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255] }, // Golden Theme
            styles: { fontSize: 9 }
        });

        doc.save(`Staff_Registry_${Date.now()}.pdf`);
    };

    // ================= FETCH LOGIC =================
    const fetchStaff = async (forceRefresh = false) => {
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

    // ================= AUTH CHECK ON MOUNT =================
    const verifyAuthOnMount = async () => {
        try {
            if (!token) {
                window.location.href = "/auth/login";
                return;
            }

            // Token exists, proceed to fetch staff
            await fetchStaff();
        } catch (error) {
            console.error("Auth check error:", error);
            localStorage.removeItem("token");
            window.location.href = "/auth/login";
        }
    };

    useEffect(() => {
        verifyAuthOnMount();
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
        if (form.nomineePhoneNumber.length !== 10) return alert("Nominee phone must be 10 digits");
        if (!form.nomineeName) return alert("Nominee name is required");
        if (!form.nomineeAddress) return alert("Nominee address is required");

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
                await fetchStaff(true);
                setForm({
                    fullName: "",
                    dateOfJoining: new Date().toISOString().split("T")[0],
                    monthlySalary: "",
                    gender: "Male",
                    phoneNumber: "",
                    aadharNumber: "",
                    panCardNumber: "",
                    nomineeName: "",
                    nomineeRelation: "Father",
                    nomineePhoneNumber: "",
                    nomineeAddress: ""
                });
            } else {
                const errorData = await res.json();
                alert(errorData.error || "Failed to register staff");
            }
        } catch (error) {
            console.error("Create Error:", error);
            alert("Connection error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (staffMember: any) => {
        setEditingStaff({
            ...staffMember,
        });
        setIsEditModalOpen(true);
    };

    const updateStaff = async () => {
        if (editingStaff.phoneNumber.length !== 10) return alert("Phone must be 10 digits");
        if (editingStaff.aadharNumber.length !== 12) return alert("Aadhar must be 12 digits");
        if (editingStaff.nomineePhoneNumber.length !== 10) return alert("Nominee phone must be 10 digits");
        if (!editingStaff.nomineeName) return alert("Nominee name is required");
        if (!editingStaff.nomineeAddress) return alert("Nominee address is required");

        setIsSubmitting(true);
        try {
            const res = await fetch("https://suvarnagold-16e5.vercel.app/api/staff/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    staffId: editingStaff.id,
                    fullName: editingStaff.fullName,
                    dateOfJoining: editingStaff.dateOfJoining,
                    monthlySalary: editingStaff.monthlySalary,
                    gender: editingStaff.gender,
                    phoneNumber: editingStaff.phoneNumber,
                    aadharNumber: editingStaff.aadharNumber,
                    panCardNumber: editingStaff.panCardNumber,
                    nomineeName: editingStaff.nomineeName,
                    nomineeRelation: editingStaff.nomineeRelation,
                    nomineePhoneNumber: editingStaff.nomineePhoneNumber,
                    nomineeAddress: editingStaff.nomineeAddress,
                })
            });
            
            if (res.ok) {
                setMessage("Staff Updated Successfully");
                setToast(true);
                setIsEditModalOpen(false);
                setEditingStaff(null);
                await fetchStaff(true);
            } else {
                const errorData = await res.json();
                alert(errorData.error || "Failed to update staff");
            }
        } catch (error) {
            console.error("Update Error:", error);
            alert("Connection error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

   
    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
                <DashboardSidebar />

                {/* Staff Detail Modal */}
                {selectedStaff && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-4">
                            <div className="bg-gradient-to-r from-amber-800 to-amber-600 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <UserCircle className="w-10 h-10" />
                                    <h2 className="text-xl font-serif font-bold">{selectedStaff.fullName}</h2>
                                </div>
                                <button onClick={() => setSelectedStaff(null)}><X /></button>
                            </div>
                            <div className="p-8 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
                                {/* Staff Info Section */}
                                <div className="pb-4 border-b-2 border-amber-200">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-3">Staff Information</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between"><span>Phone</span><span className="font-bold">{selectedStaff.phoneNumber}</span></div>
                                        <div className="flex justify-between"><span>Aadhar</span><span className="font-mono text-xs">{selectedStaff.aadharNumber}</span></div>
                                        {selectedStaff.panCardNumber && <div className="flex justify-between"><span>Pan Card</span><span className="font-mono text-xs">{selectedStaff.panCardNumber}</span></div>}
                                        <div className="flex justify-between"><span>Gender</span><span className="font-bold">{selectedStaff.gender}</span></div>
                                        <div className="flex justify-between"><span>Salary</span><span className="text-amber-700 font-bold">₹{selectedStaff.monthlySalary}</span></div>
                                        <div className="flex justify-between"><span>Joined</span><span className="font-medium">{new Date(selectedStaff.dateOfJoining).toLocaleDateString("en-GB")}</span></div>
                                    </div>
                                </div>

                                {/* Nominee Info Section */}
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-3">Nominee Information</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between"><span>Name</span><span className="font-bold">{selectedStaff.nomineeName}</span></div>
                                        <div className="flex justify-between"><span>Relation</span><span className="font-bold text-amber-700">{selectedStaff.nomineeRelation}</span></div>
                                        <div className="flex justify-between"><span>Phone</span><span className="font-bold">{selectedStaff.nomineePhoneNumber}</span></div>
                                        <div className="flex justify-between flex-col"><span className="mb-1">Address</span><span className="font-medium text-xs">{selectedStaff.nomineeAddress}</span></div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 border-gold/20 text-gold hover:bg-gold/5"
                                        onClick={() => {
                                            setSelectedStaff(null);
                                            openEditModal(selectedStaff);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                    <Button variant="gold" className="flex-1" onClick={() => setSelectedStaff(null)}>Close</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ================= EDIT MODAL ================= */}
                {isEditModalOpen && editingStaff && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-4">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <UserCircle className="w-10 h-10" />
                                    <h2 className="text-xl font-serif font-bold">Edit Staff - {editingStaff.fullName}</h2>
                                </div>
                                <button onClick={() => { setIsEditModalOpen(false); setEditingStaff(null); }}><X /></button>
                            </div>
                            
                            <div className="p-8 max-h-[90vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Full Name */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                                        <Input
                                            className="h-10 border-gold/10 text-sm"
                                            value={editingStaff.fullName}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, fullName: e.target.value })}
                                        />
                                    </div>

                                    {/* Date of Joining */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date of Joining</label>
                                        <Input
                                            type="date"
                                            className="h-10 border-gold/10 text-sm"
                                            value={editingStaff.dateOfJoining}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, dateOfJoining: e.target.value })}
                                        />
                                    </div>

                                    {/* Salary */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Salary (₹)</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="h-10 border-gold/10 text-sm"
                                            value={editingStaff.monthlySalary}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, monthlySalary: e.target.value })}
                                        />
                                    </div>

                                    {/* Gender */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gender</label>
                                        <select
                                            className="w-full h-10 rounded-md border border-gold/10 px-2 text-sm"
                                            value={editingStaff.gender}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, gender: e.target.value })}
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>

                                    {/* Phone Number */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone Number</label>
                                        <Input
                                            maxLength={10}
                                            className="h-10 border-gold/10 text-sm"
                                            value={editingStaff.phoneNumber}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, phoneNumber: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>

                                    {/* Aadhar Number */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aadhar Number</label>
                                        <Input
                                            maxLength={12}
                                            className="h-10 border-gold/10 font-mono tracking-widest text-sm"
                                            value={editingStaff.aadharNumber}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, aadharNumber: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>

                                    {/* Pan Card */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pan Card (Optional)</label>
                                        <Input
                                            className="h-10 border-gold/10 font-mono text-sm uppercase"
                                            value={editingStaff.panCardNumber || ""}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, panCardNumber: e.target.value.toUpperCase() })}
                                        />
                                    </div>

                                    {/* Nominee Section Header */}
                                    <div className="col-span-2 mt-4 pt-4 border-t-2 border-blue-100">
                                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
                                            <Users className="w-3 h-3" /> Nominee Information
                                        </p>
                                    </div>

                                    {/* Nominee Name */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nominee Name</label>
                                        <Input
                                            className="h-10 border-gold/10 text-sm"
                                            value={editingStaff.nomineeName}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, nomineeName: e.target.value })}
                                        />
                                    </div>

                                    {/* Nominee Relation */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Relation</label>
                                        <select
                                            className="w-full h-10 rounded-md border border-gold/10 px-2 text-sm"
                                            value={editingStaff.nomineeRelation}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, nomineeRelation: e.target.value })}
                                        >
                                            <option value="Father">Father</option>
                                            <option value="Mother">Mother</option>
                                            <option value="Spouse">Spouse</option>
                                            <option value="Son">Son</option>
                                            <option value="Daughter">Daughter</option>
                                            <option value="Brother">Brother</option>
                                            <option value="Sister">Sister</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    {/* Nominee Phone */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nominee Phone</label>
                                        <Input
                                            maxLength={10}
                                            className="h-10 border-gold/10 text-sm"
                                            value={editingStaff.nomineePhoneNumber}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, nomineePhoneNumber: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>

                                    {/* Nominee Address */}
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nominee Address</label>
                                        <textarea
                                            className="w-full h-16 rounded-md border border-gold/10 px-3 py-2 text-sm resize-none"
                                            value={editingStaff.nomineeAddress}
                                            onChange={(e) => setEditingStaff({ ...editingStaff, nomineeAddress: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-8">
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 h-11"
                                        onClick={() => { setIsEditModalOpen(false); setEditingStaff(null); }}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="gold"
                                        className="flex-1 h-11 font-bold shadow-lg"
                                        onClick={updateStaff}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Save Changes"}
                                        {isSubmitting && "Saving..."}
                                    </Button>
                                </div>
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
                            
                            {/* EXPORT BUTTONS */}
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-[10px] uppercase tracking-widest h-8 border-amber-200 text-amber-800 hover:bg-amber-50"
                                    onClick={exportToExcel}
                                >
                                    <TableIcon className="w-3 h-3 mr-2" /> Excel
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-[10px] uppercase tracking-widest h-8 border-red-200 text-red-800 hover:bg-red-50"
                                    onClick={exportToPDF}
                                >
                                    <FileDown className="w-3 h-3 mr-2" /> PDF
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-[10px] uppercase tracking-widest h-8"
                                    onClick={() => fetchStaff(true)}
                                >
                                    Refresh
                                </Button>
                            </div>
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
                                            className="flex justify-between items-center p-6 hover:bg-amber-50/50 border-b border-gold/5 transition-all group"
                                        >
                                            <div 
                                                className="flex items-center gap-4 flex-1 cursor-pointer"
                                                onClick={() => setSelectedStaff(s)}
                                            >
                                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold group-hover:bg-amber-600 group-hover:text-white">
                                                    {s.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-serif font-bold text-slate-800">{s.fullName}</p>
                                                    <p className="text-xs text-slate-400">{s.phoneNumber}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-6 text-sm">
                                                <div className="hidden sm:block">
                                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-tighter">Joined</p>
                                                    <p className="font-medium text-slate-600">{new Date(s.dateOfJoining).toLocaleDateString("en-GB")}</p>
                                                </div>
                                                <div className="hidden sm:block">
                                                    <p className="text-[10px] uppercase text-slate-400 font-bold tracking-tighter">Salary</p>
                                                    <p className="font-bold text-slate-900">₹{s.monthlySalary}</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditModal(s);
                                                    }}
                                                    className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Edit staff member"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
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

                            <div className="space-y-5 mt-8 max-h-[90vh] overflow-y-auto pr-2">
                                {/* ========== STAFF INFORMATION ========== */}
                                <div>
                                    <p className="text-[9px] uppercase font-bold text-slate-400 mb-4 flex items-center gap-2">
                                        <Users className="w-3 h-3" /> Staff Information
                                    </p>
                                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-gold/5">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                                            <Input
                                                className="h-10 border-gold/10 text-sm"
                                                placeholder="Enter name"
                                                value={form.fullName}
                                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date of Joining</label>
                                            <Input
                                                type="date"
                                                className="h-10 border-gold/10 text-sm"
                                                value={form.dateOfJoining}
                                                onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Salary (₹)</label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Salary"
                                                    className="h-10 border-gold/10 text-sm"
                                                    value={form.monthlySalary}
                                                    onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gender</label>
                                                <select
                                                    className="w-full h-10 rounded-md border border-gold/10 px-2 text-sm"
                                                    value={form.gender}
                                                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                                                >
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone Number</label>
                                            <Input
                                                maxLength={10}
                                                placeholder="10 digit phone"
                                                className="h-10 border-gold/10 text-sm"
                                                value={form.phoneNumber}
                                                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aadhar Number</label>
                                            <Input
                                                maxLength={12}
                                                placeholder="12 digit aadhar"
                                                className="h-10 border-gold/10 font-mono tracking-widest text-sm"
                                                value={form.aadharNumber}
                                                onChange={(e) => setForm({ ...form, aadharNumber: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pan Card (Optional)</label>
                                            <Input
                                                placeholder="Pan card number"
                                                className="h-10 border-gold/10 font-mono text-sm uppercase"
                                                value={form.panCardNumber}
                                                onChange={(e) => setForm({ ...form, panCardNumber: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ========== NOMINEE INFORMATION ========== */}
                                <div>
                                    <p className="text-[9px] uppercase font-bold text-slate-400 mb-4 flex items-center gap-2 mt-6">
                                        <UserCircle className="w-3 h-3" /> Nominee Information
                                    </p>
                                    <div className="space-y-3 bg-amber-50/50 p-4 rounded-lg border border-amber-200/30">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nominee Name</label>
                                            <Input
                                                className="h-10 border-gold/10 text-sm"
                                                placeholder="Full name"
                                                value={form.nomineeName}
                                                onChange={(e) => setForm({ ...form, nomineeName: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Relation</label>
                                            <select
                                                className="w-full h-10 rounded-md border border-gold/10 px-2 text-sm"
                                                value={form.nomineeRelation}
                                                onChange={(e) => setForm({ ...form, nomineeRelation: e.target.value })}
                                            >
                                                <option value="Father">Father</option>
                                                <option value="Mother">Mother</option>
                                                <option value="Spouse">Spouse</option>
                                                <option value="Son">Son</option>
                                                <option value="Daughter">Daughter</option>
                                                <option value="Brother">Brother</option>
                                                <option value="Sister">Sister</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nominee Phone</label>
                                            <Input
                                                maxLength={10}
                                                placeholder="10 digit phone"
                                                className="h-10 border-gold/10 text-sm"
                                                value={form.nomineePhoneNumber}
                                                onChange={(e) => setForm({ ...form, nomineePhoneNumber: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nominee Address</label>
                                            <textarea
                                                placeholder="Full address"
                                                className="w-full h-20 rounded-md border border-gold/10 px-3 py-2 text-sm resize-none"
                                                value={form.nomineeAddress}
                                                onChange={(e) => setForm({ ...form, nomineeAddress: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    variant="gold"
                                    className="w-full h-12 text-base font-serif font-bold shadow-lg mt-4"
                                    onClick={createStaff}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                    {isSubmitting ? "Registering..." : "Confirm Registry"}
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