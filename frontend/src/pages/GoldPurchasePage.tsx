"use client";

import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Coins, Landmark } from "lucide-react";

export default function GoldPurchasePage() {

    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

    const [form, setForm] = useState({
        companyName: "",
        goldType: "BISCUIT",
        grams: "",
        pricePerGram: "",
        totalAmount: "",
        purchaseDate: "",
        invoiceNumber: "",
        paymentMode: "",
        notes: "",
    });

    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async () => {

        try {

            const res = await fetch(
                "https://suvarnagold-16e5.vercel.app/api/gold/purchase",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        ...form,
                        grams: Number(form.grams),
                        pricePerGram: Number(form.pricePerGram),
                        totalAmount: Number(form.totalAmount)
                    })
                }
            );

            if (res.ok) {
                setToastMessage("Gold Purchase Recorded");
                setShowToast(true);

                setForm({
                    companyName: "",
                    goldType: "BISCUIT",
                    grams: "",
                    pricePerGram: "",
                    totalAmount: "",
                    purchaseDate: "",
                    invoiceNumber: "",
                    paymentMode: "",
                    notes: "",
                });
            }

        } catch {
            setToastMessage("Purchase Failed");
            setShowToast(true);
        }

    };

    return (<SidebarProvider>

        <div className="min-h-screen flex bg-[#FCFBF7] w-full">

            <DashboardSidebar />

            <main className="flex-1 p-10">

                <h1 className="text-xl font-serif font-bold flex items-center gap-2 mb-6">
                    <Coins className="text-gold" /> Gold Procurement
                </h1>

                <LuxuryCard className="p-8 space-y-5">

                    <Input
                        placeholder="Supplier / Company Name"
                        value={form.companyName}
                        onChange={(e) => handleChange("companyName", e.target.value)}
                    />

                    <select
                        className="border rounded-xl p-3"
                        value={form.goldType}
                        onChange={(e) => handleChange("goldType", e.target.value)}

                    >

                        <option value="BISCUIT">Biscuit</option>
                        <option value="MUDHA">Mudha</option>
                    </select>

                    <Input
                        placeholder="Total Grams"
                        value={form.grams}
                        onChange={(e) => handleChange("grams", e.target.value)}
                    />

                    <Input
                        placeholder="Price Per Gram"
                        value={form.pricePerGram}
                        onChange={(e) => handleChange("pricePerGram", e.target.value)}
                    />

                    <Input
                        placeholder="Total Amount"
                        value={form.totalAmount}
                        onChange={(e) => handleChange("totalAmount", e.target.value)}
                    />

                    <Input
                        type="date"
                        value={form.purchaseDate}
                        onChange={(e) => handleChange("purchaseDate", e.target.value)}
                    />

                    <Input
                        placeholder="Invoice Number"
                        value={form.invoiceNumber}
                        onChange={(e) => handleChange("invoiceNumber", e.target.value)}
                    />

                    <Input
                        placeholder="Payment Mode"
                        value={form.paymentMode}
                        onChange={(e) => handleChange("paymentMode", e.target.value)}
                    />

                    <textarea
                        className="w-full border rounded-xl p-3"
                        placeholder="Notes"
                        value={form.notes}
                        onChange={(e) => handleChange("notes", e.target.value)}
                    />

                    <GoldDivider />

                    <Button
                        variant="gold"
                        className="w-full"
                        onClick={handleSubmit}
                    >
                        Record Purchase
                    </Button>

                </LuxuryCard>

            </main>

            <SuccessToast
                message={toastMessage}
                isVisible={showToast}
                onClose={() => setShowToast(false)}
            />

        </div>
    </SidebarProvider>
    );
}
