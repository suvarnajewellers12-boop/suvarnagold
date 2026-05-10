import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "@/lib/auth";

// ✅ CORS HEADERS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // or http://localhost:8080
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ✅ HANDLE PREFLIGHT
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {
    // 🔐 AUTH CHECK
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    // 📂 READ FILE
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new NextResponse(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!data.length) {
      return new NextResponse(JSON.stringify({ error: "Empty Excel file" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // 🔢 SKU START
    const year = new Date().getFullYear().toString().slice(-2);

    const lastProduct = await prisma.product.findFirst({
      where: { sku: { startsWith: `SV${year}` } },
      orderBy: { sku: "desc" },
    });

    let startNumber = 1;

    if (lastProduct?.sku) {
      const lastSequence = parseInt(lastProduct.sku.substring(4));
      if (!isNaN(lastSequence)) startNumber = lastSequence + 1;
    }

    // 🚀 BULK CREATE
    const productsToInsert = data.map((row, index) => {
      const sequence = String(startNumber + index).padStart(5, "0");

      return {
        sku: `SV${year}${sequence}`,
        name: row.name,
        metalType: row.metalType,
        grams: parseFloat(row.grams) || 0,
        carats: row.carats || null,
        manufactureDate: new Date(row.manufactureDate),
        uniqueCode: uuidv4(),
        isSold: false,
        huid: row.huid || null,
        stoneWeight: parseFloat(row.stoneWeight) || 0,
        netWeight: parseFloat(row.netWeight) || 0,
        category: row.category || "Other",
        bodyPart: row.bodyPart || "Other",
        branchName: row.branchName || "Main",
        stoneCost: parseFloat(row.stoneCost) || 0,
        va: parseFloat(row.va) || 0,
      };
    });

    await prisma.product.createMany({
      data: productsToInsert,
      skipDuplicates: true,
    });

    return new NextResponse(
      JSON.stringify({ message: `${productsToInsert.length} products uploaded successfully` }),
      {
        status: 201,
        headers: corsHeaders(),
      }
    );

  } catch (error) {
    console.error(error);

    return new NextResponse(JSON.stringify({ error: "Upload failed" }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}