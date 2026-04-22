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



// POST → Use Coupon

export async function POST(req: Request,

    { params }: { params: Promise<{ id: string }> }) {

    try {

        // 🔐 AUTH

        const authHeader = req.headers.get("authorization");



        if (!authHeader || !authHeader.startsWith("Bearer ")) {

            return new NextResponse(

                JSON.stringify({ error: "Unauthorized" }),

                { status: 401, headers: corsHeaders() }

            );

        }



        const token = authHeader.split(" ")[1];

        const user = verifyToken(token); // optional: use for ownership check



        // 📥 BODY

        const { id } = await params;

        console.log("Received coupon ID:", id);



        const code = id.trim();



        console.log("Applying coupon code:", code);



        if (!code) {

            return new NextResponse(

                JSON.stringify({ error: "Coupon code required" }),

                { status: 400, headers: corsHeaders() }

            );

        }



        // 🔍 FIND COUPON

        const coupon = await prisma.coupon.findUnique({

            where: { code },

        });



        if (!coupon) {

            return new NextResponse(

                JSON.stringify({ error: "Coupon not found" }),

                { status: 404, headers: corsHeaders() }

            );

        }



        // 🔒 VALIDATION

        if (!coupon.isActive || coupon.isUsed) {

            return new NextResponse(

                JSON.stringify({ error: "Coupon not valid or already used" }),

                { status: 400, headers: corsHeaders() }

            );

        }



        // (Optional 🔥) Ensure coupon belongs to user

        // if (coupon.customerId !== user.id) {

        //   return new NextResponse(

        //     JSON.stringify({ error: "Not your coupon" }),

        //     { status: 403, headers: corsHeaders() }

        //   );

        // }



        // ✅ UPDATE COUPON

        const updatedCoupon = await prisma.coupon.update({

            where: { code },

            data: {

                isUsed: true,

                isActive: false,

                usedAt: new Date(),

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