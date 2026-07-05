import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { attachCertificate, readCertificate, SicknessError } from "@/server/services/sickness";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const note = await attachCertificate({
      actor: user,
      noteId: id,
      filename: file.name,
      buffer,
    });
    return NextResponse.json({ note });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof SicknessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await readCertificate({ actor: user, noteId: id });
    if (!result) {
      return NextResponse.json({ error: "No certificate" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `inline; filename="${result.filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof SicknessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
