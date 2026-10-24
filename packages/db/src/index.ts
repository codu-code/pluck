// The public interface of packages/db. Raw client and Db handles stay internal so every caller goes through userId-scoped functions.
export { ping } from "./client.ts";
export { authAdapter } from "./auth.ts";
