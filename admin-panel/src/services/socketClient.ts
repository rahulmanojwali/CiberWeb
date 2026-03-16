import { API_BASE_URL } from "../config/appConfig";

type SocketLike = {
  connected?: boolean;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  emit: (event: string, payload?: any) => void;
  connect?: () => void;
};

declare global {
  interface Window {
    io?: (url: string, options?: Record<string, unknown>) => SocketLike;
  }
}

let socketPromise: Promise<SocketLike> | null = null;
const roomRefCounts = new Map<string, number>();

function apiOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "https://mandiapi.ciberdukaan.com";
  }
}

function buildScriptUrl() {
  return `${apiOrigin()}/socket.io/socket.io.js`;
}

function loadSocketIoScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Socket client requires a browser."));
  }
  if (typeof window.io === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cm-socket-client="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load socket client.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = buildScriptUrl();
    script.async = true;
    script.dataset.cmSocketClient = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load socket client."));
    document.head.appendChild(script);
  });
}

export async function getSocketClient(): Promise<SocketLike> {
  if (!socketPromise) {
    socketPromise = loadSocketIoScript().then(() => {
      if (typeof window.io !== "function") {
        throw new Error("Socket.IO client not available.");
      }
      const socket = window.io(apiOrigin(), {
        transports: ["websocket", "polling"],
        reconnection: true,
      });
      if (import.meta.env.DEV) {
        socket.on("connect", () => console.debug("[auction-socket] connected"));
        socket.on("disconnect", () => console.debug("[auction-socket] disconnected"));
      }
      socket.connect?.();
      return socket;
    });
  }
  return socketPromise;
}

function retainRoom(key: string) {
  roomRefCounts.set(key, (roomRefCounts.get(key) || 0) + 1);
}

function releaseRoom(key: string) {
  const current = roomRefCounts.get(key) || 0;
  if (current <= 1) roomRefCounts.delete(key);
  else roomRefCounts.set(key, current - 1);
  return current <= 1;
}

export async function subscribeAuctionSession(
  params: { sessionId: string; mandiId?: string | number | null },
  handlers: Record<string, (...args: any[]) => void>
) {
  const socket = await getSocketClient();
  const roomKey = `auction_session_${params.sessionId}`;
  if (!roomRefCounts.has(roomKey)) {
    socket.emit("auction.join.session", { session_id: params.sessionId, mandi_id: params.mandiId ?? undefined });
  }
  retainRoom(roomKey);

  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
    if (releaseRoom(roomKey)) {
      socket.emit("auction.leave.session", { session_id: params.sessionId, mandi_id: params.mandiId ?? undefined });
    }
  };
}

export async function subscribeAuctionLot(
  params: { lotId: string; sessionId?: string | null },
  handlers: Record<string, (...args: any[]) => void>
) {
  const socket = await getSocketClient();
  const roomKey = `auction_lot_${params.lotId}`;
  if (!roomRefCounts.has(roomKey)) {
    socket.emit("auction.join.lot", { lot_id: params.lotId, session_id: params.sessionId ?? undefined });
  }
  retainRoom(roomKey);

  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
    if (releaseRoom(roomKey)) {
      socket.emit("auction.leave.lot", { lot_id: params.lotId, session_id: params.sessionId ?? undefined });
    }
  };
}

export async function subscribeMarketMandi(
  params: { mandiId: string | number },
  handlers: Record<string, (...args: any[]) => void>
) {
  const socket = await getSocketClient();
  const roomKey = `market_mandi_${params.mandiId}`;
  if (!roomRefCounts.has(roomKey)) {
    socket.emit("market.join.mandi", { mandi_id: params.mandiId });
  }
  retainRoom(roomKey);

  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
    if (releaseRoom(roomKey)) {
      socket.emit("market.leave.mandi", { mandi_id: params.mandiId });
    }
  };
}
