import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "@/lib/auth";
import { createDecompressor } from "zlib";
import { promisify } from "util";

// ✅ CORS HEADERS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // or http://localhost:8080
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// 🔤 GENERATE RANDOM ITEM CODE (J + 5 random digits)
function generateRandomItemCode(): string {
  const randomDigits = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `J${randomDigits}`;
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

    let buffer = Buffer.from(await file.arrayBuffer());

    // Handle gzip compression if file is .gz
    if (file.name.endsWith(".gz")) {
      const zlib = await import("zlib");
      const gunzip = promisify(zlib.gunzip);
      try {
        buffer = await gunzip(buffer);
      } catch (err) {
        return new NextResponse(JSON.stringify({ error: "Failed to decompress file" }), {
          status: 400,
          headers: corsHeaders(),
        });
      }
    }

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    let data: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!data.length) {
      return new NextResponse(JSON.stringify({ error: "Empty Excel file" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // Normalize column names (handle case variations)
    data = data.map((row: any) => ({
      name: row.name,
      metalType: row.metalType,
      grams: row.grams,
      carats: row.carats,
      manufactureDate: row.manufactureDate,
      itemCode: row.itemCode,
      stoneWeight: row.stoneWeight,
      grossWeight: row.GrossWeight || row.grossWeight,
      netWeight: row.Netwet || row.NetWeight || row.netWeight,
      category: row.category,
      bodyPart: row.bodyPart,
      branchName: row.branchName,
      stoneCost: row.stoneCost,
      va: row.va,
    }));

    // ✅ VALIDATE REQUIRED FIELDS
    const errors: string[] = [];
    data.forEach((row: any, index: number) => {
      if (!row.name || row.name === "") errors.push(`Row ${index + 2}: name is required`);
      if (!row.metalType || row.metalType === "") errors.push(`Row ${index + 2}: metalType is required`);
      if (!row.carats || row.carats === "") errors.push(`Row ${index + 2}: carats is required`);
      if (!row.manufactureDate || row.manufactureDate === "") errors.push(`Row ${index + 2}: manufactureDate is required`);
    });

    if (errors.length > 0) {
      return new NextResponse(
        JSON.stringify({
          error: "Validation failed",
          details: errors.slice(0, 10),
          total_errors: errors.length
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔢 SKU START
    const year = new Date().getFullYear().toString().slice(-2);

    const lastProduct = await prisma.product.findFirst({
      where: { sku: { startsWith: `SV${year}` } },
      orderBy: { sku: "desc" },
    });

    let skuStartNumber = 1;

    if (lastProduct?.sku) {
      const lastSequence = parseInt(lastProduct.sku.substring(4));
      if (!isNaN(lastSequence)) skuStartNumber = lastSequence + 1;
    }

    // 🔤 AUTO-GENERATE ITEM CODES FOR NULL VALUES
    const generatedItemCodes = new Set<string>();
    const itemCodesFromExcel = new Set<string>();

    data.forEach((row: any) => {
      if (!row.itemCode || row.itemCode === "") {
        // Generate random item code: J + 5 digits
        let generatedCode = generateRandomItemCode();
        // Ensure no duplicates within this batch
        while (generatedItemCodes.has(generatedCode) || itemCodesFromExcel.has(generatedCode)) {
          generatedCode = generateRandomItemCode();
        }
        generatedItemCodes.add(generatedCode);
        row.itemCode = generatedCode;
      } else {
        itemCodesFromExcel.add(row.itemCode);
      }
    });

    // ✅ VALIDATE FOR DUPLICATE ITEM CODES IN DATABASE
    const allItemCodesToCheck = Array.from(new Set([
      ...Array.from(generatedItemCodes),
      ...Array.from(itemCodesFromExcel)
    ]));

    const existingCodes = await prisma.product.findMany({
      where: { itemCode: { in: allItemCodesToCheck } },
      select: { itemCode: true },
    });

    const existingCodeSet = new Set(existingCodes.map(p => p.itemCode));
    const duplicateCodesInDb = allItemCodesToCheck.filter(code => existingCodeSet.has(code));

    if (duplicateCodesInDb.length > 0) {
      return new NextResponse(
        JSON.stringify({
          error: "Duplicate item codes found",
          details: [`Item codes already exist in database: ${duplicateCodesInDb.join(", ")}`],
          total_errors: duplicateCodesInDb.length
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🚀 BULK CREATE
    const productsToInsert = data.map((row, index) => {
      const sequence = String(skuStartNumber + index).padStart(5, "0");

      return {
        sku: `SV${year}${sequence}`,
        name: row.name?.trim() || "Unknown",
        metalType: row.metalType?.trim() || "Gold",
        grams: parseFloat(row.grams) || 0,
        carats: row.carats?.trim() || "24K",
        manufactureDate: row.manufactureDate instanceof Date
          ? row.manufactureDate
          : new Date(row.manufactureDate),
        uniqueCode: uuidv4(),
        isSold: false,
        itemCode: row.itemCode, // Auto-generated or from Excel
        stoneWeight: parseFloat(row.stoneWeight) || 0,
        grossWeight: parseFloat(row.grossWeight) || 0,
        netWeight: parseFloat(row.netWeight) || 0,
        category: row.category?.trim() || "Other",
        bodyPart: row.bodyPart?.trim() || "Other",
        branchName: row.branchName?.trim() || "Main",
        stoneCost: parseFloat(row.stoneCost) || 0,
        va: parseFloat(row.va) || 2.5,
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