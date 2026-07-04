/**
 * CiberMandi media URL helpers for Direct Trade / approval preview screens.
 *
 * Rule:
 * - One media item must resolve to one primary display/playback URL.
 * - Do not expose multiple URL candidates as separate "sources" in UI.
 * - Google Drive videos should use embed_url inside an iframe.
 */

export function mediaTypeOf(media: any): string {
  return String(media?.type || media?.media_type || "").trim().toUpperCase();
}

export function isGoogleDriveMedia(media: any): boolean {
  const values = [
    media?.embed_url,
    media?.preview_url,
    media?.playback_url,
    media?.stream_url,
    media?.download_url,
    media?.url,
  ].map((v) => String(v || "").toLowerCase());
  return Boolean(media?.is_google_drive) || values.some((v) => v.includes("drive.google.com") || v.includes("docs.google.com"));
}

function clean(value: any): string {
  const s = String(value || "").trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s;
}

export function mediaCandidates(media: any): string[] {
  const type = mediaTypeOf(media);
  const primary = type === "VIDEO"
    ? clean(media?.embed_url) || clean(media?.playback_url) || clean(media?.stream_url) || clean(media?.url)
    : clean(media?.preview_url) || clean(media?.url) || clean(media?.thumbnail_url);
  return primary ? [primary] : [];
}

export function thumbnailCandidates(media: any): string[] {
  const primary = clean(media?.thumbnail_url) || clean(media?.preview_url) || clean(media?.url);
  return primary ? [primary] : [];
}

export function firstMediaUrl(media: any): string {
  return mediaCandidates(media)[0] || "";
}

export function firstThumbnailUrl(media: any): string {
  return thumbnailCandidates(media)[0] || "";
}

export function videoEmbedUrl(media: any): string {
  return clean(media?.embed_url);
}

export function videoPlaybackUrl(media: any): string {
  return clean(media?.playback_url) || clean(media?.stream_url) || clean(media?.url);
}

export function imagePreviewUrl(media: any): string {
  return clean(media?.preview_url) || clean(media?.url) || clean(media?.thumbnail_url);
}
