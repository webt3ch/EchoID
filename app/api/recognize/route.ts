import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const AUDIO_MIME_PREFIX = "audio/";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "invalid_content_type", message: "Send an audio file as multipart/form-data." },
      { status: 415 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_multipart", message: "The uploaded form could not be read." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: "audio_required", message: "Attach an audio file in the 'audio' field." },
      { status: 400 },
    );
  }

  if (audio.size === 0) {
    return NextResponse.json(
      { error: "empty_audio", message: "The selected audio file is empty." },
      { status: 400 },
    );
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "audio_too_large", message: "Audio files must be 20 MB or smaller." },
      { status: 413 },
    );
  }

  if (!audio.type.startsWith(AUDIO_MIME_PREFIX)) {
    return NextResponse.json(
      { error: "unsupported_audio_type", message: "Upload a supported audio file." },
      { status: 415 },
    );
  }

  // Provider integration belongs here. Keep provider credentials server-side and
  // never forward uploaded audio to an external service until one is configured.
  return NextResponse.json(
    {
      error: "recognition_not_configured",
      message: "Audio upload validation is ready, but no recognition provider is connected yet.",
    },
    { status: 503 },
  );
}
