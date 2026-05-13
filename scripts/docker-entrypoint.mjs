import net from "node:net";
import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL ist nicht gesetzt.");
  process.exit(1);
}

const parsed = new URL(databaseUrl);
await waitForTcp(parsed.hostname, Number(parsed.port || "5432"), 60_000);
await run("node", ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
await run("node", ["server.js"], { inherit: true });

function waitForTcp(host, port, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2_000);
      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.on("timeout", () => socket.destroy());
      socket.on("error", () => socket.destroy());
      socket.on("close", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`PostgreSQL ist nach ${timeoutMs / 1000}s nicht erreichbar: ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1_000);
      });
    };
    attempt();
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.inherit ? "inherit" : ["ignore", "inherit", "inherit"],
      env: process.env
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} wurde mit Code ${code} beendet.`));
    });
  });
}
