import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);

    const body = await req.json();

    const {
      discountPercent,
      customerName,
      adminName
    } = body;

    if (!discountPercent || !customerName || !adminName) {
      return new NextResponse(
        JSON.stringify({
          error: "discountPercent, customerName, adminName required"
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const superAdminPhone = process.env.SUPERADMIN_PHONE!;

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store OTP
    await prisma.otpVerification.create({
      data: {
        phoneNumber: superAdminPhone,
        otpCode,
        purpose: "discount_approval",
        requestedById: user.id,
        expiresAt,
      },
    });

    // SMS Body
    const message = `Your Suvarna verification OTP is ${otpCode} for ${discountPercent}% on the purchase by ${customerName}. 
If you agree with the discount say the OTP to ${adminName}. 
It is valid for 5 minutes. Do not share this OTP with anyone.
- Suvarna Jewellers`;

console.log("FROM:", process.env.TWILIO_WHATSAPP_FROM);
console.log("TO:", `whatsapp:${superAdminPhone}`);

    // Send SMS via Twilio
    // Send WhatsApp via Twilio
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_FROM!,        // whatsapp:+14155238886
      to: `whatsapp:${superAdminPhone}`,             // whatsapp:+918555025407
    });

    

    return new NextResponse(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully"
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("OTP GENERATE ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Failed to send OTP" }),
      { status: 500, headers: corsHeaders() }
    );

  }
}