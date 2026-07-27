import { env } from "cloudflare:workers";
import { isAdminRequest } from "../../admin-auth";
import { deleteState, readState, writeState } from "../state-store";

const MUSIC_KEY = "music/current";
const MUSIC_STATE_KEY = "love-music";
const MAX_MUSIC_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_BYTES = 800 * 1024;

type StoredMusic = {
  name: string;
  type: string;
  url: string;
  uploadId?: string;
  chunks?: number;
  size?: number;
};

type MediaBinding = {
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
    arrayBuffer?: () => Promise<ArrayBuffer>;
    writeHttpMetadata: (headers: Headers) => void;
  } | null>;
  put: (key: string, value: ArrayBuffer | ReadableStream, options?: unknown) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

function getMedia() {
  return env.MEDIA as unknown as MediaBinding;
}

async function readChunk(media: MediaBinding, key: string) {
  if (media.getWithMetadata) {
    return (await media.getWithMetadata(key, "arrayBuffer")).value;
  }
  const object = await media.get(key);
  return object?.arrayBuffer ? object.arrayBuffer() : null;
}

function audioResponse(bytes: Uint8Array, type: string, request: Request) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
    "content-type": type || "audio/mpeg",
  });
  const rangeHeader = request.headers.get("range");
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

export async function GET(request: Request) {
  const media = getMedia();
  const track = await readState<StoredMusic>(MUSIC_STATE_KEY);

  if (track?.uploadId && track.chunks) {
    const chunkBuffers = await Promise.all(
      Array.from({ length: track.chunks }, (_, index) =>
        readChunk(media, `${MUSIC_KEY}/${track.uploadId}/${index}`),
      ),
    );
    if (chunkBuffers.some((chunk) => !chunk)) {
      return new Response("Music is incomplete", { status: 404 });
    }
    const totalLength = chunkBuffers.reduce((sum, chunk) => sum + (chunk?.byteLength ?? 0), 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunkBuffers) {
      const bytes = new Uint8Array(chunk!);
      combined.set(bytes, offset);
      offset += bytes.byteLength;
    }
    return audioResponse(combined, track.type, request);
  }

  if (media.getWithMetadata) {
    const stored = await media.getWithMetadata(MUSIC_KEY, "arrayBuffer");
    if (!stored.value) return new Response("Music not found", { status: 404 });
    return audioResponse(
      new Uint8Array(stored.value),
      stored.metadata?.contentType || "audio/mpeg",
      request,
    );
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

  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");
  if (uploadId) {
    const part = Number(url.searchParams.get("part"));
    const total = Number(url.searchParams.get("total"));
    const size = Number(url.searchParams.get("size"));
    const name = url.searchParams.get("name") || "Bài nhạc";
    const type = url.searchParams.get("type") || "audio/mpeg";
    if (
      !/^[a-zA-Z0-9-]{8,80}$/.test(uploadId) ||
      !Number.isInteger(part) ||
      !Number.isInteger(total) ||
      part < 0 ||
      total < 1 ||
      part >= total ||
      total > 40 ||
      size < 1 ||
      size > MAX_MUSIC_BYTES
    ) {
      return Response.json({ error: "Thông tin tệp nhạc không hợp lệ" }, { status: 400 });
    }
    const chunk = await request.arrayBuffer();
    if (!chunk.byteLength || chunk.byteLength > MAX_CHUNK_BYTES) {
      return Response.json({ error: "Phần tải lên không hợp lệ" }, { status: 413 });
    }

    const media = getMedia();
    const key = `${MUSIC_KEY}/${uploadId}/${part}`;
    if (media.getWithMetadata) {
      await media.put(key, chunk, { metadata: { contentType: type } });
    } else {
      await media.put(key, chunk, { httpMetadata: { contentType: type } });
    }

    if (part < total - 1) return Response.json({ ok: true, part });

    const uploadedParts = await Promise.all(
      Array.from({ length: total }, (_, index) =>
        readChunk(media, `${MUSIC_KEY}/${uploadId}/${index}`),
      ),
    );
    if (uploadedParts.some((uploadedPart) => !uploadedPart)) {
      return Response.json(
        { error: "Một phần của bài nhạc chưa được lưu. Bạn hãy bấm tải lại." },
        { status: 409 },
      );
    }

    const track: StoredMusic = {
      name,
      type,
      url: `/api/music?v=${Date.now()}`,
      uploadId,
      chunks: total,
      size,
    };
    await writeState(MUSIC_STATE_KEY, track);
    return Response.json({ music: track });
  }

  const form = await request.formData();
  const music = form.get("music");
  const audioExtensions = /\.(mp3|m4a|aac|wav|ogg|oga|webm|flac)$/i;
  if (
    !(music instanceof File) ||
    (!music.type.startsWith("audio/") && !audioExtensions.test(music.name))
  ) {
    return Response.json({ error: "Invalid audio file" }, { status: 400 });
  }
  if (music.size > MAX_MUSIC_BYTES) {
    return Response.json({ error: "Audio file is too large" }, { status: 413 });
  }

  const media = getMedia();
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

  const track = {
    name: music.name,
    type: music.type || "audio/mpeg",
    url: `/api/music?v=${Date.now()}`,
  };
  await writeState(MUSIC_STATE_KEY, track);
  return Response.json({ music: track });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const media = getMedia();
  const track = await readState<StoredMusic>(MUSIC_STATE_KEY);
  if (track?.uploadId && track.chunks) {
    await Promise.all(
      Array.from({ length: track.chunks }, (_, index) =>
        media.delete(`${MUSIC_KEY}/${track.uploadId}/${index}`),
      ),
    );
  }
  await media.delete(MUSIC_KEY);
  await deleteState(MUSIC_STATE_KEY);
  return Response.json({ ok: true });
}
