import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import twilio from "twilio";
import nodemailer from "nodemailer";

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

// Helper for CORS headers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // Change this to your frontend URL in production
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// 1. Handle OPTIONS request (CORS Preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_ID,
    pass: process.env.GMAIL_PASSWORD,
  },
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);

    const superAdminPhone = process.env.SUPERADMIN_PHONE!;
    const superAdminEmail = process.env.GMAIL_ID!;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 1. Database operation (Keep this AWAITED so we know the OTP is valid)
    await prisma.otpVerification.create({
      data: {
        phoneNumber: superAdminPhone,
        otpCode,
        purpose: "discount_approval",
        requestedById: user.id,
        expiresAt,
      },
    });

    const message = `Your Suvarna verification OTP is ${otpCode} for discount approval.`;

    // 2. BACKGROUND TASKS (DO NOT USE 'AWAIT')
    // We trigger these but don't wait for them to finish before responding
    client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: `whatsapp:${superAdminPhone}`,
    }).catch(err => console.error("Twilio Background Error:", err));

    transporter.sendMail({
      from: '"Suvarna Jewellers" <suvarnajewellers12@gmail.com>',
      to: superAdminEmail,
      subject: "Discount Approval Request - OTP",
      html: `<b>${message}</b>`,
    }).catch(err => console.error("Nodemailer Background Error:", err));

    // 3. IMMEDIATE RESPONSE
    // This sends the response to the frontend instantly (~200ms)
    return NextResponse.json(
      { success: true, message: "Request initiated" },
      { headers: corsHeaders() }
    );

  } catch (error) {
    console.error("OTP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to process request" }, 
      { status: 500, headers: corsHeaders() }
    );
  }
}