// Fetch stored template via Prisma and self-match via bridge
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const MEMBER_ID = "cmp86717w005ov3x848eujcii";
const BRIDGE = "http://127.0.0.1:8001/match";

// Write a temp prisma query script in the project root
const queryScript = path.join(__dirname, "../_tmp_fingerprint_query.mjs");
fs.writeFileSync(queryScript, `
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const m = await db.member.findUnique({
  where: { id: "${MEMBER_ID}" },
  select: { fingerprintTemplate: true, fingerprintQuality: true, memberNumber: true }
});
await db.$disconnect();
if (!m?.fingerprintTemplate) { console.error("no template"); process.exit(1); }
console.log(JSON.stringify(m));
`);

let member;
try {
  const out = execSync(`node --input-type=module < "${queryScript}"`, {
    encoding: "utf8",
    cwd: path.join(__dirname, ".."),
  });
  member = JSON.parse(out.trim());
} catch (e) {
  console.error("Query failed:", e.message);
  process.exit(1);
} finally {
  try { fs.unlinkSync(queryScript); } catch (_) {}
}

const { fingerprintTemplate: template, fingerprintQuality, memberNumber } = member;
console.log(`Member: ${memberNumber}`);
console.log(`Template: ${template.length} chars, quality: ${fingerprintQuality}`);
console.log(`Decoded: ${Buffer.from(template, "base64").length} bytes`);
console.log(`Preview: ${template.slice(0, 20)}...`);

// Self-match
const payload = JSON.stringify({ template1: template, template2: template });
const result = execSync(
  `curl -s -X POST ${BRIDGE} -H "Content-Type: application/json" --data-binary @-`,
  { input: payload, encoding: "utf8" }
);
console.log("\nSelf-match:", result.trim());
