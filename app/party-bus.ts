type SendOptions = { target?: string | string[] };
type ActionHandler = (data: unknown, meta: { peerId: string }) => void;
type MqttClient = {
  connected: boolean;
  subscribe: (topic: string, callback: (error?: Error) => void) => void;
  publish: (topic: string, message: string) => void;
  on: (event: string, listener: (...args: never[]) => void) => void;
  end: (force?: boolean) => void;
};

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

function decodePayload(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (payload instanceof Uint8Array) return new TextDecoder().decode(payload);
  return "";
}

export function joinParty(
  roomId: string,
  selfId: string,
  hooks: { onStatus: (status: "connected" | "error") => void },
) {
  const topic = `hb/${roomId}`;
  const handlers = new Map<string, ActionHandler>();
  const seen = new Map<string, number>();
  const queue: string[] = [];
  let closed = false;
  let attempt = 0;
  let client: MqttClient | null = null;
  const room = {
    onPeerJoin: (_peerId: string) => undefined,
    onPeerLeave: (_peerId: string) => undefined,
    leave() {
      closed = true;
      window.clearInterval(sweep);
      client?.end(true);
      client = null;
    },
    makeAction<T>(name: string) {
      const action = {
        send(data: T, options?: SendOptions) {
          publish(JSON.stringify({ from: selfId, action: name, target: options?.target, data }));
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

  function publish(body: string) {
    if (client?.connected) client.publish(topic, body);
    else queue.push(body);
    if (queue.length > 40) queue.splice(0, queue.length - 40);
  }

  function handleMessage(payload: unknown) {
    let message: { from?: unknown; action?: unknown; target?: unknown; data?: unknown };
    try {
      message = JSON.parse(decodePayload(payload));
    } catch {
      return;
    }
    if (!message || typeof message.from !== "string" || message.from === selfId || typeof message.action !== "string") return;
    if (typeof message.target === "string" && message.target !== selfId) return;
    if (Array.isArray(message.target) && !message.target.includes(selfId)) return;
    const now = Date.now();
    if (!seen.has(message.from)) room.onPeerJoin(message.from);
    seen.set(message.from, now);
    handlers.get(message.action)?.(message.data, { peerId: message.from });
  }

  async function start(index: number) {
    if (closed) return;
    const generation = ++attempt;
    const mqttModule = await import("mqtt/dist/mqtt.esm") as { default?: unknown; connect?: unknown };
    if (closed || generation !== attempt) return;
    const imported = mqttModule.default ?? mqttModule;
    const connect = (typeof imported === "function" ? imported : (imported as { connect?: unknown }).connect) as
      | ((url: string, options: Record<string, unknown>) => MqttClient)
      | undefined;
    if (!connect) {
      hooks.onStatus("error");
      return;
    }
    const next = connect(BROKERS[index % BROKERS.length], {
      clientId: `hb${selfId.replace(/[^a-z0-9]/gi, "").slice(-8)}${Math.random().toString(16).slice(2, 8)}`.slice(0, 23),
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 8000,
      protocolVersion: 4,
    });
    client = next;
    let settled = false;
    let handedOff = false;
    const giveUp = () => {
      if (closed || handedOff || generation !== attempt) return;
      handedOff = true;
      next.end(true);
      if (client === next) client = null;
      if (index + 1 >= BROKERS.length) hooks.onStatus("error");
      window.setTimeout(() => start((index + 1) % BROKERS.length), 600);
    };
    const timer = window.setTimeout(giveUp, 9000);
    next.on("message", ((_topic: string, payload: unknown) => {
      if (generation === attempt) handleMessage(payload);
    }) as (...args: never[]) => void);
    next.on("connect", (() => {
      if (generation !== attempt) return;
      window.clearTimeout(timer);
      next.subscribe(topic, (error) => {
        if (generation !== attempt) return;
        if (error) {
          giveUp();
          return;
        }
        settled = true;
        hooks.onStatus("connected");
        for (const body of queue.splice(0)) next.publish(topic, body);
      });
    }) as (...args: never[]) => void);
    next.on("error", giveUp as (...args: never[]) => void);
    next.on("close", (() => {
      if (closed || handedOff || generation !== attempt || !settled) return;
      handedOff = true;
      void start(index);
    }) as (...args: never[]) => void);
  }

  const sweep = window.setInterval(() => {
    const now = Date.now();
    for (const [peerId, seenAt] of seen) {
      if (now - seenAt < 7000) continue;
      seen.delete(peerId);
      room.onPeerLeave(peerId);
    }
  }, 1000);

  void start(0);
  return room;
}
