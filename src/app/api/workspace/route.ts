import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceData } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const includeRawKeys = request.nextUrl.searchParams.get("reveal") === "true";
    const data = await getWorkspaceData({ includeRawKeys });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/workspace failed:", error);
    return NextResponse.json(
      { error: "Failed to load workspace data." },
      { status: 500 }
    );
  }
}
