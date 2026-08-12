const YOUTUBE_IFRAME_API = "https://www.youtube.com/iframe_api";
const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";

let iframeApiPromise;

export function extractPlaylistId(playlistUrl) {
  try {
    const url = new URL(playlistUrl);
    const playlistId = url.searchParams.get("list");

    return playlistId || null;
  } catch {
    return null;
  }
}

export function getPlaylistEmbedUrl(playlistId) {
  const url = new URL("https://www.youtube.com/embed");
  url.searchParams.set("listType", "playlist");
  url.searchParams.set("list", playlistId);
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("rel", "0");

  return url.toString();
}

export async function getPlaylistTrackNames(playlistId, apiKey, signal) {
  const tracks = [];
  let pageToken = "";

  do {
    const url = new URL(`${YOUTUBE_DATA_API}/playlistItems`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, { signal });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || "YouTube playlist data is unavailable.");
    }

    payload.items?.forEach((item) => {
      const snippet = item.snippet || {};
      tracks.push({
        id: item.id,
        position: Number.isInteger(snippet.position)
          ? snippet.position
          : tracks.length,
        title: snippet.title || "Unavailable track",
        videoId: snippet.resourceId?.videoId || item.contentDetails?.videoId || null,
      });
    });

    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return tracks;
}

export function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The YouTube player requires a browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (iframeApiPromise) {
    return iframeApiPromise;
  }

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      reject(new Error("The YouTube Player API did not load in time."));
    }, 12000);

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      window.clearTimeout(timeout);
      resolve(window.YT);
    };

    const existingScript = document.querySelector(
      `script[src="${YOUTUBE_IFRAME_API}"]`,
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = YOUTUBE_IFRAME_API;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("The YouTube Player API could not be loaded."));
    };
    document.head.append(script);
  });

  return iframeApiPromise;
}
