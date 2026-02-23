import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount } = body;

    const order = await razorpay.orders.create({
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    return NextResponse.json(order);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
  }
}
