import { readFile } from "node:fs/promises";
import { parseEnv as parseDotenv } from "node:util";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { devConfig } from "./dev-config";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = new Set<ChildProcess>();
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      /* Already exited. */
    }
  }
  setTimeout(() => {
    for (const child of children) {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
    process.exit(code);
  }, 1500);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

async function available(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is occupied. Stop that service or set the corresponding DEV_*_PORT.`,
        ),
      ),
    );
    server.listen(port, () => server.close(() => resolve()));
  });
}
async function command(args: string[]) {
  const child = spawn("docker", args, {
    cwd: root,
    stdio: "inherit",
    detached: true,
  });
  children.add(child);
  await new Promise<void>((resolve, reject) => {
    child.once("error", () =>
      reject(
        new Error(
          "Docker is required for local dependencies. Install and start Docker, then retry.",
        ),
      ),
    );
    child.once("exit", (code) => {
      children.delete(child);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            "Docker dependencies could not start. Check the Docker output above.",
          ),
        );
      }
    });
  });
}
try {
  const source = parseDotenv(
    await readFile(new URL("../.env.staging", import.meta.url), "utf8"),
  );
  const config = devConfig(source, process.env);
  for (const warning of config.warnings) console.warn(warning);
  console.log("Using .env.staging with local app origins.");
  console.log(
    `Web: http://localhost:${config.ports.web} · Redirect: http://localhost:${config.ports.redirect} · API: http://localhost:${config.ports.api} · Worker: http://localhost:${config.ports.worker}`,
  );
  if (process.argv.includes("--check")) {
    console.log(
      `Configuration valid. Local Docker services: ${config.infrastructure.join(", ") || "none"}.`,
    );
  } else {
    await Promise.all(Object.values(config.ports).map(available));
    const compose = ["compose", "-f", "docker-compose.dev.yml"];
    const services = config.infrastructure.filter(
      (name) => !name.endsWith("-init"),
    );
    if (services.length)
      await command([
        ...compose,
        "up",
        "-d",
        "--wait",
        "--wait-timeout",
        "60",
        ...services,
      ]);
    for (const name of config.infrastructure.filter((name) =>
      name.endsWith("-init"),
    ))
      await command([...compose, "run", "--rm", name]);
    for (const name of ["web", "redirect", "api", "worker"] as const) {
      const args =
        name === "web"
          ? [
              "node_modules/next/dist/bin/next",
              "dev",
              "--port",
              String(config.ports.web),
            ]
          : ["--no-env-file", "--watch", "src/index.ts"];
      const child = spawn(name === "web" ? "node" : process.execPath, args, {
        cwd: `${root}apps/${name}`,
        env: {
          ...process.env,
          ...config.shared,
          PORT: String(config.ports[name]),
        },
        stdio: "inherit",
        detached: true,
      });
      children.add(child);
      child.once("error", () => {
        console.error(`${name} could not start.`);
        stop(1);
      });
      child.once("exit", (code) => {
        children.delete(child);
        if (!stopping) {
          console.error(
            `${name} exited (${code ?? "signal"}); stopping dev services.`,
          );
          stop(code || 1);
        }
      });
    }
    console.log(
      "Ctrl+C stops the app services. Docker data volumes remain available for the next run.",
    );
  }
} catch (error) {
  console.error(
    error instanceof Error && !(error instanceof TypeError)
      ? error.message
      : "Invalid .env.staging configuration. Check its URL values.",
  );
  stop(1);
}
