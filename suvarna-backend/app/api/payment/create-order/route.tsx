import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(req: Request) {

  try {

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    const body = await req.json();

    const order = await razorpay.orders.create({
      amount: body.amount * 100, // rupees → paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    return new NextResponse(
      JSON.stringify({ order }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("RAZORPAY ORDER ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Payment order failed" }),
      { status: 500, headers: corsHeaders() }
    );

  }
}