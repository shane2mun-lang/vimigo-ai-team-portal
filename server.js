// Minimal zero-dependency static server for Railway / any Node host.
// Serves index.html and any sibling assets, binds to process.env.PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  // prevent directory traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(ROOT, safe);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA-style fallback to index.html
      fs.readFile(path.join(ROOT, "index.html"), (e2, idx) => {
        if (e2) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": TYPES[".html"] });
        res.end(idx);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => console.log("VIMIGO portal listening on " + PORT));
