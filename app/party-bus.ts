type SendOptions = { target?: string | string[] };
type ActionHandler = (data: unknown, meta: { peerId: string }) => void;
type OutEvent = { action: string; target?: string | string[]; data: unknown };

function topicFor(roomId: string) {
  const slug = roomId.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "room";
  return `hb-${slug}`;
}

export function joinParty(
  roomId: string,
  selfId: string,
  hooks: { onStatus: (status: "connected" | "error") => void },
) {
  const topic = topicFor(roomId);
  const handlers = new Map<string, ActionHandler>();
  const seenPeers = new Map<string, number>();
  const seenIds = new Set<string>();
  const pending: OutEvent[] = [];
  let closed = false;
  let seq = 0;
  let flushTimer = 0;
  let errorTimer = 0;
  let lastFlush = 0;
  const room = {
    onPeerJoin: (_peerId: string) => undefined,
    onPeerLeave: (_peerId: string) => undefined,
    leave() {
      closed = true;
      window.clearTimeout(flushTimer);
      window.clearTimeout(errorTimer);
      window.clearInterval(sweep);
      source.close();
    },
    makeAction<T>(name: string) {
      const action = {
        send(data: T, options?: SendOptions) {
          const next: OutEvent = { action: name, target: options?.target, data };
          const sticky = next.target === undefined && ["presence", "player", "music", "spotlight", "room-info"].includes(name);
          const existing = sticky ? pending.findIndex((item) => item.action === name && item.target === undefined) : -1;
          if (existing >= 0) pending[existing] = next;
          else pending.push(next);
          if (pending.length > 40) pending.splice(0, pending.length - 40);
          if (!flushTimer) {
            const wait = Math.max(40, 6000 - (Date.now() - lastFlush));
            flushTimer = window.setTimeout(() => {
              flushTimer = 0;
              void flush();
            }, wait);
          }
          return Promise.resolve();
        },
        onMessage(_data: T, _meta: { peerId: string }) {
          return undefined;
        },
      };
      handlers.set(name, (data, meta) => action.onMessage(data as T, meta));
      return action;
    },
  };

  function deliver(from: string, event: OutEvent) {
    if (typeof event.target === "string" && event.target !== selfId) return;
    if (Array.isArray(event.target) && !event.target.includes(selfId)) return;
    const now = Date.now();
    if (!seenPeers.has(from)) room.onPeerJoin(from);
    seenPeers.set(from, now);
    if (typeof event.action === "string") handlers.get(event.action)?.(event.data, { peerId: from });
  }

  async function flush() {
    if (closed || pending.length === 0) return;
    const batch = pending.splice(0);
    const body = JSON.stringify({ id: `${selfId}:${++seq}`, from: selfId, batch });
    lastFlush = Date.now();
    try {
      const response = await fetch(`https://ntfy.sh/${topic}`, { method: "POST", body });
      if (response.status === 429) {
        pending.unshift(...batch);
        const retry = Number(response.headers.get("retry-after")) || 12;
        if (!flushTimer) {
          flushTimer = window.setTimeout(() => {
            flushTimer = 0;
            void flush();
          }, retry * 1000);
        }
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      window.clearTimeout(errorTimer);
      hooks.onStatus("connected");
    } catch {
      pending.unshift(...batch);
      if (!errorTimer) errorTimer = window.setTimeout(() => hooks.onStatus("error"), 8000);
    }
  }

  const source = new EventSource(`https://ntfy.sh/${topic}/sse`);
  source.onopen = () => {
    window.clearTimeout(errorTimer);
    errorTimer = 0;
    hooks.onStatus("connected");
  };
  source.onerror = () => {
    if (closed || errorTimer) return;
    errorTimer = window.setTimeout(() => hooks.onStatus("error"), 8000);
  };
  source.onmessage = (event) => {
    let wrapper: { event?: string; message?: string };
    try {
      wrapper = JSON.parse(event.data);
    } catch {
      return;
    }
    if (wrapper.event !== "message" || typeof wrapper.message !== "string") return;
    let message: { id?: unknown; from?: unknown; batch?: unknown };
    try {
      message = JSON.parse(wrapper.message);
    } catch {
      return;
    }
    if (!message || typeof message.from !== "string" || message.from === selfId || !Array.isArray(message.batch)) return;
    if (typeof message.id === "string") {
      if (seenIds.has(message.id)) return;
      seenIds.add(message.id);
      if (seenIds.size > 400) seenIds.delete(seenIds.values().next().value ?? "");
    }
    for (const item of message.batch) {
      if (!item || typeof item !== "object") continue;
      deliver(message.from, item as OutEvent);
    }
  };

  const sweep = window.setInterval(() => {
    const now = Date.now();
    for (const [peerId, seenAt] of seenPeers) {
      if (now - seenAt < 18000) continue;
      seenPeers.delete(peerId);
      room.onPeerLeave(peerId);
    }
  }, 1000);

  return room;
}
