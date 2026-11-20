// Runs only for /media/* (see wrangler.jsonc). Static assets ignore Range headers, and Safari will not play
// an MP4 that cannot be fetched by byte range, so this answers ranges from the asset itself. Clips are under 300 KB.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const range = request.headers.get("Range");
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!res.ok || !m || (!m[1] && !m[2])) return withRanges(res);
    const body = await res.arrayBuffer();
    const size = body.byteLength;
    // "bytes=-N" is the last N bytes; "bytes=N-" runs to the end.
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const headers = new Headers(res.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Accept-Ranges", "bytes");
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};

function withRanges(res) {
  const headers = new Headers(res.headers);
  headers.set("Accept-Ranges", "bytes");
  return new Response(res.body, { status: res.status, headers });
}
