// Test whether koffi uint32* binding is broken for GetMatchingScore score output
// (same bug as uint64* for the handle — may need Buffer approach instead)
process.env.PATH = "C:\\Program Files\\SecuGen\\SgiBioSrv\\" + ";" + process.env.PATH;

const koffi = require("koffi");
const http  = require("http");

function capture() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ Timeout: 10000, Quality: 50 });
    const req = http.request(
      { host: "localhost", port: 8000, path: "/SGIFPCapture", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d))); }
    );
    req.on("error", reject);
    req.write(body); req.end();
  });
}

console.log("Capturing — place finger...");
capture().then((cap) => {
  if (cap.ErrorCode !== 0) { console.error("Capture error:", cap.ErrorCode); return; }
  console.log(`Captured: ${cap.ImageWidth}x${cap.ImageHeight} Q=${cap.ImageQuality}`);

  const bmpBuf = Buffer.from(cap.BMPBase64, "base64");
  const pixelOffset = bmpBuf.readUInt32LE(10);
  const pixels = bmpBuf.slice(pixelOffset);

  // Init DLL after capture
  const lib = koffi.load("C:\\Program Files\\SecuGen\\SgiBioSrv\\sgfplib.dll");

  // Two variants of GetMatchingScore binding — uint32* vs uint8* (Buffer approach)
  const Create    = lib.func("SGFPM_Create",          "uint32", ["uint8 *"]);
  const Init      = lib.func("SGFPM_Init",            "uint32", ["uint64", "uint32"]);
  const Terminate = lib.func("SGFPM_Terminate",       "uint32", ["uint64"]);
  const CT4       = lib.func("SGFPM_CreateTemplate",  "uint32", ["uint64", "uint8 *", "uint8 *", "uint8 *"]);

  // Two score bindings to compare
  const GetScoreArr = lib.func("SGFPM_GetMatchingScore", "uint32", ["uint64", "uint8 *", "uint8 *", "uint32 *"]);
  const GetScoreBuf = lib.func("SGFPM_GetMatchingScore", "uint32", ["uint64", "uint8 *", "uint8 *", "uint8 *"]);

  const hBuf = Buffer.alloc(8, 0);
  Create(hBuf);
  const handle = hBuf.readBigUInt64LE(0);
  const initErr = Init(handle, 255);
  console.log("Init(255) err:", initErr, "handle:", handle.toString(16));

  const devInfo = Buffer.alloc(24, 0);
  devInfo.writeUInt32LE(18, 0);
  devInfo.writeUInt32LE(cap.ImageWidth, 4);
  devInfo.writeUInt32LE(cap.ImageHeight, 8);
  devInfo.writeUInt32LE(cap.ImageDPI, 12);
  devInfo.writeUInt32LE(cap.ImageQuality, 16);
  devInfo.writeUInt32LE(0, 20);

  const tpl = Buffer.alloc(2048, 0);
  const ctErr = CT4(handle, devInfo, pixels, tpl);
  console.log("CreateTemplate err:", ctErr);

  if (ctErr !== 0) { Terminate(handle); return; }

  console.log("Template first 8 bytes:", tpl.slice(0, 8).toString("hex"));

  // Method A: array [0] binding (what we used before — returned score=0)
  const scoreArr = [0];
  const errA = GetScoreArr(handle, tpl, tpl, scoreArr);
  console.log("\nMethod A (array [0]): err=" + errA + " score=" + scoreArr[0]);

  // Method B: Buffer binding (like the handle fix)
  const scoreBuf = Buffer.alloc(4, 0);
  const errB = GetScoreBuf(handle, tpl, tpl, scoreBuf);
  const scoreB = scoreBuf.readUInt32LE(0);
  console.log("Method B (Buffer):    err=" + errB + " score=" + scoreB);

  // Also try reading the buffer as big-endian
  const scoreBE = scoreBuf.readUInt32BE(0);
  console.log("Method B (Buffer BE): score=" + scoreBE);

  // Raw bytes of score buffer
  console.log("Score buffer bytes:", scoreBuf.toString("hex"));

  Terminate(handle);
}).catch(e => console.error("Error:", e.message));
