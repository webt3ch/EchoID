import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const AUDD_ENDPOINT = "https://api.audd.io/";

type AudDResult = {
  artist?: string;
  title?: string;
  album?: string;
  release_date?: string;
  timecode?: string;
  song_link?: string;
  apple_music?: {
    url?: string;
    artwork?: { url?: string };
  };
  spotify?: {
    external_urls?: { spotify?: string };
  };
  deezer?: { link?: string };
};

type AudDResponse = {
  status?: "success" | "error";
  result?: AudDResult | null;
  error?: { error_code?: number; error_message?: string };
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

// Provider metadata is external input. Only expose secure web URLs as clickable links.
function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function GET() {
  return json({
    provider: "AudD",
    configured: Boolean(process.env.AUDD_API_TOKEN),
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json(
      { error: "invalid_content_type", message: "Send an audio file as multipart/form-data." },
      415,
    );
  }

  if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return json(
      { error: "audio_too_large", message: "Audio files must be 10 MB or smaller." },
      413,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(
      { error: "invalid_multipart", message: "The uploaded form could not be read." },
      400,
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return json(
      { error: "audio_required", message: "Attach an audio file in the 'audio' field." },
      400,
    );
  }

  if (audio.size === 0) {
    return json(
      { error: "empty_audio", message: "The selected audio file is empty." },
      400,
    );
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return json(
      { error: "audio_too_large", message: "Audio files must be 10 MB or smaller." },
      413,
    );
  }

  if (!audio.type.toLowerCase().startsWith("audio/")) {
    return json(
      { error: "unsupported_audio_type", message: "Upload a supported audio file." },
      415,
    );
  }

  const apiToken = process.env.AUDD_API_TOKEN;
  if (!apiToken) {
    return json(
      {
        error: "recognition_not_configured",
        message:
          "Audio upload is ready, but recognition is not active. Add AUDD_API_TOKEN to the server environment.",
      },
      503,
    );
  }

  const providerForm = new FormData();
  providerForm.append("api_token", apiToken);
  providerForm.append("file", audio, audio.name || "echoid-audio");
  providerForm.append("return", "apple_music,spotify,deezer");
  providerForm.append("market", "it");

  let providerResponse: Response;
  try {
    providerResponse = await fetch(AUDD_ENDPOINT, {
      method: "POST",
      body: providerForm,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return json(
      {
        error: timedOut ? "provider_timeout" : "provider_unavailable",
        message: timedOut
          ? "Music recognition timed out. Try a shorter or clearer recording."
          : "The music recognition service is temporarily unavailable. Try again shortly.",
      },
      timedOut ? 504 : 502,
    );
  }

  if (!providerResponse.ok) {
    return json(
      {
        error: "provider_http_error",
        message: "The music recognition service rejected the request. Check the API token and try again.",
      },
      502,
    );
  }

  let payload: AudDResponse;
  try {
    payload = (await providerResponse.json()) as AudDResponse;
  } catch {
    return json(
      { error: "invalid_provider_response", message: "The recognition service returned an invalid response." },
      502,
    );
  }

  if (payload.status !== "success") {
    return json(
      {
        error: "provider_error",
        message:
          payload.error?.error_code === 900
            ? "The AudD API token is invalid. Check AUDD_API_TOKEN in the server environment."
            : "AudD could not process this recording. Try another audio sample.",
      },
      502,
    );
  }

  const result = payload.result;
  const title = typeof result?.title === "string" ? result.title.trim() : "";
  const artist = typeof result?.artist === "string" ? result.artist.trim() : "";

  if (!result || !title || !artist) {
    return json({
      matched: false,
      message: "No match found. Try a clearer recording with the music louder and less background noise.",
    });
  }

  const artworkTemplate =
    typeof result.apple_music?.artwork?.url === "string"
      ? result.apple_music.artwork.url
      : "";
  const artworkUrl = artworkTemplate
    ? safeHttpsUrl(artworkTemplate.replace("{w}x{h}bb", "600x600bb"))
    : undefined;

  return json({
    matched: true,
    provider: "AudD",
    track: {
      title,
      artist,
      album: typeof result.album === "string" ? result.album : "",
      releaseDate: typeof result.release_date === "string" ? result.release_date : "",
      timecode: typeof result.timecode === "string" ? result.timecode : "",
      songLink: safeHttpsUrl(result.song_link) ?? "",
      artworkUrl,
      appleMusicUrl: safeHttpsUrl(result.apple_music?.url) ?? "",
      spotifyUrl: safeHttpsUrl(result.spotify?.external_urls?.spotify) ?? "",
      deezerUrl: safeHttpsUrl(result.deezer?.link) ?? "",
    },
  });
}
