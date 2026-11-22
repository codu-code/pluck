// What the browser can see that the server cannot: the page as rendered (logins, SPAs), the selection,
// and a video's captions from the player data in your session.
export type Captured = { title: string; html?: string; selection: string; transcript?: string };

export async function capture(tabId: number, { content, transcripts }: { content: boolean; transcripts: boolean }): Promise<Captured | null> {
  try {
    const [page] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => ({ title: document.title, html: document.documentElement.outerHTML, selection: getSelection()?.toString() ?? "" }),
    });
    const got = page?.result as { title: string; html: string; selection: string } | undefined;
    if (!got) return null;
    const transcript = transcripts ? await readTranscript(tabId) : undefined;
    return {
      title: got.title,
      selection: got.selection.trim(),
      ...(content ? { html: got.html } : {}), // lib/pluck.ts leaves it out when the request would be too big
      ...(transcript ? { transcript } : {}),
    };
  } catch {
    return null; // a page we may not script (the web store, browser pages): pluck the URL alone
  }
}

async function readTranscript(tabId: number): Promise<string | undefined> {
  const [res] = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      type Track = { baseUrl: string; languageCode?: string };
      const player = (window as unknown as { ytInitialPlayerResponse?: { videoDetails?: { videoId?: string }; captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Track[] } } } }).ytInitialPlayerResponse;
      // After in-page navigation the player data can belong to the previous video.
      const v = new URLSearchParams(location.search).get("v");
      if (!player || (v && player.videoDetails?.videoId && player.videoDetails.videoId !== v)) return null;
      const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      const track = tracks.find((t) => t.languageCode?.startsWith(document.documentElement.lang.slice(0, 2) || "en")) ?? tracks[0];
      if (!track) return null;
      try {
        const data = (await (await fetch(new URL(`${track.baseUrl}&fmt=json3`, location.href))).json()) as { events?: { segs?: { utf8: string }[] }[] };
        return (data.events ?? []).flatMap((e) => (e.segs ?? []).map((s) => s.utf8)).join("").replace(/\s+/g, " ").trim() || null;
      } catch {
        return null;
      }
    },
  });
  return (res?.result as string | null | undefined) ?? undefined;
}

// A screenshot for pages with no image of their own, as a JPEG small enough to upload.
export async function screenshot(windowId: number): Promise<Blob | null> {
  try {
    const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 60 });
    return await (await fetch(dataUrl)).blob();
  } catch {
    return null;
  }
}

// The picture from the tab, for an image the server cannot fetch (it sits behind your sign-in). First its own bytes,
// fetched by the page with your session, which works where the image's server lets its page fetch it. Else what the
// tab shows: where the image is on screen, a capture of the tab, and the one cut to the other. Null when neither
// can be had: the image is out of view or in a frame, or the page may not be read.
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"]; // what PUT /items/:id/cover takes, up to 2 MB
export async function pictureInTab(tabId: number, windowId: number, src: string): Promise<Blob | null> {
  try {
    const [found] = await browser.scripting.executeScript({
      target: { tabId },
      args: [src, COVER_TYPES],
      func: async (src: string, types: string[]) => {
        try {
          const res = await fetch(src, { credentials: "include" });
          const bytes = res.ok ? await res.blob() : null;
          if (bytes && types.includes(bytes.type) && bytes.size <= 2_000_000) {
            const url = await new Promise<string>((done, failed) => {
              const reader = new FileReader();
              reader.onload = () => done(String(reader.result));
              reader.onerror = () => failed(reader.error);
              reader.readAsDataURL(bytes);
            });
            return { url };
          }
        } catch {
          // not ours to fetch from here: the capture below
        }
        const img = [...document.images].find((i) => i.currentSrc === src || i.src === src);
        if (!img) return null;
        const r = img.getBoundingClientRect();
        const x = Math.max(0, r.left);
        const y = Math.max(0, r.top);
        const w = Math.min(innerWidth, r.right) - x;
        const h = Math.min(innerHeight, r.bottom) - y;
        return w > 8 && h > 8 ? { x, y, w, h, scale: devicePixelRatio } : null;
      },
    });
    const at = found?.result as { url: string } | { x: number; y: number; w: number; h: number; scale: number } | null | undefined;
    if (!at) return null;
    if ("url" in at) return await (await fetch(at.url)).blob();
    const shot = await createImageBitmap(await (await fetch(await browser.tabs.captureVisibleTab(windowId, { format: "png" }))).blob());
    const canvas = new OffscreenCanvas(Math.round(at.w * at.scale), Math.round(at.h * at.scale));
    canvas.getContext("2d")!.drawImage(shot, Math.round(at.x * at.scale), Math.round(at.y * at.scale), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  } catch {
    return null;
  }
}
