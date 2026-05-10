import { NextResponse } from "next/server";
import nodemailer from 'nodemailer';
import { verifyToken } from "@/lib/auth";

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

// Comprehensive CORS headers for local development
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "http://localhost:8080",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
});

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// Add this at the top of your API route file
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increases the limit to 10 Megabytes
    },
  },
};

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  
  try {
    // 1. Authorize the TechSpire session
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(origin) });
    }

    const token = authHeader.split(" ")[1];
    verifyToken(token);

    const { email, customerName, invoice, pdfData } = await req.json();

    // 2. Nodemailer Configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_ID,
        pass: process.env.GMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: '"Suvarna Jewellers" <suvarnajewellers12@gmail.com>',
      to: email,
      subject: `Invoice ${invoice} - Suvarna Jewellers`,
      text: `Dear ${customerName}, please find your attached invoice.`,
      attachments: [{
        filename: `Invoice_${invoice}.pdf`,
        content: pdfData,
        encoding: 'base64',
      }],
    });

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders(origin) });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(origin) });
  }
}