import { execSync } from "node:child_process";

export default function setup() {
  execSync("docker compose -f docker-compose.dev.yml up -d --wait", { stdio: "ignore" });
}
