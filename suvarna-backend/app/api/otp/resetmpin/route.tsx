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
    let msg91Payload: any = null; 

    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json(
                { error: "Phone number is required" }, 
                { status: 400, headers: corsHeaders }
            );
        }

        // 1. Generate OTP and Expiration
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 2. Save to Database
        await prisma.otpVerification.create({
            data: {
                phoneNumber: phone,
                otpCode: otpCode,
                purpose: "mpin_reset", // Updated to specifically track MPIN resets
                expiresAt: expiresAt,
            },
        });

        // 3. Construct the MSG91 Payload
        msg91Payload = {
            // Ensure this environment variable points to your specific MPIN reset template ID in MSG91
            template_id: process.env.RESET_MPIN_TEMPLATE_ID, 
            short_url: "0", 
            recipients: [
                {
                    mobiles: `91${phone}`, 
                    // Matching your template variables exactly
                    // Note: If this fails silently again, check if MSG91 renamed 'var1' to something else in their UI
                    var1: otpCode, 
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

        console.log("--- MSG91 MPIN RESET LOGS ---");
        console.log("Sent Payload:", JSON.stringify(msg91Payload, null, 2));
        console.log("MSG91 HTTP Status:", msg91Status);
        console.log("MSG91 Response Data:", JSON.stringify(data, null, 2));

        if (msg91Status !== 200 || data.type === "error") {
            return NextResponse.json(
                { 
                    error: "MSG91 API rejected the request", 
                    msg91Status,
                    msg91Response: data,
                    debugRequestPayload: msg91Payload 
                }, 
                { status: 400, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            { 
                success: true, 
                message: "MPIN Reset OTP saved and sent via MSG91", 
                msg91Status,
                msg91Response: data,
                debugRequestPayload: msg91Payload 
            },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error("MPIN OTP Processing Error:", error);
        return NextResponse.json(
            { 
                error: "Failed to process MPIN OTP request", 
                details: error.message || error,
                debugRequestPayload: msg91Payload 
            }, 
            { status: 500, headers: corsHeaders }
        );
    }
}