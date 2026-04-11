import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: "Phone number required" }, { status: 400 });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        const response = await fetch("https://control.msg91.com/api/v5/flow/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "authkey": process.env.MSG91_AUTH_KEY!,
            },
            body: JSON.stringify({
                template_id: process.env.MSG91_TEMPLATE_ID,
                short_url: "0",
                recipients: [
                    {
                        mobiles: `91${phone}`,
                        OTP: otp.toString(), // ✅ MUST match ##number##
                    },
                ],
            }),
        });

        const data = await response.json();

        return NextResponse.json({
            success: true,
            otp, // ⚠️ remove this in production
            msg91Response: data,
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
    }
}