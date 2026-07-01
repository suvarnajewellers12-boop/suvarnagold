import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
    try {
        const { phone, otp } = await req.json();

        // 1. Validate Input
        if (!phone || !otp) {
            return NextResponse.json(
                { error: "Phone number and OTP are required" }, 
                { status: 400, headers: corsHeaders }
            );
        }

        // 2. Fetch the most recent MPIN OTP for this phone number
        const otpRecord = await prisma.otpVerification.findFirst({
            where: {
                phoneNumber: phone,
                purpose: "mpin_reset", // Strictly targeting MPIN resets
            },
            orderBy: {
                expiresAt: 'desc', // Ensures we grab the newest one if multiple were requested
            },
        });

        // 3. Check if an OTP record exists
        if (!otpRecord) {
            return NextResponse.json(
                { error: "No MPIN reset request found for this number" },
                { status: 400, headers: corsHeaders }
            );
        }

        // 4. Verify the OTP matches
        if (otpRecord.otpCode !== otp.toString()) {
            return NextResponse.json(
                { error: "Invalid OTP code" },
                { status: 400, headers: corsHeaders }
            );
        }

        // 5. Check Expiration Date
        const now = new Date();
        if (now > otpRecord.expiresAt) {
            return NextResponse.json(
                { error: "OTP has expired. Please request a new one." },
                { status: 400, headers: corsHeaders }
            );
        }

        // 6. Clean up: Delete the OTP so it cannot be reused
        await prisma.otpVerification.delete({
            where: {
                id: otpRecord.id, 
            }
        });

        // 7. Success Response
        // Note: At this stage, you might want to issue a temporary token 
        // to authorize the user to submit their new MPIN in the next step.
        return NextResponse.json(
            { success: true, message: "MPIN OTP verified successfully" },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error("MPIN OTP Verification Error:", error);
        return NextResponse.json(
            { 
                error: "Failed to verify MPIN OTP", 
                details: error.message || error 
            }, 
            { status: 500, headers: corsHeaders }
        );
    }
}