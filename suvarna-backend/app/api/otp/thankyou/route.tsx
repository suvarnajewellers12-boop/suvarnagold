import { NextRequest, NextResponse } from "next/server";

// Shared CORS headers configuration
const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Replace "*" with your frontend URL (e.g., "https://yourdomain.com") for strict security
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handles the preflight request from the browser
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
    try {
        // Extract both name and phone from the incoming JSON request
        const { name, phone } = await req.json();

        // Validate that both fields are provided
        if (!phone || !name) {
            return NextResponse.json(
                { error: "Both name and phone number are required" }, 
                { status: 400, headers: corsHeaders }
            );
        }

        const response = await fetch("https://control.msg91.com/api/v5/flow/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "authkey": process.env.MSG91_AUTH_KEY!,
            },
            body: JSON.stringify({
                // Ensure this points to the MSG91 alphanumeric template ID
                template_id: process.env.MSG91_THANK_YOU_TEMPLATE_ID, 
                short_url: "0", // Disables hidden tracking URLs that break DLT exact matching
                recipients: [
                    {
                        mobiles: `91${phone}`, 
                        // Pass the variable exactly as it appears in the template (without the ##)
                        var1: name, 
                    },
                ],
            }),
        });

        const data = await response.json();

        // Optional: Catch MSG91-specific API errors even if the HTTP status is 200
        if (data.type === "error") {
            console.error("MSG91 API Error:", data);
            return NextResponse.json(
                { error: data.message }, 
                { status: 400, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            { success: true, msg91Response: data },
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error("SMS Error:", error);
        return NextResponse.json(
            { error: "Failed to send SMS" }, 
            { status: 500, headers: corsHeaders }
        );
    }
}