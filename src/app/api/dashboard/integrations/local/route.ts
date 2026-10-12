import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import {
  previewLocalDataset,
  saveLocalDataset,
} from "@/lib/integrations/local/datasets";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await requireAdministrationPermission(
    session?.user?.email,
    "integrations.manage",
  );
  if (!access)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 600 * 1024)
    return NextResponse.json(
      { message: "Import exceeds 512 KB." },
      { status: 413 },
    );
  try {
    const body = JSON.parse(raw);
    if (body.action === "preview")
      return NextResponse.json(previewLocalDataset(access.user.id, body));
    if (body.action !== "save")
      return NextResponse.json(
        { message: "Choose preview or save." },
        { status: 400 },
      );
    return NextResponse.json(await saveLocalDataset(access.user.id, body), {
      status: 201,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Import failed." },
      { status: 400 },
    );
  }
}
