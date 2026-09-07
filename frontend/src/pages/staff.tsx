"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import {
    Users, Plus, X, Phone, CreditCard, Calendar,
    UserCircle, Loader2, Search, ArrowUpDown, FileDown, Table as TableIcon, Edit2, Trash2, AlertCircle,
    Banknote, Smartphone, Landmark, CalendarDays, TrendingUp, ReceiptIndianRupee
} from "lucide-react";

// Library imports for exporting
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Business roles are separate from the SUPER_ADMIN authorization role.
type StaffRole = "CASHIER" | "SALESMAN";
const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
    { value: "CASHIER", label: "Cashier" },
    { value: "SALESMAN", label: "Salesman" },
];
function normalizeRoles(value: unknown): StaffRole[] {
    if (!Array.isArray(value)) return [];
    return ROLE_OPTIONS.filter(option => value.includes(option.value)).map(option => option.value);
}
function roleLabel(value: unknown) {
    return normalizeRoles(value).map(role => ROLE_OPTIONS.find(option => option.value === role)!.label).join(", ") || "Not assigned";
}

// Native disclosure with checkboxes: choose one or both without Ctrl/Cmd.
function RoleDropdown({ id, value, onChange, disabled = false }: {
    id: string; value: StaffRole[]; onChange: (roles: StaffRole[]) => void; disabled?: boolean;
}) {
    const root = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const closeOutside = (event: PointerEvent) => {
            if (root.current && !root.current.contains(event.target as Node)) root.current.open = false;
        };
        document.addEventListener("pointerdown", closeOutside);
        return () => document.removeEventListener("pointerdown", closeOutside);
    }, []);
    return (
        <div className="space-y-1">
            <span id={`${id}-label`} className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Roles *</span>
            <details ref={root} className="rounded-md border border-gold/20 bg-white"
                onKeyDown={event => {
                    if (event.key === "Escape" && root.current) {
                        root.current.open = false;
                        root.current.querySelector("summary")?.focus();
                    }
                }}>
                <summary aria-labelledby={`${id}-label ${id}-value`} aria-disabled={disabled}
                    onClick={event => { if (disabled) event.preventDefault(); }}
                    className="cursor-pointer rounded-md px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <span id={`${id}-value`}>{value.length ? roleLabel(value) : "Select one or both roles"}</span>
                </summary>
                <fieldset disabled={disabled} className="border-t border-gold/10 p-3 space-y-2">
                    <legend className="sr-only">Choose staff roles</legend>
                    {ROLE_OPTIONS.map(option => (
                        <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-amber-50">
                            <input type="checkbox" checked={value.includes(option.value)} className="h-4 w-4 accent-amber-700"
                                onChange={event => onChange(event.target.checked
                                    ? normalizeRoles([...value, option.value])
                                    : value.filter(role => role !== option.value))} />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
            </details>
            <p className="text-xs text-slate-500">Select Cashier, Salesman, or both.</p>
        </div>
    );
}
function BranchField({ id, value, options, onChange, disabled = false }: {
    id: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Branch *</label>
            <Input id={id} list={`${id}-options`} value={value} onChange={event => onChange(event.target.value)}
                maxLength={120} disabled={disabled} required autoComplete="off"
                placeholder="Select or enter a branch" className="h-10 border-gold/20 text-sm" />
            <datalist id={`${id}-options`}>{options.map(branch => <option key={branch} value={branch} />)}</datalist>
            <p className="text-xs text-slate-500">Choose an existing branch or enter its name.</p>
        </div>
    );
}

function validateAssignment(branch: string, roles: StaffRole[]): string | null {
    if (!branch.trim()) return "Please select or enter a branch.";
    if (branch.trim().length > 120) return "Branch must not exceed 120 characters.";
    if (!roles.length || roles.some(role => !ROLE_OPTIONS.some(option => option.value === role))) return "Please select at least one valid role.";
    return null;
}
type PasswordMode = "keep" | "custom" | "default";
function passwordPayload(mode: PasswordMode, password: string, confirmation: string) {
    if (mode === "default") return { resetPassword: true };
    if (mode !== "custom") return {};
    if (password.trim().length < 8) throw new Error("New password needs at least 8 characters excluding leading and trailing spaces.");
    if (new TextEncoder().encode(password).length > 72) throw new Error("New password must not exceed 72 bytes.");
    if (password !== confirmation) throw new Error("New password and confirmation do not match.");
    return { newPassword: password };
}

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

// ================= CONFIRMATION DIALOG COMPONENT =================
const DeleteConfirmationDialog = ({
    isOpen,
    staffName,
    isDeleting,
    onConfirm,
    onCancel
}: {
    isOpen: boolean;
    staffName: string;
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-4">
                    {/* Icon and Title */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-serif font-bold text-slate-900">Delete Staff Member?</h3>
                            <p className="text-sm text-slate-500 mt-1">This action cannot be undone</p>
                        </div>
                    </div>

                    {/* Warning Message */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700">
                            Are you sure you want to delete <span className="font-bold">{staffName}</span>? All associated data will be permanently removed from the system.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                        <Button
                            variant="outline"
                            className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 h-10"
                            onClick={onCancel}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1 h-10 font-bold bg-red-600 hover:bg-red-700 text-white"
                            onClick={onConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Permanently
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    const [passwordMode, setPasswordMode] = useState<PasswordMode>("keep");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState("");
    const [editError, setEditError] = useState("");
    const branchOptions = useMemo(() => Array.from(new Set<string>(staff
        .map(member => typeof member.branch === "string" ? member.branch.trim() : "")
        .filter(Boolean))).sort((a, b) => a.localeCompare(b)), [staff]);
    const closeEditModal = () => {
        if (isSubmitting) return;
        setIsEditModalOpen(false);
        setEditingStaff(null);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMode("keep");
        setShowPassword(false);
        setEditError("");
    };
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    // Delete confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState({
        isOpen: false,
        staffId: null as string | null,
        staffName: "",
        isDeleting: false
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [genderFilter, setGenderFilter] = useState("all");
    const [salarySort, setSalarySort] = useState("none");
    const [performanceSort, setPerformanceSort] = useState("none");
    const [performanceOrder, setPerformanceOrder] = useState("desc");
    const [minAmountFilter, setMinAmountFilter] = useState("");
    const [minCountFilter, setMinCountFilter] = useState("");

    // Performance date range is handled by the API so Prisma aggregates
    // only purchases inside the selected period.
    const [performanceRange, setPerformanceRange] = useState<
        "day" | "week" | "month" | "overall" | "custom"
    >("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");

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
        nomineeAddress: "",
        branch: "",
        roles: [] as StaffRole[]
    });

    // ================= EXPORT FUNCTIONS =================
    const exportToExcel = () => {
        const dataToExport = filteredStaff.map(s => ({
            "Full Name": s.fullName,
            "Employee ID": s.id,
            "Branch": s.branch || "Not assigned",
            "Roles": roleLabel(s.roles),
            "Gender": s.gender,
            "Phone Number": s.phoneNumber,
            "Aadhar Number": s.aadharNumber,
            "Pan Card": s.panCardNumber || "N/A",
            "Monthly Salary (INR)": s.monthlySalary,
            "Sales Amount (INR)": s.salesAmount ?? 0,
            "Sales Count": s.salesCount ?? 0,
            "Cash Collected (INR)": s.cashCollected ?? 0,
            "UPI Collected (INR)": s.upiCollected ?? 0,
            "Card Collected (INR)": s.cardCollected ?? 0,
            "Cheque Collected (INR)": s.chequeCollected ?? 0,
            "Total Collected (INR)": s.totalCollected ?? 0,
            "Cashier Count": s.cashierCount ?? 0,
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
        const doc = new jsPDF({ orientation: "landscape", format: "a3" });

        // Add Title and Header info
        doc.setFontSize(20);
        doc.setTextColor(40);
        doc.text("Suvarna Jewellery - Staff Registry", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Total Staff: ${filteredStaff.length} | Generated on: ${new Date().toLocaleString()}`, 14, 30);

        const tableColumn = [
            "Name",
            "Branch",
            "Roles",
            "Gender",
            "Phone",
            "Aadhar",
            "Pan",
            "Salary",
            "Sales Amount",
            "Sales Count",
            "Cash",
            "UPI",
            "Card",
            "Cheque",
            "Collected",
            "Cashier Count",
            "Nominee",
            "Relation"
        ];
        const tableRows = filteredStaff.map(s => [
            s.fullName,
            s.branch || "Not assigned",
            roleLabel(s.roles),
            s.gender,
            s.phoneNumber,
            s.aadharNumber,
            s.panCardNumber || "N/A",
            `Rs. ${s.monthlySalary}`,
            `Rs. ${s.salesAmount ?? 0}`,
            s.salesCount ?? 0,
            `Rs. ${s.cashCollected ?? 0}`,
            `Rs. ${s.upiCollected ?? 0}`,
            `Rs. ${s.cardCollected ?? 0}`,
            `Rs. ${s.chequeCollected ?? 0}`,
            `Rs. ${s.totalCollected ?? 0}`,
            s.cashierCount ?? 0,
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
    const fetchStaff = async (
        forceRefresh = false,
        rangeOverride?: "day" | "week" | "month" | "overall" | "custom",
        fromOverride?: string,
        toOverride?: string
    ) => {
        const activeRange = rangeOverride ?? performanceRange;
        const activeFrom = fromOverride ?? customFrom;
        const activeTo = toOverride ?? customTo;

        // Cache is safe only for the exact current range. For performance filters
        // we deliberately refetch so database aggregates always match the UI.
        if (
            !forceRefresh &&
            staffCache !== null &&
            activeRange === "overall" &&
            !activeFrom &&
            !activeTo
        ) {
            setStaff(staffCache);
            setIsLoading(false);
            return;
        }

        if (activeRange === "custom" && (!activeFrom || !activeTo)) {
            setMessage("Choose both From and To dates for the custom range.");
            setToast(true);
            return;
        }

        setIsLoading(true);

        try {
            const params = new URLSearchParams();
            params.set("range", activeRange);

            if (activeRange === "custom") {
                params.set("from", activeFrom);
                params.set("to", activeTo);
            }

            const res = await fetch(
                `https://suvarnagold-16e5.vercel.app/api/staff/all?${params.toString()}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch staff");
            }

            const staffData = (Array.isArray(data.staff) ? data.staff : []).map((member: any) => {
                // Backend must exclude hashes; also avoid retaining them in client state.
                const { passwordHash, password, newPassword, ...safeMember } = member;
                return { ...safeMember, branch: typeof member.branch === "string" ? member.branch : "", roles: normalizeRoles(member.roles) };
            });
            setStaff(staffData);

            // Cache only overall data, because dated metrics change by selection.
            if (activeRange === "overall") {
                staffCache = staffData;
            }


        } catch (error) {
            console.error("Fetch Error:", error);
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Connection error. Please try again."
            );
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

            // Token exists, proceed to fetch staff for the default performance range.
            await fetchStaff(true, "month");
        } catch (error) {
            console.error("Auth check error:", error);
            localStorage.removeItem("token");
            window.location.href = "/auth/login";
        }
    };

    useEffect(() => {
        verifyAuthOnMount();
    }, []);

    // Daily / weekly / monthly / overall changes refetch immediately.
    // Custom waits until both dates are filled.
    useEffect(() => {
        if (!token) return;

        if (performanceRange === "custom") {
            if (customFrom && customTo) {
                fetchStaff(true, "custom", customFrom, customTo);
            }
            return;
        }

        fetchStaff(true, performanceRange);
    }, [performanceRange]);

    const filteredStaff = useMemo(() => {
        const result = [...staff].filter((s) => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch = [s.fullName, s.id, s.phoneNumber, s.branch, roleLabel(s.roles)]
                .some(value => String(value ?? "").toLowerCase().includes(query));
            const matchesGender = genderFilter === "all" || s.gender === genderFilter;
            return matchesSearch && matchesGender;
        });

        if (salarySort === "asc") result.sort((a, b) => Number(a.monthlySalary) - Number(b.monthlySalary));
        if (salarySort === "desc") result.sort((a, b) => Number(b.monthlySalary) - Number(a.monthlySalary));

        if (performanceSort === "salesAmount") {
            result.sort((a, b) => Number(a.salesAmount ?? 0) - Number(b.salesAmount ?? 0));
        }
        if (performanceSort === "cashCollected") {
            result.sort((a, b) => Number(a.cashCollected ?? 0) - Number(b.cashCollected ?? 0));
        }
        if (performanceSort === "upiCollected") {
            result.sort((a, b) => Number(a.upiCollected ?? 0) - Number(b.upiCollected ?? 0));
        }
        if (performanceSort === "cardCollected") {
            result.sort((a, b) => Number(a.cardCollected ?? 0) - Number(b.cardCollected ?? 0));
        }
        if (performanceSort === "chequeCollected") {
            result.sort((a, b) => Number(a.chequeCollected ?? 0) - Number(b.chequeCollected ?? 0));
        }
        if (performanceSort === "totalCollected") {
            result.sort((a, b) => Number(a.totalCollected ?? 0) - Number(b.totalCollected ?? 0));
        }
        if (performanceSort === "salesCount") {
            result.sort((a, b) => Number(a.salesCount ?? 0) - Number(b.salesCount ?? 0));
        }
        if (performanceSort === "cashierCount") {
            result.sort((a, b) => Number(a.cashierCount ?? 0) - Number(b.cashierCount ?? 0));
        }

        if (performanceSort !== "none" && performanceOrder === "desc") {
            result.reverse();
        }

        return result.filter((s) => {
            const minAmount = Number(minAmountFilter) || 0;
            const minCount = Number(minCountFilter) || 0;

            if (
                minAmount > 0 &&
                !(
                    Number(s.salesAmount ?? 0) >= minAmount ||
                    Number(s.cashCollected ?? 0) >= minAmount ||
                    Number(s.upiCollected ?? 0) >= minAmount ||
                    Number(s.cardCollected ?? 0) >= minAmount ||
                    Number(s.chequeCollected ?? 0) >= minAmount ||
                    Number(s.totalCollected ?? 0) >= minAmount
                )
            ) {
                return false;
            }

            if (minCount > 0 && !(Number(s.salesCount ?? 0) >= minCount || Number(s.cashierCount ?? 0) >= minCount)) {
                return false;
            }

            return true;
        });
    }, [staff, searchQuery, genderFilter, salarySort, performanceSort, performanceOrder, minAmountFilter, minCountFilter]);

    const createStaff = async () => {
        if (isSubmitting) return;
        setFormError("");
        const assignmentError = validateAssignment(form.branch, form.roles);
        if (assignmentError) { setFormError(assignmentError); return; }
        if (!form.fullName.trim() || !form.dateOfJoining || Number.isNaN(new Date(form.dateOfJoining).getTime())) { setFormError("Please enter a name and valid joining date."); return; }
        if (String(form.monthlySalary).trim() === "" || !Number.isFinite(Number(form.monthlySalary)) || Number(form.monthlySalary) < 0) { setFormError("Please enter a valid non-negative salary."); return; }

        if (form.phoneNumber.length !== 10) return setFormError("Phone must be 10 digits");
        if (form.aadharNumber.length !== 12) return setFormError("Aadhar must be 12 digits");
        if (form.nomineePhoneNumber.length !== 10) return setFormError("Nominee phone must be 10 digits");
        if (!form.nomineeName) return setFormError("Nominee name is required");
        if (!form.nomineeAddress) return setFormError("Nominee address is required");

        setIsSubmitting(true);
        try {
            const res = await fetch("https://suvarnagold-16e5.vercel.app/api/staff/create", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...form, branch: form.branch.trim(), roles: normalizeRoles(form.roles) })
            });

            if (res.ok) {
                const result = await res.json();
                staffCache = null;
                setMessage(result.message || "Staff Registered Successfully");
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
                    nomineeAddress: "",
                    branch: "",
                    roles: [] as StaffRole[]
                });
            } else {
                const errorData = await res.json();
                setFormError(errorData.error || "Failed to register staff");
            }
        } catch (error) {
            console.error("Create Error:", error);
            setFormError("Connection error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (staffMember: any) => {
        setEditingStaff({
            ...staffMember,
            branch: typeof staffMember.branch === "string" ? staffMember.branch : "",
            roles: normalizeRoles(staffMember.roles),
            dateOfJoining: typeof staffMember.dateOfJoining === "string" ? staffMember.dateOfJoining.slice(0, 10) : "",
        });
        setPasswordMode("keep");
        setNewPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setEditError("");
        setIsEditModalOpen(true);
    };

    const updateStaff = async () => {
        if (isSubmitting) return;
        setEditError("");
        if (!editingStaff) return;
        const assignmentError = validateAssignment(editingStaff.branch, editingStaff.roles);
        if (assignmentError) { setEditError(assignmentError); return; }
        if (!editingStaff.fullName.trim() || !editingStaff.dateOfJoining || Number.isNaN(new Date(editingStaff.dateOfJoining).getTime())) { setEditError("Please enter a name and valid joining date."); return; }
        if (String(editingStaff.monthlySalary).trim() === "" || !Number.isFinite(Number(editingStaff.monthlySalary)) || Number(editingStaff.monthlySalary) < 0) { setEditError("Please enter a valid non-negative salary."); return; }
        let passwordUpdate: ReturnType<typeof passwordPayload>;
        try { passwordUpdate = passwordPayload(passwordMode, newPassword, confirmPassword); }
        catch (error) { setEditError(error instanceof Error ? error.message : "Invalid password."); return; }

        if (editingStaff.phoneNumber.length !== 10) return setEditError("Phone must be 10 digits");
        if (editingStaff.aadharNumber.length !== 12) return setEditError("Aadhar must be 12 digits");
        if (editingStaff.nomineePhoneNumber.length !== 10) return setEditError("Nominee phone must be 10 digits");
        if (!editingStaff.nomineeName) return setEditError("Nominee name is required");
        if (!editingStaff.nomineeAddress) return setEditError("Nominee address is required");

        setIsSubmitting(true);
        try {
            const res = await fetch("http://suvarnagold-16e5.vercel.app/api/staff/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    staffId: editingStaff.id,
                    branch: editingStaff.branch.trim(),
                    roles: normalizeRoles(editingStaff.roles),
                    ...passwordUpdate,
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
                const result = await res.json();
                staffCache = null;
                setNewPassword("");
                setConfirmPassword("");
                setPasswordMode("keep");
                setShowPassword(false);
                setMessage(result.message || "Staff Updated Successfully");
                setToast(true);
                setIsEditModalOpen(false);
                setEditingStaff(null);
                await fetchStaff(true);
            } else {
                const errorData = await res.json();
                setEditError(errorData.error || "Failed to update staff");
            }
        } catch (error) {
            console.error("Update Error:", error);
            setEditError("Connection error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ================= DELETE STAFF FUNCTION =================
    const openDeleteConfirmation = (staffMember: any) => {
        setDeleteConfirmation({
            isOpen: true,
            staffId: staffMember.id,
            staffName: staffMember.fullName,
            isDeleting: false
        });
    };

    const deleteStaff = async () => {
        if (!deleteConfirmation.staffId) return;

        setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));

        try {
            const res = await fetch(`https://suvarnagold-16e5.vercel.app/api/staff/delete/${deleteConfirmation.staffId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                setMessage(`${deleteConfirmation.staffName} has been deleted successfully`);
                setToast(true);

                // Close confirmation dialog
                setDeleteConfirmation({
                    isOpen: false,
                    staffId: null,
                    staffName: "",
                    isDeleting: false
                });

                // Close detail modal if open
                if (selectedStaff?.id === deleteConfirmation.staffId) {
                    setSelectedStaff(null);
                }

                // Refresh the staff list
                staffCache = null; // Clear cache to force fresh fetch
                await fetchStaff(true);
            } else {
                const errorData = await res.json();
                alert(errorData.error || "Failed to delete staff member");
                setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Connection error. Please try again.");
            setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-[#FCFBF7] font-sans">
                <DashboardSidebar />

                {/* Delete Confirmation Dialog */}
                <DeleteConfirmationDialog
                    isOpen={deleteConfirmation.isOpen}
                    staffName={deleteConfirmation.staffName}
                    isDeleting={deleteConfirmation.isDeleting}
                    onConfirm={deleteStaff}
                    onCancel={() => setDeleteConfirmation({
                        isOpen: false,
                        staffId: null,
                        staffName: "",
                        isDeleting: false
                    })}
                />

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
                                        <div className="flex justify-between gap-4"><span>Employee ID</span><span className="font-bold">{selectedStaff.id}</span></div>
                                        <div className="flex justify-between gap-4"><span>Branch</span><span className="font-bold text-right break-words">{selectedStaff.branch || "Not assigned"}</span></div>
                                        <div className="flex justify-between gap-4"><span>Roles</span><span className="font-bold text-right">{roleLabel(selectedStaff.roles)}</span></div>
                                        <div className="flex justify-between"><span>Phone</span><span className="font-bold">{selectedStaff.phoneNumber}</span></div>
                                        <div className="flex justify-between"><span>Aadhar</span><span className="font-mono text-xs">{selectedStaff.aadharNumber}</span></div>
                                        {selectedStaff.panCardNumber && <div className="flex justify-between"><span>Pan Card</span><span className="font-mono text-xs">{selectedStaff.panCardNumber}</span></div>}
                                        <div className="flex justify-between"><span>Gender</span><span className="font-bold">{selectedStaff.gender}</span></div>
                                        <div className="flex justify-between"><span>Salary</span><span className="text-amber-700 font-bold">₹{selectedStaff.monthlySalary}</span></div>
                                        <div className="flex justify-between"><span>Sales Amount</span><span className="text-slate-700 font-bold">₹{Number(selectedStaff.salesAmount ?? 0).toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between"><span>Sales Count</span><span className="text-slate-700 font-bold">{selectedStaff.salesCount ?? 0}</span></div>
                                        <div className="flex justify-between"><span>Cash Collected</span><span className="text-emerald-700 font-bold">₹{Number(selectedStaff.cashCollected ?? 0).toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between"><span>UPI Collected</span><span className="text-blue-700 font-bold">₹{Number(selectedStaff.upiCollected ?? 0).toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between"><span>Card Collected</span><span className="text-violet-700 font-bold">₹{Number(selectedStaff.cardCollected ?? 0).toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between"><span>Cheque Collected</span><span className="text-orange-700 font-bold">₹{Number(selectedStaff.chequeCollected ?? 0).toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between border-t pt-2"><span>Total Collected</span><span className="text-slate-900 font-black">₹{Number(selectedStaff.totalCollected ?? 0).toLocaleString("en-IN")}</span></div>
                                        <div className="flex justify-between"><span>Cashier Transactions</span><span className="text-slate-700 font-bold">{selectedStaff.cashierCount ?? 0}</span></div>
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
                                    <Button
                                        variant="destructive"
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => {
                                            setSelectedStaff(null);
                                            openDeleteConfirmation(selectedStaff);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
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
                                <button onClick={closeEditModal} disabled={isSubmitting}><X /></button>
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

                                    <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-blue-100 pt-4">
                                        <BranchField id="edit-branch" value={editingStaff.branch} options={branchOptions}
                                            onChange={branch => setEditingStaff({ ...editingStaff, branch })} disabled={isSubmitting} />
                                        <RoleDropdown id="edit-roles" value={editingStaff.roles}
                                            onChange={roles => setEditingStaff({ ...editingStaff, roles })} disabled={isSubmitting} />
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

                                <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                                    <label htmlFor="password-action" className="text-sm font-semibold text-slate-800">Staff password</label>
                                    <select id="password-action" value={passwordMode} disabled={isSubmitting}
                                        className="w-full rounded-md border border-blue-200 bg-white p-2.5 text-sm"
                                        onChange={event => { setPasswordMode(event.target.value as PasswordMode); setNewPassword(""); setConfirmPassword(""); setShowPassword(false); setEditError(""); }}>
                                        <option value="keep">Keep existing password</option>
                                        <option value="custom">Set a custom password</option>
                                        <option value="default">Reset to employee ID</option>
                                    </select>
                                    {passwordMode === "custom" && (
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label htmlFor="new-staff-password" className="text-xs font-medium">New password</label>
                                                <Input id="new-staff-password" type={showPassword ? "text" : "password"}
                                                    autoComplete="new-password" value={newPassword} disabled={isSubmitting}
                                                    onChange={event => setNewPassword(event.target.value)} placeholder="At least 8 characters" />
                                            </div>
                                            <div className="space-y-1">
                                                <label htmlFor="confirm-staff-password" className="text-xs font-medium">Confirm new password</label>
                                                <Input id="confirm-staff-password" type={showPassword ? "text" : "password"}
                                                    autoComplete="new-password" value={confirmPassword} disabled={isSubmitting}
                                                    onChange={event => setConfirmPassword(event.target.value)} />
                                            </div>
                                            <label className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" checked={showPassword} disabled={isSubmitting} onChange={event => setShowPassword(event.target.checked)} /> Show password
                                            </label>
                                        </div>
                                    )}
                                    {passwordMode === "default" && <p className="text-sm text-amber-800">Saving will replace the password with employee ID <strong>{editingStaff.id}</strong>.</p>}
                                    {passwordMode === "keep" && <p className="text-xs text-slate-500">Existing passwords stay unchanged. If no password exists yet, it will be initialized to the employee ID.</p>}
                                </div>
                                {editError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{editError}</p>}

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-8">
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 h-11"
                                        onClick={closeEditModal}
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
                                    onClick={() => fetchStaff(true, performanceRange, customFrom, customTo)}
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
                                            placeholder="Search name, ID, phone, branch or role..."
                                            className="pl-10 bg-white border-gold/10 focus:border-gold"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
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
                                {/* Performance Period */}
                                <div className="rounded-xl border border-amber-100 bg-white p-3 space-y-3">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-[0.18em] font-black text-amber-800">
                                                Performance Period
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Sales and collections are recalculated by the API for this date range.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {(["day", "week", "month", "overall", "custom"] as const).map((range) => (
                                                <Button
                                                    key={range}
                                                    type="button"
                                                    variant={performanceRange === range ? "default" : "outline"}
                                                    size="sm"
                                                    className={
                                                        performanceRange === range
                                                            ? "h-8 capitalize bg-amber-600 hover:bg-amber-700"
                                                            : "h-8 capitalize border-amber-100"
                                                    }
                                                    onClick={() => setPerformanceRange(range)}
                                                >
                                                    {range === "day" ? "Daily" :
                                                        range === "week" ? "Weekly" :
                                                            range === "month" ? "Monthly" :
                                                                range === "overall" ? "Overall" :
                                                                    "Custom"}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {performanceRange === "custom" && (
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                                            <div>
                                                <label className="text-[9px] font-bold uppercase text-slate-400">From</label>
                                                <Input
                                                    type="date"
                                                    className="h-10 border-gold/10 text-xs"
                                                    value={customFrom}
                                                    onChange={(e) => setCustomFrom(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold uppercase text-slate-400">To</label>
                                                <Input
                                                    type="date"
                                                    className="h-10 border-gold/10 text-xs"
                                                    value={customTo}
                                                    min={customFrom || undefined}
                                                    onChange={(e) => setCustomTo(e.target.value)}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="self-end h-10 border-amber-200 text-amber-800"
                                                disabled={!customFrom || !customTo}
                                                onClick={() => fetchStaff(true, "custom", customFrom, customTo)}
                                            >
                                                Apply
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Existing custom staff filters */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                    <select
                                        className="h-10 rounded-md border border-gold/10 bg-white px-3 text-xs outline-none"
                                        value={performanceSort}
                                        onChange={(e) => setPerformanceSort(e.target.value)}
                                    >
                                        <option value="none">Sort by Performance</option>
                                        <option value="salesAmount">Sales Amount</option>
                                        <option value="salesCount">Sales Count</option>
                                        <option value="totalCollected">Total Collected</option>
                                        <option value="cashCollected">Cash Collected</option>
                                        <option value="upiCollected">UPI Collected</option>
                                        <option value="cardCollected">Card Collected</option>
                                        <option value="chequeCollected">Cheque Collected</option>
                                        <option value="cashierCount">Cashier Transactions</option>
                                    </select>
                                    <select
                                        className="h-10 rounded-md border border-gold/10 bg-white px-3 text-xs outline-none"
                                        value={performanceOrder}
                                        onChange={(e) => setPerformanceOrder(e.target.value)}
                                    >
                                        <option value="desc">Highest First</option>
                                        <option value="asc">Lowest First</option>
                                    </select>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="Minimum amount"
                                        className="h-10 border-gold/10 text-xs"
                                        value={minAmountFilter}
                                        onChange={(e) => setMinAmountFilter(e.target.value)}
                                    />
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="Minimum count"
                                        className="h-10 border-gold/10 text-xs"
                                        value={minCountFilter}
                                        onChange={(e) => setMinCountFilter(e.target.value)}
                                    />
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
                                                    <p className="font-serif font-bold text-slate-800">
                                                        {s.fullName} <span className="font-sans font-normal text-slate-500">[{s.id}]</span>
                                                    </p>
                                                    <p className="text-xs text-slate-400">{s.phoneNumber}</p>
                                                    <p className="mt-1 text-xs text-slate-600 break-words">{s.branch || "Branch not assigned"} · {roleLabel(s.roles)}</p>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                                        <span className="rounded-full bg-amber-50 px-2 py-1">
                                                            Sales ₹{Number(s.salesAmount ?? 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="rounded-full bg-slate-50 px-2 py-1">
                                                            Sales {s.salesCount ?? 0}
                                                        </span>
                                                        <span className="rounded-full bg-emerald-50 px-2 py-1">
                                                            Cash ₹{Number(s.cashCollected ?? 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="rounded-full bg-blue-50 px-2 py-1">
                                                            UPI ₹{Number(s.upiCollected ?? 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="rounded-full bg-violet-50 px-2 py-1">
                                                            Card ₹{Number(s.cardCollected ?? 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="rounded-full bg-orange-50 px-2 py-1">
                                                            CHQ ₹{Number(s.chequeCollected ?? 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="rounded-full bg-slate-100 px-2 py-1 font-bold">
                                                            Collected ₹{Number(s.totalCollected ?? 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="rounded-full bg-slate-50 px-2 py-1">
                                                            Txns {s.cashierCount ?? 0}
                                                        </span>
                                                    </div>
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
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDeleteConfirmation(s);
                                                    }}
                                                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete staff member"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

                                <div className="space-y-4 rounded-lg border border-amber-200/40 bg-amber-50/30 p-4">
                                    <BranchField id="create-branch" value={form.branch} options={branchOptions}
                                        onChange={branch => setForm({ ...form, branch })} disabled={isSubmitting} />
                                    <RoleDropdown id="create-roles" value={form.roles}
                                        onChange={roles => setForm({ ...form, roles })} disabled={isSubmitting} />
                                    <p className="text-xs text-slate-600">The initial password will be the employee ID. You can change it from Edit Staff after registration.</p>
                                </div>
                                {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

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