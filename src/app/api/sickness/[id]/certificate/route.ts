import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { attachCertificate, readCertificate, SicknessError } from "@/server/services/sickness";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpeg",
  "image/jpg": ".jpg",
};

const MAGIC_BYTES: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" }, // %PDF
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" }, // PNG
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" }, // JPEG
];

function detectMime(buffer: Buffer): string | null {
  for (const sig of MAGIC_BYTES) {
    if (buffer.length >= sig.bytes.length && sig.bytes.every((b, i) => buffer[i] === b)) {
      return sig.mime;
    }
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const detectedMime = detectMime(buffer);
    if (!detectedMime) {
      return NextResponse.json(
        { error: "Invalid file type — only PDF, PNG, JPEG allowed" },
        { status: 415 }
      );
    }

    const declaredExt = ALLOWED_MIME[detectedMime];
    if (!declaredExt) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }

    const safeFilename = `certificate${declaredExt}`;
    const note = await attachCertificate({
      actor: user,
      noteId: id,
      filename: safeFilename,
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        "Content-Disposition": `attachment; filename="${result.filename}"`,
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
