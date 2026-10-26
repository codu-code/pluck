// The next build number for an upload, printed: one more than the highest App Store Connect has for the app.
import { nextBuild } from "./asc.mjs";

console.log(await nextBuild());
