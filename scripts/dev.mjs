import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const env = { ...process.env };

if (process.platform === "win32") {
  const engines = resolve("node_modules/@prisma/engines");
  const queryEngine = resolve(engines, "query_engine-windows.dll.node");
  const schemaEngine = resolve(engines, "schema-engine-windows.exe");
  if (existsSync(queryEngine)) env.PRISMA_QUERY_ENGINE_LIBRARY ??= queryEngine;
  if (existsSync(schemaEngine)) env.PRISMA_SCHEMA_ENGINE_BINARY ??= schemaEngine;
}

const generated = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "generate"], {
  env,
  stdio: "inherit",
  windowsHide: true
});

if (generated.error) throw generated.error;
if (generated.status !== 0) process.exit(generated.status ?? 1);

const next = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev"], {
  env,
  stdio: "inherit",
  windowsHide: true
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}

next.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
next.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
