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

        // 2. Fetch the most recent OTP for this phone number
        // We use findFirst and sort by descending creation time in case they requested multiple OTPs
        const otpRecord = await prisma.otpVerification.findFirst({
            where: {
                phoneNumber: phone,
                purpose: "password_reset", // Ensures it's verifying for the correct context
            },
            orderBy: {
                expiresAt: 'desc', // Gets the latest generated OTP
            },
        });

        // 3. Check if an OTP record was found
        if (!otpRecord) {
            return NextResponse.json(
                { error: "No OTP request found for this number" },
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

        // 6. Success! Clean up the used OTP so it can't be reused
        await prisma.otpVerification.delete({
            where: {
                id: otpRecord.id, // Assuming your Prisma model has an 'id' primary key
            }
        });

        // Optional: At this step, you can also return an authentication token (JWT) 
        // or a temporary reset token if they need to proceed to a "New Password" screen.

        return NextResponse.json(
            { success: true, message: "OTP verified successfully" },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error("OTP Verification Error:", error);
        return NextResponse.json(
            { 
                error: "Failed to process OTP verification", 
                details: error.message || error 
            }, 
            { status: 500, headers: corsHeaders }
        );
    }
}