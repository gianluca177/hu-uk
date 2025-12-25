// Cloudflare Pages Function middleware — inject Clicky on every HTML page.
// Place this file at: /functions/_middleware.js (sibling to /site)

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const p = url.pathname;

  // Don't touch Clicky proxy/loader assets or other static files we rely on.
  if (
    p === "/a185616fac3e0.js" ||                // Clicky first-party loader (served via Worker/Pages static)
    p.startsWith("/f2d4c400adb21") ||           // Clicky first-party beacon prefix (your proxy path)
    p === "/scripts/clicky-loader.js"           // our universal loader (below)
  ) {
    return next();
  }

  const resp = await next();
  const ctype = resp.headers.get("content-type") || "";

  // Only rewrite successful HTML responses
  if (resp.status !== 200 || !ctype.includes("text/html")) return resp;

  // Inject <noscript> pixel + our single loader just before </body>
  const INJECT = `
    <noscript><img alt="" width="1" height="1" src="/f2d4c400adb21/101492693ns.gif"></noscript>
    <script defer src="/scripts/clicky-loader.js"></script>
  `;

  const rewriter = new HTMLRewriter().on("body", {
    element(el) {
      el.append(INJECT, { html: true });
    }
  });

  const headers = new Headers(resp.headers);
  headers.set("x-huuk-inject", "clicky");

  return new Response(rewriter.transform(resp).body, {
    status: resp.status,
    headers
  });
}
