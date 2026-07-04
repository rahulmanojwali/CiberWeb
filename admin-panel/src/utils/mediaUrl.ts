/**
 * CiberMandi media URL helpers for Direct Trade / approval preview screens.
 * Chooses browser-renderable URLs and falls back across multiple candidates.
 */
export function mediaTypeOf(media: any): string {
  return String(media?.type || media?.media_type || "").trim().toUpperCase();
}

export function mediaCandidates(media: any): string[] {
  const type = mediaTypeOf(media);
  const values = type === "VIDEO"
    ? [media?.stream_url, media?.url, media?.download_url, media?.preview_url, ...(media?.candidate_urls || [])]
    : [media?.preview_url, media?.url, media?.thumbnail_url, media?.download_url, ...(media?.candidate_urls || []), ...(media?.thumbnail_candidates || [])];
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

export function thumbnailCandidates(media: any): string[] {
  const values = [media?.thumbnail_url, media?.preview_url, media?.url, ...(media?.thumbnail_candidates || []), ...(media?.candidate_urls || [])];
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

export function firstMediaUrl(media: any): string {
  return mediaCandidates(media)[0] || "";
}

export function firstThumbnailUrl(media: any): string {
  return thumbnailCandidates(media)[0] || "";
}
