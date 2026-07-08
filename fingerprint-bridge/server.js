/**
 * SecuGen Native DLL Bridge
 *
 * POST /template  { bmpBase64 }
 *                 → { errorCode, template, size }
 *                   template = base64 SG400 native (always 400 bytes)
 *
 * POST /match     { template1, template2 }   (base64, must be 400 bytes each)
 *                 → { errorCode, score, matched }
 *
 * GET  /health    → { ok, dllError }
 *
 * Confirmed koffi quirks for this DLL:
 *  - SGFPM_Create handle:       uint8* + readBigUInt64LE(0)  (uint64* broken)
 *  - SGFPM_GetMatchingScore score: uint8* + readUInt32LE(0)  (uint32* broken)
 *  - Init(255) works without physical device for CreateTemplate + GetMatchingScore
 *  - SG400 template is always exactly 400 bytes
 *  - devInfo = null works (let SDK use defaults from Init)
 */

process.env.PATH =
  "C:\\Program Files\\SecuGen\\SgiBioSrv\\" + ";" + process.env.PATH;

const http  = require("http");
const koffi = require("koffi");

const DLL_PATH        = "C:\\Program Files\\SecuGen\\SgiBioSrv\\sgfplib.dll";
const PORT            = 8001;
const MATCH_THRESHOLD = 40;
const DEVICE_NO_HW    = 255;
const SG400_SIZE      = 400;

let Create, Init, GetMaxTemplateSize, CreateTemplate, GetMatchingScore, Terminate;
let dllLoaded = false;
let dllError  = null;

function loadDLL() {
  try {
    const lib = koffi.load(DLL_PATH);
    Create           = lib.func("SGFPM_Create",              "uint32", ["uint8 *"]);
    Init             = lib.func("SGFPM_Init",                "uint32", ["uint64", "uint32"]);
    GetMaxTemplateSize = lib.func("SGFPM_GetMaxTemplateSize","uint32", ["uint64", "uint8 *"]);
    CreateTemplate   = lib.func("SGFPM_CreateTemplate",      "uint32", ["uint64", "uint8 *", "uint8 *", "uint8 *"]);
    GetMatchingScore = lib.func("SGFPM_GetMatchingScore",    "uint32", ["uint64", "uint8 *", "uint8 *", "uint8 *"]);
    Terminate        = lib.func("SGFPM_Terminate",           "uint32", ["uint64"]);
    dllLoaded = true;
    console.log("[bridge] DLL loaded OK");
  } catch (err) {
    dllError = err;
    console.error("[bridge] DLL load FAILED:", err.message);
  }
}

function withHandle(fn) {
  const hBuf = Buffer.alloc(8, 0);
  const cErr = Create(hBuf);
  if (cErr !== 0) throw Object.assign(new Error("SGFPM_Create failed"), { code: cErr });
  const handle = hBuf.readBigUInt64LE(0);
  if (handle === BigInt(0)) throw new Error("SGFPM_Create returned null handle");
  const iErr = Init(handle, DEVICE_NO_HW);
  if (iErr !== 0) {
    try { Terminate(handle); } catch (_) {}
    throw Object.assign(new Error("SGFPM_Init failed"), { code: iErr });
  }
  try {
    return fn(handle);
  } finally {
    try { Terminate(handle); } catch (_) {}
  }
}

// ── Operations ────────────────────────────────────────────────────────────────

function createNativeTemplate(bmpBase64) {
  if (!dllLoaded) return { errorCode: -1, template: null, error: dllError?.message };

  try {
    return withHandle((handle) => {
      // Get the max template size from the SDK
      const maxSizeBuf = Buffer.alloc(4, 0);
      GetMaxTemplateSize(handle, maxSizeBuf);
      const maxSize = maxSizeBuf.readUInt32LE(0) || SG400_SIZE;
      console.log("[bridge] maxTemplateSize=%d", maxSize);

      // Extract raw pixel bytes from BMP (offset stored at bytes 10–13)
      const bmpBuf     = Buffer.from(bmpBase64, "base64");
      const pixelOffset = bmpBuf.readUInt32LE(10);
      const pixelBytes  = bmpBuf.slice(pixelOffset);
      console.log("[bridge] bmp=%db pixelOffset=%d pixels=%db",
        bmpBuf.length, pixelOffset, pixelBytes.length);

      const templateBuf = Buffer.alloc(maxSize, 0);
      // Pass null for devInfo — SDK uses device defaults from Init
      const err = CreateTemplate(handle, null, pixelBytes, templateBuf);
      if (err !== 0) {
        console.error("[bridge] CreateTemplate error:", err);
        return { errorCode: err, template: null };
      }

      // SG400 is always exactly 400 bytes
      const native = templateBuf.slice(0, SG400_SIZE);
      const template = native.toString("base64");
      console.log("[bridge] template created size=%d", SG400_SIZE);
      return { errorCode: 0, template, size: SG400_SIZE };
    });
  } catch (e) {
    console.error("[bridge] createNativeTemplate:", e.message);
    return { errorCode: e.code ?? -1, template: null, error: e.message };
  }
}

