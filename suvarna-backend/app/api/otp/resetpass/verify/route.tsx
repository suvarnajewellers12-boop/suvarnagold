import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
    try {
        const { phone, otp, purpose } = await req.json();

        if (!phone || !otp) {
            return NextResponse.json(
                { error: "Phone number and OTP are required" }, 
                { status: 400, headers: corsHeaders }
            );
        }

        const targetPurpose = purpose || "forgot_password";

        // 1. Fetch the most recent OTP
        const otpRecord = await prisma.otpVerification.findFirst({
            where: {
                phoneNumber: phone,
                purpose: targetPurpose,
            },
            orderBy: {
                expiresAt: 'desc',
            },
        });

        if (!otpRecord) {
            return NextResponse.json(
                { error: "No OTP request found for this number" },
                { status: 400, headers: corsHeaders }
            );
        }

        // 2. Verify the OTP matches
        if (otpRecord.otpCode !== otp.toString()) {
            return NextResponse.json(
                { error: "Invalid OTP code" },
                { status: 400, headers: corsHeaders }
            );
        }

        // 3. Check Expiration Date
        const now = new Date();
        if (now > otpRecord.expiresAt) {
            return NextResponse.json(
                { error: "OTP has expired. Please request a new one." },
                { status: 400, headers: corsHeaders }
            );
        }

        // 4. Update the record to state it was successfully verified instead of deleting it!
        await prisma.otpVerification.update({
            where: { id: otpRecord.id },
            data: {
                isUsed: true,
                verifiedAt: new Date()
            }
        });

        return NextResponse.json(
            { type: "success", success: true, message: "OTP verified successfully" },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error("OTP Verification Error:", error);
        return NextResponse.json(
            { error: "Failed to process OTP verification" }, 
            { status: 500, headers: corsHeaders }
        );
    }
}