/**
 * Wrapper that clears port 8001 if occupied, then starts the fingerprint bridge.
 * Used by pnpm dev and pnpm start so the bridge always gets a clean port.
 */
const { execSync, spawn } = require("child_process");
const path = require("path");

const PORT = 8001;
const bridgePath = path.join(__dirname, "..", "fingerprint-bridge", "server.js");

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr ":${port} "`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        if (!line.toUpperCase().includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          process.stdout.write(`[bridge-launcher] killed stale PID ${pid} on port ${port}\n`);
        } catch (_) {}
      }
    } else {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: "ignore" });
    }
  } catch (_) {}
}

killPort(PORT);

const child = spawn(process.execPath, [bridgePath], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT",  () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
