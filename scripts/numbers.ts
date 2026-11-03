// How Pluck is doing across every account: sign-ups and where they came from, Items by surface, AI tools.
// Usage: MONGODB_URI=… pnpm numbers   (read-only; counts, never anyone's data)
import { numbers } from "../packages/db/src/numbers.ts";

console.log(JSON.stringify(await numbers(), null, 2));
process.exit(0); // the driver's pool would keep the process open
