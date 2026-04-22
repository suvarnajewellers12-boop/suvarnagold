import { prisma } from "@/lib/prisma";

import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";



// CORS

function corsHeaders() {

  return {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers": "Content-Type, Authorization",

    "Access-Control-Allow-Methods": "GET, OPTIONS",

  };

}



// Preflight

export async function OPTIONS() {

  return new NextResponse(null, {

    status: 200,

    headers: corsHeaders(),

  });

}



// GET Coupon

export async function GET(

  req: Request,

  { params }: { params: Promise<{ id: string }> }

) {

  try {

    // 🔐 AUTH CHECK

    const authHeader = req.headers.get("authorization");



    if (!authHeader) {

      return new NextResponse(

        JSON.stringify({ error: "Unauthorized" }),

        { status: 401, headers: corsHeaders() }

      );

    }



    const token = authHeader.split(" ")[1];

    const user = verifyToken(token); // you can use this later if needed



    // 📌 PARAM

    const { id } = await params;

    const code = id.trim();



    console.log("Fetching coupon:", code);



    // 🔍 FETCH COUPON (IMPORTANT FIX)

    const coupon = await prisma.coupon.findUnique({

      where: { code }, // ✅ correct field

    });



    if (!coupon) {

      return NextResponse.json(

        { error: "Coupon not found" },

        { status: 404, headers: corsHeaders() }

      );

    }



    // 🔒 VALIDATION

    if (!coupon.isActive || coupon.isUsed) {

      return NextResponse.json(

        { error: "Coupon already used or inactive" },

        { status: 400, headers: corsHeaders() }

      );

    }



    // 🎯 RESPONSE TYPE

    const response =

      coupon.totalCashValue > 0

        ? {

          type: "CASH",

          value: coupon.totalCashValue,

        }

        : {

          type: "WEIGHT",

          value: coupon.totalWeightGrams,

        };



    return NextResponse.json(response, {

      headers: corsHeaders(),

    });



  } catch (error) {

    console.error("COUPON ERROR:", error);



    return NextResponse.json(

      { error: "Server error" },

      { status: 500, headers: corsHeaders() }

    );

  }

}