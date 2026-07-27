import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../admin-auth";

const MUSIC_KEY = "music/current";
const MAX_MUSIC_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const media = env.MEDIA as unknown as {
    getWithMetadata?: (
      key: string,
      type: "arrayBuffer",
    ) => Promise<{
      value: ArrayBuffer | null;
      metadata: { contentType?: string; originalName?: string } | null;
    }>;
    get: (key: string, options?: unknown) => Promise<{
      body: ReadableStream;
      size: number;
      httpEtag: string;
      range?: { offset: number; length: number };
      httpMetadata?: { contentType?: string };
      writeHttpMetadata: (headers: Headers) => void;
    } | null>;
  };

  if (media.getWithMetadata) {
    const stored = await media.getWithMetadata(MUSIC_KEY, "arrayBuffer");
    if (!stored.value) return new Response("Music not found", { status: 404 });
    const bytes = new Uint8Array(stored.value);
    const rangeHeader = request.headers.get("range");
    const headers = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
      "content-type": stored.metadata?.contentType || "audio/mpeg",
    });
    if (rangeHeader) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
        if (start <= end && start < bytes.length) {
          const part = bytes.slice(start, end + 1);
          headers.set("content-range", `bytes ${start}-${end}/${bytes.length}`);
          headers.set("content-length", String(part.byteLength));
          return new Response(part, { status: 206, headers });
        }
      }
    }
    headers.set("content-length", String(bytes.byteLength));
    return new Response(bytes, { headers });
  }

  const object = await media.get(MUSIC_KEY, { range: request.headers, onlyIf: request.headers });
  if (!object) return new Response("Music not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");
  headers.set("accept-ranges", "bytes");

  if (object.range && "offset" in object.range) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    headers.set("content-length", String(object.range.length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const music = form.get("music");
  if (!(music instanceof File) || !music.type.startsWith("audio/")) {
    return Response.json({ error: "Invalid audio file" }, { status: 400 });
  }
  if (music.size > MAX_MUSIC_BYTES) {
    return Response.json({ error: "Audio file is too large" }, { status: 413 });
  }

  const media = env.MEDIA as unknown as {
    getWithMetadata?: unknown;
    put: (key: string, value: ArrayBuffer | ReadableStream, options?: unknown) => Promise<void>;
  };
  if (media.getWithMetadata) {
    await media.put(MUSIC_KEY, await music.arrayBuffer(), {
      metadata: {
        contentType: music.type || "audio/mpeg",
        originalName: music.name,
      },
    });
  } else {
    await media.put(MUSIC_KEY, music.stream(), {
      httpMetadata: {
        contentType: music.type || "audio/mpeg",
        contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(music.name)}`,
      },
      customMetadata: { originalName: music.name },
    });
  }

  return Response.json({
    music: {
      name: music.name,
      type: music.type || "audio/mpeg",
      url: `/api/music?v=${Date.now()}`,
    },
  });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const media = env.MEDIA as unknown as { delete: (key: string) => Promise<void> };
  await media.delete(MUSIC_KEY);
  return Response.json({ ok: true });
}
