// Runs only for /media/* (see wrangler.jsonc). Static assets ignore Range headers, and Safari will not play
// an MP4 that cannot be fetched by byte range, so this answers ranges from the asset itself. The clips run
// from 55 KB to 1.9 MB, so a range is streamed out of the asset rather than the whole file read into memory first.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const range = request.headers.get("Range");
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!res.ok || !m || (!m[1] && !m[2])) return withRanges(res);
    const known = Number(res.headers.get("Content-Length"));
    const buffered = known > 0 ? undefined : await res.arrayBuffer();
    const size = buffered ? buffered.byteLength : known;
    // "bytes=-N" is the last N bytes; "bytes=N-" runs to the end.
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      if (!buffered) res.body?.cancel();
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const headers = new Headers(res.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Accept-Ranges", "bytes");
    return new Response(buffered ? buffered.slice(start, end + 1) : res.body.pipeThrough(slice(start, end + 1)), { status: 206, headers });
  },
};

/** Passes on bytes [from, to) of a stream. */
function slice(from, to) {
  let at = 0;
  return new TransformStream({
    transform(chunk, out) {
      const a = Math.max(0, from - at), b = Math.min(chunk.byteLength, to - at);
      at += chunk.byteLength;
      if (b > a) out.enqueue(chunk.subarray(a, b));
      if (at >= to) out.terminate();
    },
  });
}

function withRanges(res) {
  const headers = new Headers(res.headers);
  headers.set("Accept-Ranges", "bytes");
  return new Response(res.body, { status: res.status, headers });
}
