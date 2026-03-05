import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "PUT,OPTIONS",
    };
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders(),
    });
}

export async function PUT(req: Request) {

    try {

        const authHeader = req.headers.get("authorization");

        if (!authHeader) {
            return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: corsHeaders(),
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded: any = verifyToken(token);

        if (!decoded || decoded.role !== "SUPER_ADMIN") {
            return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
                status: 403,
                headers: corsHeaders(),
            });
        }

        const body = await req.json();

        const jobwork = await prisma.goldJobWork.update({
            where: { id: body.id },
            data: {
                status: body.status,
                dateReceived: body.dateReceived
                    ? new Date(body.dateReceived)
                    : undefined,
                wastageGrams: body.wastageGrams
                    ? parseFloat(body.wastageGrams)
                    : undefined,
                returnedGoldGrams: body.returnedGoldGrams
                    ? parseFloat(body.returnedGoldGrams)
                    : undefined,
                makingCharge: body.makingCharge
                    ? parseFloat(body.makingCharge)
                    : undefined,
            },
        });
        return new NextResponse(
            JSON.stringify({ jobwork }),
            { status: 200, headers: corsHeaders() }
        );

    } catch (error) {
        console.error("JOBWORK STATUS ERROR:", error);

        return new NextResponse(
            JSON.stringify({ error: "Failed to update status" }),
            { status: 500, headers: corsHeaders() }
        );

    }

}