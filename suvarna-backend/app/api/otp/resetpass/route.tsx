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
    let msg91Payload: any = null;

    try {
        const { phone, purpose } = await req.json();

        if (!phone) {
            return NextResponse.json(
                { error: "Phone number is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        // Use purpose from request if present (falls back to forgot_password)
        const targetPurpose = purpose || "forgot_password";

        // 1. Generate OTP and Expiration
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 2. Save to Database
        await prisma.otpVerification.create({
            data: {
                phoneNumber: phone,
                otpCode: otpCode,
                purpose: targetPurpose,
                expiresAt: expiresAt,
            },
        });

        // 3. Construct the MSG91 Payload
        msg91Payload = {
            template_id: process.env.RESET_PASSWORD_TEMPLATE_ID,
            short_url: "0",
            recipients: [
                {
                    mobiles: `91${phone}`,
                    var1: otpCode
                },
            ],
        };

        // 4. Send the SMS via MSG91
        const response = await fetch("https://control.msg91.com/api/v5/flow/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "authkey": process.env.MSG91_AUTH_KEY!,
            },
            body: JSON.stringify(msg91Payload),
        });

        const msg91Status = response.status;
        const data = await response.json();

        if (msg91Status !== 200 || data.type === "error") {
            return NextResponse.json(
                {
                    error: "MSG91 API rejected the request",
                    msg91Status,
                    msg91Response: data,
                },
                { status: 400, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "OTP saved and request sent to MSG91",
            },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error("OTP Processing Error:", error);
        return NextResponse.json(
            {
                error: "Failed to process OTP request",
                details: error.message || error,
            },
            { status: 500, headers: corsHeaders }
        );
    }
}