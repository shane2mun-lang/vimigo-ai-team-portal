// VIMIGO for AI Team — static server + Airtable form submit endpoint.
// Zero npm dependencies. Set AIRTABLE_TOKEN (Personal Access Token, scope data.records:write
// on base appb9KTroJHxRsGIr) as a Railway environment variable.
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const BASE_ID = process.env.AIRTABLE_BASE || "appb9KTroJHxRsGIr";

// endpoint -> { tableId, submittedAtFieldId }
const FORMS = {
  participant: { table: "tbl33o1aEZa5noyfA", submittedAt: "flduAhQ50pIZnVJ9X", status: { id: "fldsFgRku1rEz1iMU", value: "New" } },
  company:     { table: "tblGJ8TLixBB7xP5j", submittedAt: "fldjetBcnrAKdzL5l" },
  usecases:    { table: "tblNBrI6xXE1Clsyj", submittedAt: "fldHZzXe0K5QNsWwo", status: { id: "fldJFniLuzPLxAQe4", value: "New" } }
};

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2"
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

// Create one Airtable record. Returns a Promise.
function airtableCreate(tableId, fields) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ records: [{ fields }], typecast: true });
    const req = https.request({
      hostname: "api.airtable.com",
      path: `/v0/${BASE_ID}/${tableId}`,
      method: "POST",
      headers: {
        "Authorization": "Bearer " + AIRTABLE_TOKEN,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (r) => {
      let data = "";
      r.on("data", (c) => data += c);
      r.on("end", () => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error("Airtable " + r.statusCode + ": " + data.slice(0, 300)));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  // ---- Form submit API ----
  if (req.method === "POST" && req.url && req.url.startsWith("/api/submit/")) {
    const key = req.url.replace("/api/submit/", "").split("?")[0];
    const cfg = FORMS[key];
    if (!cfg) return sendJson(res, 404, { ok: false, error: "Unknown form" });
    if (!AIRTABLE_TOKEN) return sendJson(res, 500, { ok: false, error: "Server not configured (AIRTABLE_TOKEN missing)" });

    let body = "";
    let tooBig = false;
    req.on("data", (c) => { body += c; if (body.length > 100000) { tooBig = true; req.destroy(); } });
    req.on("end", async () => {
      if (tooBig) return sendJson(res, 413, { ok: false, error: "Payload too large" });
      let parsed;
      try { parsed = JSON.parse(body || "{}"); } catch (e) { return sendJson(res, 400, { ok: false, error: "Bad JSON" }); }
      // Honeypot: silently accept (and drop) bot submissions
      if (parsed.hp) return sendJson(res, 200, { ok: true });
      const fields = (parsed && typeof parsed.fields === "object" && parsed.fields) ? parsed.fields : {};
      // Only allow string values, cap length
      const clean = {};
      for (const k of Object.keys(fields)) {
        let v = fields[k];
        if (v == null) continue;
        v = String(v).slice(0, 5000);
        if (v.trim() !== "") clean[k] = v;
      }
      if (Object.keys(clean).length === 0) return sendJson(res, 400, { ok: false, error: "Empty submission" });
      clean[cfg.submittedAt] = new Date().toISOString();
      if (cfg.status) clean[cfg.status.id] = cfg.status.value;
      try {
        await airtableCreate(cfg.table, clean);
        sendJson(res, 200, { ok: true });
      } catch (err) {
        console.error("submit error:", err.message);
        sendJson(res, 502, { ok: false, error: "Could not save. Please try again." });
      }
    });
    return;
  }

  // ---- Static files ----
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(ROOT, safe);
  fs.readFile(filePath, (err, data) => {
    if (err) {
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
});

server.listen(PORT, "0.0.0.0", () => console.log("VIMIGO portal listening on " + PORT + (AIRTABLE_TOKEN ? " (Airtable submit enabled)" : " (AIRTABLE_TOKEN not set)")));
