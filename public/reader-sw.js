self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.mode !== "navigate" ||
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Reading Corner</title><style>body{min-height:90vh;display:grid;place-items:center;background:#faf8ff;color:#2b193e;font:1rem/1.6 system-ui;margin:1rem}main{max-width:28rem}small{color:#6531bc;font-weight:700}button{background:#6531bc;color:white;border:0;padding:.8rem 1.4rem;border-radius:2rem;font:inherit}</style><main><small>READING CORNER</small><h1>You’re offline</h1><p>Reconnect to the internet to open your library and keep reading.</p><button onclick="location.reload()">Try again</button></main></html>`,
          {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
          },
        ),
    ),
  );
});
