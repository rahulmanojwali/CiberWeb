export const AUCTION_SCOPE_STORAGE_KEY = "auction.scope";

export type AuctionScopeState = {
  org_code?: string;
  mandi_code?: string;
};

export function readAuctionScope(): AuctionScopeState {
  try {
    const raw = localStorage.getItem(AUCTION_SCOPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      org_code: parsed?.org_code ? String(parsed.org_code) : "",
      mandi_code: parsed?.mandi_code ? String(parsed.mandi_code) : "",
    };
  } catch {
    return {};
  }
}

export function writeAuctionScope(scope: AuctionScopeState) {
  try {
    localStorage.setItem(
      AUCTION_SCOPE_STORAGE_KEY,
      JSON.stringify({
        org_code: scope.org_code || "",
        mandi_code: scope.mandi_code || "",
      })
    );
  } catch {
    // ignore persistence failures
  }
}