function matchTemplates(b64_1, b64_2) {
  if (!dllLoaded) return { errorCode: -1, score: 0, matched: false, error: dllError?.message };

  const buf1 = Buffer.from(b64_1, "base64");
  const buf2 = Buffer.from(b64_2, "base64");

  if (buf1.length !== SG400_SIZE || buf2.length !== SG400_SIZE) {
    const msg = `Templates must be ${SG400_SIZE} bytes. Got t1=${buf1.length} t2=${buf2.length}`;
    console.error("[bridge]", msg);
    return { errorCode: 103, score: 0, matched: false, error: msg };
  }

  console.log("[bridge] match t1=%db t2=%db", buf1.length, buf2.length);

  try {
    return withHandle((handle) => {
      const scoreBuf = Buffer.alloc(4, 0);
      const err = GetMatchingScore(handle, buf1, buf2, scoreBuf);
      if (err !== 0) {
        console.error("[bridge] GetMatchingScore error:", err);
        return { errorCode: err, score: 0, matched: false };
      }
      const score   = scoreBuf.readUInt32LE(0);
      const matched = score >= MATCH_THRESHOLD;
      console.log("[bridge] score=%d matched=%s", score, matched);
      return { errorCode: 0, score, matched };
    });
  } catch (e) {
    console.error("[bridge] matchTemplates:", e.message);
    return { errorCode: e.code ?? -1, score: 0, matched: false, error: e.message };
  }
}

// ── Capture via SgiBioSrv ─────────────────────────────────────────────────────

async function captureFromSgiBioSrv() {
  const url = "http://localhost:8000/SGIFPCapture";
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ Timeout: 10000, Quality: 50 });
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("SGIFPCapture returned invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("SGIFPCapture timed out")); });
    req.write(body);
    req.end();
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data",  (c) => { body += c; });
    req.on("end",   () => { if (!body.trim()) { resolve({}); return; } try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

loadDLL();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const server = http.createServer(async (req, res) => {
  // CORS — allow browser calls from any origin (app may be hosted remotely)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: dllLoaded, dllError: dllError?.message ?? null }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = await readBody(req);

    if (req.url === "/capture") {
      // Full capture: call SgiBioSrv internally then create native template.
      // Browser calls this endpoint so it never needs to reach SgiBioSrv directly.
      let cap;
      try {
        cap = await captureFromSgiBioSrv();
      } catch (e) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: "Cannot reach SgiBioSrv at localhost:8000. Make sure it is running.", detail: e.message }));
        return;
      }

      if (cap.ErrorCode !== 0) {
        res.writeHead(200);
        res.end(JSON.stringify(cap));
        return;
      }

      console.log("[bridge] capture Q=%d NFIQ=%d", cap.ImageQuality, cap.NFIQ);

      let nativeTemplate = null;
      let bridgeError = null;
      const tmplResult = createNativeTemplate(cap.BMPBase64);
      if (tmplResult.errorCode === 0 && tmplResult.template && tmplResult.size === 400) {
        nativeTemplate = tmplResult.template;
        console.log("[bridge] /capture native template OK");
      } else {
        bridgeError = tmplResult.error || `errorCode=${tmplResult.errorCode} size=${tmplResult.size}`;
        console.warn("[bridge] /capture native template failed:", bridgeError);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ ...cap, NativeTemplateBase64: nativeTemplate, bridgeError }));
      return;
    }

    if (req.url === "/template") {
      const { bmpBase64 } = body;
      if (!bmpBase64) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "bmpBase64 required" }));
        return;
      }
      const result = createNativeTemplate(bmpBase64);
      res.writeHead(result.errorCode === 0 ? 200 : 500);
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === "/match") {
      const { template1, template2 } = body;
      if (!template1 || !template2) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "template1 and template2 required" }));
        return;
      }
      const result = matchTemplates(template1, template2);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "POST /template or POST /match only" }));
  } catch (e) {
    console.error("[bridge] handler error:", e.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

function probeExistingBridge() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: "/health",
        timeout: 1000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(Boolean(parsed?.ok));
          } catch {
            resolve(false);
          }
        });
      },
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

server.on("error", async (err) => {
  if (err && err.code === "EADDRINUSE") {
    const healthy = await probeExistingBridge();
    if (healthy) {
      console.log("[bridge] already running on 127.0.0.1:%d; reusing existing bridge", PORT);
      process.exit(0);
      return;
    }
    console.error("[bridge] port %d is in use by a stale process. Run: pnpm run bridge (it will clear the port)", PORT);
  } else {
    console.error("[bridge] server error:", err.message);
  }
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[bridge] http://127.0.0.1:%d — DLL: %s", PORT, dllLoaded ? "OK" : "FAILED");
});
