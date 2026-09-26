import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = process.env.PORT || "3000";
const origin = `http://127.0.0.1:${port}`;
const configPath = join(tmpdir(), "cloudflared-quick.yml");

writeFileSync(configPath, `ingress:\n  - service: ${origin}\n`, "utf8");

const tunnel = spawn(
  "cloudflared",
  ["tunnel", "--config", configPath, "--url", origin, "--protocol", "http2", "--edge-ip-version", "4"],
  { stdio: "inherit" },
);

tunnel.on("error", (error) => {
  console.error("Không chạy được cloudflared. Hãy cài Cloudflare Tunnel rồi thử lại.");
  console.error(error.message);
  process.exit(1);
});

tunnel.on("exit", (code) => process.exit(code ?? 0));
