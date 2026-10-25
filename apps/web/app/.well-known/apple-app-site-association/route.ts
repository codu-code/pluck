// Universal links: these paths open the iPhone app when it is installed, and stay web pages when it is not.
// Needs the Apple team that signs the app (APPLE_TEAM_ID); without it there is no file, so links stay on the web.
const PATHS = ["/shared/*", "/lists/*", "/items/*"];

export const dynamic = "force-dynamic";

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return new Response("Not found", { status: 404 });
  return Response.json({ applinks: { details: [{ appIDs: [`${team}.io.getpluck.app`], components: PATHS.map((p) => ({ "/": p })) }] } });
}
