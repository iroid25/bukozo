const { spawn, execSync } = require("child_process");
const path = require("path");

const rootDir = process.cwd();
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const bridgeScript = path.join(rootDir, "fingerprint-bridge", "server.js");

const processes = new Map();
const restartDelayMs = 5000;
const maxRestarts = 20;
const restartCounts = new Map();

function log(prefix, message) {
  process.stdout.write(`[${prefix}] ${message}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBridgeHealthy() {
  try {
    const response = await fetch("http://127.0.0.1:8001/health", {
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json().catch(() => null);
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

function spawnProcess(name, command, args) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    // Do not use a shell here: Windows paths like `C:\Program Files\...`
    // get split incorrectly when `shell: true` is enabled.
    shell: false,
    env: process.env,
  });

  processes.set(name, child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    processes.delete(name);

    if (signal) {
      log(name, `exited with signal ${signal}\n`);
    } else {
      log(name, `exited with code ${code ?? "unknown"}\n`);
    }

    if (name === "NEXT" && shuttingDown) {
      return;
    }

    if (shuttingDown) {
      return;
    }

    const currentRestarts = (restartCounts.get(name) || 0) + 1;
    restartCounts.set(name, currentRestarts);

    if (currentRestarts > maxRestarts) {
      log(name, `reached max restarts (${maxRestarts}); not restarting again.\n`);
      return;
    }

    log(name, `restarting in ${restartDelayMs}ms...\n`);
    setTimeout(() => {
      if (!shuttingDown) {
        startProcess(name);
      }
    }, restartDelayMs);
  });

  return child;
}

function startProcess(name) {
  if (name === "NEXT") {
    return spawnProcess(name, process.execPath, [nextBin, "start"]);
  }

  if (name === "BRIDGE") {
    return spawnProcess(name, process.execPath, [bridgeScript]);
  }

  throw new Error(`Unknown process: ${name}`);
}

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const [name, child] of processes.entries()) {
    try {
      child.kill();
      log(name, "sent shutdown signal\n");
    } catch (error) {
      log(name, `shutdown error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  setTimeout(() => process.exit(0), 1000).unref?.();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

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
          log("BOOT", `killed stale PID ${pid} on port ${port}\n`);
        } catch (_) {}
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
    }
  } catch (_) {}
}

log("BOOT", "starting Next.js and fingerprint bridge...\n");

(async () => {
  const bridgeReady = await isBridgeHealthy();
  if (bridgeReady) {
    log("BOOT", "bridge already healthy on 127.0.0.1:8001; reusing existing process.\n");
  } else {
    killPort(8001);
    await wait(500);
    startProcess("BRIDGE");
    await wait(800);
  }

  startProcess("NEXT");
})().catch((error) => {
  log("BOOT", `failed to start app: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
