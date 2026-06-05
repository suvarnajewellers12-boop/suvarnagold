import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔹 CORS helper (fully open)
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function GET() {
  try {
    // 🔓 REMOVED AUTHENTICATION - This route is now fully public

    // Fetch products
    const products = await prisma.productImgs.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Safely handle missing images or different data types
    const formatted = products.map((p) => {
      let safeImageString = "";
      
      if (p.image) {
        // Check if the database stored it as a String or a Buffer/Bytes
        const base64Data = typeof p.image === 'string' 
            ? p.image 
            : Buffer.from(p.image).toString("base64");
            
        // Prevent double-prefixing if it already has data:image/jpeg;base64,
        safeImageString = base64Data.startsWith("data:image") 
            ? base64Data 
            : `data:image/jpeg;base64,${base64Data}`;
      }

      return {
        id: p.id,
        title: p.title || "Unknown Product",
        description: p.description || "",
        weight: p.weight || 0,
        image: safeImageString, // Will safely be an empty string if image is missing
        metalType: p.metalType || "gold",
        carats: p.carats || "22k",
      };
    });

    return new NextResponse(JSON.stringify(formatted), {
      status: 200,
      headers: corsHeaders(),
    });

  } catch (error) {
    console.error("🔥 CRITICAL Fetch error:", error);

    return new NextResponse(
      JSON.stringify({ 
        error: "Failed to fetch", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: corsHeaders() }
    );
  }
}