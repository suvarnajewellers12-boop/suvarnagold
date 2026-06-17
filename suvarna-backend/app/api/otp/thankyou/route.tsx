import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: "Phone number required" }, { status: 400 });
        }

        const response = await fetch("https://control.msg91.com/api/v5/flow/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "authkey": process.env.MSG91_AUTH_KEY!,
            },
            body: JSON.stringify({
                // Ensure this points to the MSG91 alphanumeric template ID, 
                // NOT the 19-digit DLT Template ID
                template_id: process.env.MSG91_THANK_YOU_TEMPLATE_ID, 
                short_url: "0", // Disables hidden tracking URLs that break DLT exact matching
                recipients: [
                    {
                        mobiles: `91${phone}`, 
                        // ⚠️ Notice: No extra variables passed here at all
                    },
                ],
            }),
        });

        const data = await response.json();

        return NextResponse.json({
            success: true,
            msg91Response: data,
        });

    } catch (error) {
        console.error("SMS Error:", error);
        return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
    }
}