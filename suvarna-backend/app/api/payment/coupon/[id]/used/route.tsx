import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// CORS
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
}

// Preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders(),
    });
}

// POST - Use Coupon
export async function POST(req: Request,
    { params }: { params: Promise<{ id: string }> }) {
    try {
        const authHeader = req.headers.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new NextResponse(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: corsHeaders() }
            );
        }

        const token = authHeader.split(" ")[1];
        const user = verifyToken(token);

        const { id } = await params;
        const code = id.trim();

        if (!code) {
            return new NextResponse(
                JSON.stringify({ error: "Coupon code required" }),
                { status: 400, headers: corsHeaders() }
            );
        }

        // Parse body for optional invoiceNumber
        const body = await req.json().catch(() => ({}));
        const { invoiceNumber } = body as { invoiceNumber?: string };

        // Find coupon
        const coupon = await prisma.coupon.findUnique({
            where: { code },
        });

        if (!coupon) {
            return new NextResponse(
                JSON.stringify({ error: "Coupon not found" }),
                { status: 404, headers: corsHeaders() }
            );
        }

        // Validation
        if (!coupon.isActive || coupon.isUsed) {
            return new NextResponse(
                JSON.stringify({ error: "Coupon not valid or already used" }),
                { status: 400, headers: corsHeaders() }
            );
        }

        // Update coupon - mark as used and store invoice number
        const updatedCoupon = await prisma.coupon.update({
            where: { code },
            data: {
                isUsed: true,
                isActive: false,
                usedAt: new Date(),
                ...(invoiceNumber ? { invoiceNumber } : {}),
            },
        });

        return new NextResponse(
            JSON.stringify({
                message: "Coupon applied successfully",
                coupon: updatedCoupon,
            }),
            { status: 200, headers: corsHeaders() }
        );

    } catch (error) {
        console.error("USE COUPON ERROR:", error);

        return new NextResponse(
            JSON.stringify({ error: "Server error" }),
            { status: 500, headers: corsHeaders() }
        );
    }
}
