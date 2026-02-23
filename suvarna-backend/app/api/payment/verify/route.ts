import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      cartItems,
      customerName,
      total,
      gst,
      discount,
    } = body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // 🔥 Create Purchase Record
    const purchase = await prisma.purchase.create({
      data: {
        customerName,
        totalAmount: total,
        gstAmount: gst,
        discountAmount: discount,
        finalAmount: total + gst - discount,
        paymentId: razorpay_payment_id,
        paymentStatus: "SUCCESS",
        adminId: "ADMIN_ID_HERE", // from token later
        items: {
          create: cartItems.map((item: any) => ({
            productId: item.id,
            name: item.name,
            grams: item.grams,
            cost: item.price,
          })),
        },
      },
    });

    // 🔥 Mark products as sold
    for (const item of cartItems) {
      await prisma.product.update({
        where: { id: item.id },
        data: { isSold: true },
      });
    }

    return NextResponse.json({ message: "Payment verified & stored" });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
