import { execSync } from "node:child_process";

export default function setup() {
  try {
    execSync("pnpm stack", { stdio: "pipe" });
  } catch (e) {
    // Vitest cannot print errors thrown from global setup with a Buffer attached, so flatten it.
    const err = e as { stderr?: Buffer; message: string };
    throw new Error(`docker compose up failed: ${err.stderr?.toString() || err.message}`);
  }
}
