// What the browser can see that the server cannot: the page as rendered (logins, SPAs), the selection,
// and a video's captions from the player data in your session.
export type Captured = { title: string; html?: string; selection: string; transcript?: string };

const MAX_HTML = 4_000_000; // request bodies on the hosted server stop at 4.5 MB

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
      ...(content && got.html.length <= MAX_HTML ? { html: got.html } : {}),
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
