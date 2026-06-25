import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import * as xlsx from "xlsx";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= BULK CREATE CUSTOMERS + ASSIGN SCHEMES =================
export async function POST(req: Request) {
  try {
    // 🔐 AUTHORIZATION
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid Token" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔹 READ MULTIPART FORM DATA
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new NextResponse(
        JSON.stringify({ error: "No Excel file provided" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔹 PARSE EXCEL FILE
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array
    const rows: any[] = xlsx.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: "The uploaded Excel sheet is empty" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔹 PROCESS ROWS
    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // +2 because index is 0-based and Excel has a header row

      try {
        const name = row.name?.toString();
        const username = row.username?.toString();
        const password = row.password?.toString();
        const phone = row.phone?.toString();
        
        // Handle schemeIds from Excel (assumes comma-separated values like "schemeId1, schemeId2")
        let schemeIds: string[] = [];
        if (row.schemeIds) {
          schemeIds = String(row.schemeIds)
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
        }

        // Validate required fields
        if (!name || !username || !password || !phone) {
          throw new Error("Missing required fields (name, username, password, phone)");
        }

        // 🔐 Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 🔹 Create Customer
        const customer = await prisma.customer.create({
          data: {
            name,
            username,
            password: hashedPassword,
            phone,
          },
        });

        // 🔹 Assign Schemes (if provided)
        if (schemeIds.length > 0) {
          for (const schemeId of schemeIds) {
            // Note: If your scheme ID in Prisma is an Int, wrap schemeId in parseInt or Number() here
            const scheme = await prisma.scheme.findUnique({
              where: { id: schemeId }, 
            });

            if (!scheme) continue;

            const totalAmount = scheme.monthlyAmount * scheme.durationMonths;

            await prisma.customerScheme.create({
              data: {
                customerId: customer.id,
                schemeId: scheme.id,
                remainingAmount: totalAmount,
                installmentsLeft: scheme.durationMonths,
              },
            });
          }
        }

        successCount++;
      } catch (err: any) {
        failedCount++;
        
        // Handle Prisma duplicate key error
        if (err.code === "P2002") {
          errors.push({ row: rowNumber, error: `Username '${row.username}' already exists` });
        } else {
          errors.push({ row: rowNumber, error: err.message || "Unknown error occurred" });
        }
      }
    }

    // 🔹 RETURN SUMMARY
    return new NextResponse(
      JSON.stringify({
        message: "Bulk upload processing completed",
        summary: {
          totalRows: rows.length,
          successful: successCount,
          failed: failedCount,
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}