"use client";
/* eslint-disable @next/next/no-img-element -- Static sprite artwork is pre-optimized for the game scene. */

import {
  type CSSProperties,
  type FormEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AvatarId =
  | "coral" | "ocean" | "violet" | "sunny" | "amber" | "mint" | "glasses" | "sporty" | "silver"
  | "ruby" | "mocha" | "forest" | "mustard" | "burgundy" | "sky" | "lilac" | "denim" | "emerald" | "teal" | "varsity";
type AvatarAction =
  | "idle" | "wave" | "jump" | "dance" | "toast" | "bow" | "cheer"
  | "groove" | "shuffle" | "bounce" | "twist" | "disco" | "signature";
type DanceProfile = {
  label: string;
  animation: string;
  symbol: string;
  speed: number;
  moves: AvatarAction[];
  beatPattern: number[];
};
type FrameIndex = 0 | 1 | 2 | 3;
type CharacterActionSet = {
  frames: readonly [FrameIndex, FrameIndex, FrameIndex, FrameIndex];
  idleFrame: FrameIndex;
  tempo: number;
  travel: number;
  lift: number;
  tilt: number;
  stretch: number;
  direction: 1 | -1;
};

type RoomConfig = {
  birthdayName: string;
  roomTitle: string;
  roomMessage: string;
  roomId: string;
  appId: string;
  musicManifest: string;
};

type GuestProfile = {
  token: string;
  name: string;
  avatarId: AvatarId;
};

type PlayerState = GuestProfile & {
  x: number;
  y: number;
  joinedAt: number;
  action: AvatarAction;
};

type Wish = { id: string; author: string; text: string; createdAt: number };
type Track = { id: string; title: string; artist: string; src: string; bpm?: number };
type MusicState = { trackId: string; isPlaying: boolean; startedAt: number; updatedAt: number };
type RoomInfo = { birthdayName: string; roomTitle: string; roomMessage: string; updatedAt: number };
type Spotlight = { token: string; updatedAt: number };
type RoomEffect = { type: "confetti" | "toast"; at: number };
type Presence = { token: string; joinedAt: number };
type SendOptions = { target?: string | string[] };
type SendAction<T> = (data: T, options?: SendOptions) => Promise<unknown>;

function sendQuietly<T>(send: SendAction<T> | null | undefined, data: T, options?: SendOptions) {
  if (!send) return;
  try {
    void Promise.resolve(send(data, options)).catch(() => undefined);
  } catch {
    // Kênh WebRTC có thể đóng giữa lúc gửi.
  }
}

const AVATARS: Array<{ id: AvatarId; label: string; sheet: string; row: number; color: string }> = [
  { id: "coral", label: "San hô", sheet: "/avatar-sprites.png", row: 0, color: "#ff6b79" },
  { id: "ocean", label: "Biển xanh", sheet: "/avatar-sprites.png", row: 1, color: "#00a99d" },
  { id: "violet", label: "Tím sao", sheet: "/avatar-sprites.png", row: 2, color: "#7257d9" },
  { id: "sunny", label: "Nắng mai", sheet: "/avatar-sprites-v2.png", row: 0, color: "#e89c2f" },
  { id: "amber", label: "Cam năng động", sheet: "/avatar-sprites-v2.png", row: 1, color: "#f06c25" },
  { id: "mint", label: "Bạc hà", sheet: "/avatar-sprites-v2.png", row: 2, color: "#47b89c" },
  { id: "glasses", label: "Kính xanh", sheet: "/avatar-sprites-v3.png", row: 0, color: "#376ad3" },
  { id: "sporty", label: "Hồng thể thao", sheet: "/avatar-sprites-v3.png", row: 1, color: "#d9347a" },
  { id: "silver", label: "Tóc bạc", sheet: "/avatar-sprites-v3.png", row: 2, color: "#8b69dc" },
  { id: "ruby", label: "Ruby", sheet: "/avatar-sprites-v4.png", row: 0, color: "#d94b5b" },
  { id: "mocha", label: "Mocha", sheet: "/avatar-sprites-v4.png", row: 1, color: "#8b5b43" },
  { id: "forest", label: "Rừng xanh", sheet: "/avatar-sprites-v4.png", row: 2, color: "#24845d" },
  { id: "mustard", label: "Mù tạt", sheet: "/avatar-sprites-v5.png", row: 0, color: "#d79a28" },
  { id: "burgundy", label: "Đỏ rượu", sheet: "/avatar-sprites-v5.png", row: 1, color: "#8f354f" },
  { id: "sky", label: "Trời xanh", sheet: "/avatar-sprites-v5.png", row: 2, color: "#6498dc" },
  { id: "lilac", label: "Tử đinh hương", sheet: "/avatar-sprites-v6.png", row: 0, color: "#9a6cda" },
  { id: "denim", label: "Denim", sheet: "/avatar-sprites-v6.png", row: 1, color: "#3c72a7" },
  { id: "emerald", label: "Ngọc lục bảo", sheet: "/avatar-sprites-v6.png", row: 2, color: "#238663" },
  { id: "teal", label: "Xanh cổ vịt", sheet: "/avatar-sprites-v7.png", row: 0, color: "#287d7a" },
  { id: "varsity", label: "Varsity đỏ", sheet: "/avatar-sprites-v7.png", row: 1, color: "#c83e4e" },
];

const DANCE_PROFILES: Record<AvatarId, DanceProfile> = {
  coral: { label: "Salsa Pop", animation: "signature-coral", symbol: "🦋", speed: 1550, moves: ["groove", "twist", "disco"], beatPattern: [2, 2, 3] },
  ocean: { label: "Moonwalk", animation: "signature-ocean", symbol: "🐬", speed: 1800, moves: ["shuffle", "twist", "groove"], beatPattern: [4, 2, 2] },
  violet: { label: "Disco Star", animation: "signature-violet", symbol: "⭐", speed: 1650, moves: ["disco", "cheer", "groove"], beatPattern: [2, 3, 2] },
  sunny: { label: "Sunny Chick", animation: "signature-sunny", symbol: "🐥", speed: 1700, moves: ["twist", "shuffle", "bounce"], beatPattern: [2, 2, 4] },
  amber: { label: "Running Man", animation: "signature-amber", symbol: "🔥", speed: 1500, moves: ["shuffle", "bounce", "jump"], beatPattern: [2, 2, 2] },
  mint: { label: "Bunny Sway", animation: "signature-mint", symbol: "🐰", speed: 1750, moves: ["dance", "groove", "cheer"], beatPattern: [3, 2, 3] },
  glasses: { label: "Owl Step", animation: "signature-glasses", symbol: "🦉", speed: 1850, moves: ["twist", "bounce", "shuffle"], beatPattern: [2, 4, 2] },
  sporty: { label: "Power Hop", animation: "signature-sporty", symbol: "⚡", speed: 1600, moves: ["bounce", "jump", "groove"], beatPattern: [2, 2, 3] },
  silver: { label: "Moon Float", animation: "signature-silver", symbol: "🌙", speed: 2000, moves: ["groove", "disco", "dance"], beatPattern: [4, 3, 4] },
  ruby: { label: "Flamenco Spark", animation: "signature-ruby", symbol: "🌹", speed: 1750, moves: ["twist", "disco", "cheer"], beatPattern: [3, 2, 4] },
  mocha: { label: "Bear Two-step", animation: "signature-mocha", symbol: "🐻", speed: 1850, moves: ["dance", "shuffle", "groove"], beatPattern: [4, 2, 3] },
  forest: { label: "Fox Stomp", animation: "signature-forest", symbol: "🦊", speed: 1650, moves: ["bounce", "cheer", "jump"], beatPattern: [2, 3, 2] },
  mustard: { label: "Bee Twist", animation: "signature-mustard", symbol: "🐝", speed: 1600, moves: ["twist", "groove", "shuffle"], beatPattern: [2, 2, 4] },
  burgundy: { label: "Velvet Tango", animation: "signature-burgundy", symbol: "💖", speed: 1950, moves: ["dance", "twist", "disco"], beatPattern: [4, 3, 2] },
  sky: { label: "Dove Swing", animation: "signature-sky", symbol: "🕊️", speed: 1850, moves: ["groove", "jump", "dance"], beatPattern: [3, 4, 2] },
  lilac: { label: "Starlight Pop", animation: "signature-lilac", symbol: "✨", speed: 1600, moves: ["disco", "cheer", "bounce"], beatPattern: [2, 3, 3] },
  denim: { label: "Wolf Lock", animation: "signature-denim", symbol: "🐺", speed: 1750, moves: ["shuffle", "twist", "bounce"], beatPattern: [2, 4, 3] },
  emerald: { label: "Lucky Step", animation: "signature-emerald", symbol: "🍀", speed: 1700, moves: ["groove", "dance", "twist"], beatPattern: [3, 2, 4] },
  teal: { label: "Whale Flow", animation: "signature-teal", symbol: "🐳", speed: 2000, moves: ["groove", "disco", "dance"], beatPattern: [4, 4, 2] },
  varsity: { label: "Lion Victory", animation: "signature-varsity", symbol: "🦁", speed: 1650, moves: ["jump", "cheer", "bounce"], beatPattern: [2, 2, 3] },
};

const CHARACTER_ACTION_SETS: Record<AvatarId, CharacterActionSet> = {
  coral: { frames: [0, 1, 2, 3], idleFrame: 0, tempo: 1.05, travel: 10, lift: 20, tilt: 8, stretch: 1.05, direction: 1 },
  ocean: { frames: [0, 1, 3, 2], idleFrame: 1, tempo: 1.18, travel: 18, lift: 12, tilt: 5, stretch: .96, direction: -1 },
  violet: { frames: [0, 2, 1, 3], idleFrame: 3, tempo: 1.1, travel: 12, lift: 26, tilt: 14, stretch: 1.08, direction: 1 },
  sunny: { frames: [0, 2, 3, 1], idleFrame: 0, tempo: 1.15, travel: 8, lift: 14, tilt: 4, stretch: .94, direction: -1 },
  amber: { frames: [0, 3, 1, 2], idleFrame: 3, tempo: .92, travel: 17, lift: 32, tilt: 7, stretch: 1.1, direction: 1 },
  mint: { frames: [0, 3, 2, 1], idleFrame: 1, tempo: 1.08, travel: 9, lift: 18, tilt: 10, stretch: 1.03, direction: -1 },
  glasses: { frames: [1, 0, 2, 3], idleFrame: 0, tempo: 1.2, travel: 7, lift: 16, tilt: 6, stretch: .92, direction: 1 },
  sporty: { frames: [1, 0, 3, 2], idleFrame: 2, tempo: .9, travel: 15, lift: 38, tilt: 9, stretch: 1.12, direction: -1 },
  silver: { frames: [1, 2, 0, 3], idleFrame: 3, tempo: 1.28, travel: 11, lift: 28, tilt: 4, stretch: 1.02, direction: 1 },
  ruby: { frames: [1, 2, 3, 0], idleFrame: 1, tempo: 1.12, travel: 13, lift: 23, tilt: 15, stretch: 1.07, direction: -1 },
  mocha: { frames: [1, 3, 0, 2], idleFrame: 0, tempo: 1.2, travel: 16, lift: 11, tilt: 3, stretch: .97, direction: 1 },
  forest: { frames: [1, 3, 2, 0], idleFrame: 3, tempo: .98, travel: 8, lift: 34, tilt: 8, stretch: 1.11, direction: -1 },
  mustard: { frames: [2, 0, 1, 3], idleFrame: 1, tempo: 1, travel: 14, lift: 17, tilt: 12, stretch: .95, direction: 1 },
  burgundy: { frames: [2, 0, 3, 1], idleFrame: 0, tempo: 1.24, travel: 19, lift: 21, tilt: 16, stretch: 1.06, direction: -1 },
  sky: { frames: [2, 1, 0, 3], idleFrame: 3, tempo: 1.16, travel: 20, lift: 29, tilt: 11, stretch: 1.04, direction: 1 },
  lilac: { frames: [2, 1, 3, 0], idleFrame: 1, tempo: .96, travel: 10, lift: 36, tilt: 13, stretch: 1.09, direction: -1 },
  denim: { frames: [2, 3, 0, 1], idleFrame: 0, tempo: 1.04, travel: 17, lift: 15, tilt: 6, stretch: .93, direction: 1 },
  emerald: { frames: [2, 3, 1, 0], idleFrame: 3, tempo: 1.1, travel: 12, lift: 24, tilt: 9, stretch: 1.01, direction: -1 },
  teal: { frames: [3, 0, 1, 2], idleFrame: 1, tempo: 1.26, travel: 21, lift: 19, tilt: 5, stretch: .98, direction: 1 },
  varsity: { frames: [3, 0, 2, 1], idleFrame: 2, tempo: .94, travel: 14, lift: 40, tilt: 10, stretch: 1.13, direction: -1 },
};

const SPRITE_COLUMNS = ["0%", "33.333%", "66.667%", "100%"] as const;
const ACTION_FRAME_ORDERS: Record<AvatarAction, readonly [FrameIndex, FrameIndex, FrameIndex, FrameIndex]> = {
  idle: [0, 0, 0, 0],
  wave: [0, 1, 0, 1],
  jump: [0, 2, 2, 0],
  dance: [0, 3, 1, 3],
  toast: [0, 2, 2, 0],
  bow: [0, 0, 0, 0],
  cheer: [0, 2, 1, 0],
  groove: [0, 3, 0, 3],
  shuffle: [0, 3, 0, 3],
  bounce: [0, 2, 0, 2],
  twist: [0, 3, 0, 3],
  disco: [0, 3, 1, 3],
  signature: [0, 0, 0, 0],
};
const BASE_ACTION_SPEEDS: Record<AvatarAction, number> = {
  idle: 1000, wave: 650, jump: 700, dance: 450, toast: 900, bow: 750, cheer: 500,
  groove: 520, shuffle: 620, bounce: 560, twist: 700, disco: 720, signature: 1000,
};
const ACTIONS: AvatarAction[] = ["idle", "wave", "jump", "dance", "toast", "bow", "cheer", "groove", "shuffle", "bounce", "twist", "disco", "signature"];
const EMPTY_MUSIC: MusicState = { trackId: "", isPlaying: false, startedAt: 0, updatedAt: 0 };
const EMPTY_SPOTLIGHT: Spotlight = { token: "", updatedAt: 0 };
const ROOM_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.wine",
  "wss://relay.nostr.band",
];

function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isAvatarId(value: unknown): value is AvatarId {
  return AVATARS.some((avatar) => avatar.id === value);
}

function isAvatarAction(value: unknown): value is AvatarAction {
  return typeof value === "string" && ACTIONS.includes(value as AvatarAction);
}

function avatarFor(id: AvatarId) {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];
}

function isWish(value: unknown): value is Wish {
  if (!value || typeof value !== "object") return false;
  const wish = value as Partial<Wish>;
  return Boolean(safeText(wish.id, 80) && safeText(wish.author, 24) && safeText(wish.text, 160) && typeof wish.createdAt === "number");
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp() {
  return Date.now();
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function spawnFor(token: string) {
  const hash = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return { x: 39 + (hash % 24), y: 75 + (hash % 9) };
}

function stagePosition(slot: number, width: number) {
  const narrow = width < 760;
  const columns = narrow ? 3 : 5;
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  const spacing = narrow ? 28 : slot > 9 ? 13 : 16;
  const x = 50 + (column - (columns - 1) / 2) * spacing;
  const y = 84 - row * (narrow ? 22 : 17);
  return { x, y };
}

function samePlayer(a: PlayerState, b: PlayerState) {
  return a.token === b.token && a.name === b.name && a.avatarId === b.avatarId
    && a.x === b.x && a.y === b.y && a.joinedAt === b.joinedAt && a.action === b.action;
}

function spriteStyle(avatarId: AvatarId, action: AvatarAction = "idle") {
  const avatar = avatarFor(avatarId);
  const danceProfile = DANCE_PROFILES[avatarId];
  const actionSet = CHARACTER_ACTION_SETS[avatarId];
  const frames = action === "idle"
    ? [SPRITE_COLUMNS[actionSet.idleFrame], SPRITE_COLUMNS[actionSet.idleFrame], SPRITE_COLUMNS[actionSet.idleFrame], SPRITE_COLUMNS[actionSet.idleFrame]]
    : ACTION_FRAME_ORDERS[action].map((frame) => SPRITE_COLUMNS[frame]);
  const travel = actionSet.travel * actionSet.direction;
  const tilt = actionSet.tilt * actionSet.direction;
  const actionSpeed = BASE_ACTION_SPEEDS[action];
  const idleX = Math.max(1, Math.round(actionSet.travel * .12)) * actionSet.direction;
  const idleTilt = Math.max(1, Math.round(actionSet.tilt * .18)) * actionSet.direction;
  return {
    "--avatar": avatar.color,
    "--sprite-sheet": `url(${avatar.sheet})`,
    "--sprite-x": frames[0],
    "--sprite-y": avatar.row === 0 ? "0%" : avatar.row === 1 ? "50%" : "100%",
    "--action-frame-a": frames[0],
    "--action-frame-b": frames[1],
    "--action-frame-c": frames[2],
    "--action-frame-d": frames[3],
    "--action-speed": `${actionSpeed}ms`,
    "--idle-speed": `${Math.round(2100 * actionSet.tempo)}ms`,
    "--idle-art-y": `${actionSet.idleFrame === 2 ? 13 : actionSet.idleFrame === 3 ? 4 : 0}%`,
    "--idle-x": `${idleX}px`,
    "--idle-x-reverse": `${-idleX}px`,
    "--idle-y": `${-Math.max(1, Math.round(actionSet.lift * .08))}px`,
    "--idle-tilt": `${idleTilt}deg`,
    "--idle-tilt-reverse": `${-idleTilt}deg`,
    "--motion-x": `${travel}px`,
    "--motion-x-reverse": `${-travel}px`,
    "--motion-lift": `${-actionSet.lift}px`,
    "--motion-lift-half": `${-Math.round(actionSet.lift * .5)}px`,
    "--motion-drop": `${Math.max(4, Math.round(actionSet.lift * .25))}px`,
    "--motion-tilt": `${tilt}deg`,
    "--motion-tilt-reverse": `${-tilt}deg`,
    "--motion-stretch": actionSet.stretch,
    "--motion-squash": Number((2 - actionSet.stretch).toFixed(2)),
    "--signature-animation": danceProfile.animation,
    "--signature-frame-animation": danceProfile.animation.replace("signature-", "signature-frames-"),
    "--signature-symbol": `"${danceProfile.symbol}"`,
    "--signature-speed": `${danceProfile.speed}ms`,
  } as CSSProperties;
}

const Avatar = memo(function Avatar({ player, remote = false, host = false, size = 150, order = 0 }: { player: PlayerState; remote?: boolean; host?: boolean; size?: number; order?: number }) {
  const avatarStyle = {
    ...spriteStyle(player.avatarId, player.action),
    "--player-size": `${size}px`,
    left: `${player.x}%`,
    top: `${player.y}%`,
    zIndex: 12 + order,
  } as CSSProperties;
  return (
    <div className={`sprite-player avatar-${player.avatarId} action-${player.action} ${remote ? "is-remote" : ""} ${host ? "is-host" : ""}`} style={avatarStyle} aria-label={`${host ? "Chủ phòng" : remote ? "Khách" : "Bạn"}: ${player.name}`}>
      <span className="sprite-shadow" />
      <span className="sprite-character" aria-hidden="true" />
      <small>{host ? "👑 " : ""}{player.name}</small>
    </div>
  );
}, (previous, next) => previous.remote === next.remote && previous.host === next.host && previous.size === next.size && previous.order === next.order && samePlayer(previous.player, next.player));

export default function BirthdayRoom({ config }: { config: RoomConfig }) {
  const profileKey = `birthday-profile:${config.roomId}`;
  const roomInfoKey = `birthday-room-info:${config.roomId}`;
  const [clientToken, setClientToken] = useState("");
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [joinedAt, setJoinedAt] = useState(0);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [peers, setPeers] = useState<Record<string, PlayerState>>({});
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [music, setMusic] = useState<MusicState>(EMPTY_MUSIC);
  const [spotlight, setSpotlight] = useState<Spotlight>(EMPTY_SPOTLIGHT);
  const [roomInfo, setRoomInfo] = useState<RoomInfo>({
    birthdayName: config.birthdayName,
    roomTitle: config.roomTitle,
    roomMessage: config.roomMessage,
    updatedAt: 0,
  });
  const [wishDraft, setWishDraft] = useState("");
  const [connection, setConnection] = useState<"waiting" | "connected" | "error">("waiting");
  const [showPhotoIntro, setShowPhotoIntro] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showWishes, setShowWishes] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showStagePicker, setShowStagePicker] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [needsAudioConsent, setNeedsAudioConsent] = useState(false);
  const [danceAlong, setDanceAlong] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [toast, setToast] = useState("");
  const [confetti, setConfetti] = useState(0);
  const [beerToast, setBeerToast] = useState(0);
  const [setupName, setSetupName] = useState("");
  const [setupAvatarId, setSetupAvatarId] = useState<AvatarId>("violet");
  const [roomInfoDraft, setRoomInfoDraft] = useState({ birthdayName: config.birthdayName, roomTitle: config.roomTitle, roomMessage: config.roomMessage });
  const playerRef = useRef<PlayerState | null>(null);
  const musicRef = useRef<MusicState>(EMPTY_MUSIC);
  const spotlightRef = useRef<Spotlight>(EMPTY_SPOTLIGHT);
  const roomInfoRef = useRef<RoomInfo>(roomInfo);
  const isHostRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerSendRef = useRef<SendAction<PlayerState> | null>(null);
  const presenceSendRef = useRef<SendAction<Presence> | null>(null);
  const wishSendRef = useRef<SendAction<Wish | Wish[]> | null>(null);
  const effectSendRef = useRef<SendAction<RoomEffect> | null>(null);
  const musicSendRef = useRef<SendAction<MusicState> | null>(null);
  const spotlightSendRef = useRef<SendAction<Spotlight> | null>(null);
  const roomInfoSendRef = useRef<SendAction<RoomInfo> | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const seenWishIdsRef = useRef<Set<string>>(new Set());
  const stageSlotsRef = useRef<Map<string, number>>(new Map());
  const [flyby, setFlyby] = useState<Wish | null>(null);
  const [playedWishes, setPlayedWishes] = useState<Wish[]>([]);
  const [frame, setFrame] = useState({ width: 1280, height: 800 });
  const currentTrack = useMemo(() => tracks.find((track) => track.id === music.trackId) ?? null, [music.trackId, tracks]);
  const peerList = useMemo(() => Object.entries(peers), [peers]);
  const orderedPlayers = useMemo(() => {
    const everyone: Array<[string, PlayerState]> = [...peerList];
    if (player) everyone.push(["self", player]);
    return everyone.sort(([, a], [, b]) => a.joinedAt - b.joinedAt || a.token.localeCompare(b.token));
  }, [peerList, player]);
  const electedHostToken = orderedPlayers[0]?.[1].token ?? "";
  const isHost = Boolean(player && electedHostToken === player.token);
  const usedAvatarIds = useMemo(() => new Set(peerList.map(([, guest]) => guest.avatarId)), [peerList]);
  const placedPlayers = useMemo(() => {
    const slots = stageSlotsRef.current;
    return orderedPlayers.map(([peerId, guest]) => {
      let slot = guest.token ? slots.get(guest.token) : undefined;
      if (slot === undefined) {
        const used = new Set(slots.values());
        slot = 0;
        while (used.has(slot)) slot += 1;
        if (guest.token) slots.set(guest.token, slot);
      }
      return { peerId, guest, slot, position: stagePosition(slot, frame.width) };
    });
  }, [frame.width, orderedPlayers]);
  const stageStar = useMemo(() => placedPlayers.find((entry) => entry.guest.token && entry.guest.token === spotlight.token) ?? null, [placedPlayers, spotlight.token]);
  const floorPlayers = useMemo(() => placedPlayers.filter((entry) => entry !== stageStar), [placedPlayers, stageStar]);
  const crowded = floorPlayers.length > 8;
  const narrowFrame = frame.width < 760;
  const shortFrame = frame.height < 540;
  const playerSize = shortFrame
    ? crowded ? 72 : 88
    : narrowFrame
    ? Math.min(88, frame.width < 420 ? 78 : 100)
    : crowded ? 112 : 148;
  const activeAvatarId = player?.avatarId ?? profile?.avatarId ?? "coral";
  const activeDanceProfile = DANCE_PROFILES[activeAvatarId];

  useLayoutEffect(() => {
    const readFrame = () => setFrame({ width: window.innerWidth, height: window.innerHeight });
    readFrame();
    window.addEventListener("resize", readFrame);
    return () => window.removeEventListener("resize", readFrame);
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const savedProfile = loadJson<Partial<GuestProfile> & { style?: string }>(profileKey);
      localStorage.removeItem(`birthday-wishes:${config.roomId}`);
      localStorage.removeItem(`birthday-polls:${config.roomId}`);
      const savedRoomInfo = loadJson<RoomInfo>(roomInfoKey);
      if (savedRoomInfo?.updatedAt && safeText(savedRoomInfo.birthdayName, 60)) {
        const nextInfo = {
          birthdayName: safeText(savedRoomInfo.birthdayName, 60),
          roomTitle: safeText(savedRoomInfo.roomTitle, 80),
          roomMessage: safeText(savedRoomInfo.roomMessage, 180),
          updatedAt: savedRoomInfo.updatedAt,
        };
        roomInfoRef.current = nextInfo;
        setRoomInfo(nextInfo);
        setRoomInfoDraft(nextInfo);
      }
      const token = savedProfile?.token && safeText(savedProfile.name, 24) ? savedProfile.token : randomId();
      const arrivedKey = `birthday-arrived:${config.roomId}:${token}`;
      const savedArrived = Number(localStorage.getItem(arrivedKey));
      const arrived = Number.isFinite(savedArrived) && savedArrived > 0 ? savedArrived : Date.now();
      localStorage.setItem(arrivedKey, String(arrived));
      setClientToken(token);
      setJoinedAt(arrived);
      if (savedProfile?.token && safeText(savedProfile.name, 24)) {
        const legacyAvatar: AvatarId = savedProfile.style === "nu" ? "coral" : savedProfile.style === "nam" ? "ocean" : "violet";
        const nextProfile: GuestProfile = {
          token,
          name: safeText(savedProfile.name, 24),
          avatarId: isAvatarId(savedProfile.avatarId) ? savedProfile.avatarId : legacyAvatar,
        };
        const nextPlayer: PlayerState = { ...nextProfile, ...spawnFor(token), joinedAt: arrived, action: "idle" };
        setProfile(nextProfile);
        setPlayer(nextPlayer);
        playerRef.current = nextPlayer;
      } else {
        setShowSetup(true);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [config.roomId, profileKey, roomInfoKey]);

  useEffect(() => {
    let cancelled = false;
    fetch(config.musicManifest)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        const valid = data.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as Partial<Track>;
          const id = safeText(candidate.id, 60);
          const title = safeText(candidate.title, 80);
          const artist = safeText(candidate.artist, 80) || "Birthday Room";
          const src = safeText(candidate.src, 160);
          return id && title && src.startsWith("/music/") ? [{ id, title, artist, src }] : [];
        });
        setTracks(valid);
        if (valid.length) setMusic((current) => current.trackId ? current : { ...EMPTY_MUSIC, trackId: valid[0].id });
      })
      .catch(() => setTracks([]));
    return () => { cancelled = true; };
  }, [config.musicManifest]);

  useEffect(() => {
    if (flyby || !wishes.length) return;
    const next = [...wishes].sort((a, b) => a.createdAt - b.createdAt)[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Advances the transient banner queue one item at a time.
    setFlyby(next);
    setWishes((current) => current.filter((wish) => wish.id !== next.id));
    setPlayedWishes((current) => [...current, next].slice(-24));
  }, [flyby, wishes]);
  useEffect(() => { musicRef.current = music; }, [music]);
  useEffect(() => { spotlightRef.current = spotlight; }, [spotlight]);
  useEffect(() => { roomInfoRef.current = roomInfo; }, [roomInfo]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    if (!player) return;
    const conflicts = [player, ...peerList.map(([, guest]) => guest)]
      .filter((guest) => guest.avatarId === player.avatarId)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.token.localeCompare(b.token));
    if (conflicts[0]?.token === player.token) return;
    const frame = window.requestAnimationFrame(() => {
      const available = AVATARS.find((avatar) => !usedAvatarIds.has(avatar.id));
      if (available) setSetupAvatarId(available.id);
      setShowSetup(true);
      setToast("Avatar này vừa được chọn. Hãy chọn một nhân vật khác nhé!");
    });
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [peerList, player, usedAvatarIds]);

  const enqueueWish = useCallback((incoming: unknown) => {
    if (Array.isArray(incoming) || !isWish(incoming) || seenWishIdsRef.current.has(incoming.id)) return;
    seenWishIdsRef.current.add(incoming.id);
    const wish: Wish = {
      ...incoming,
      author: safeText(incoming.author, 24),
      text: safeText(incoming.text, 160),
    };
    setWishes((current) => [...current, wish].sort((a, b) => a.createdAt - b.createdAt).slice(0, 40));
  }, []);

  useEffect(() => {
    if (!clientToken || !joinedAt) return;
    let cancelled = false;
    let leaveRoom: (() => void) | undefined;
    let pulse = 0;
    const pendingLeaves = new Map<string, number>();
    const greetTimers = new Set<number>();

    import("trystero")
      .then(({ joinRoom }) => {
        if (cancelled) return;
        const localRelay = location.hostname === "localhost" || location.hostname === "127.0.0.1"
          ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/party-relay`
          : "";
        const room = joinRoom(
          { appId: config.appId, password: config.roomId, relayConfig: { urls: [localRelay, ...ROOM_RELAYS].filter(Boolean), warnOnRelayFailure: false } },
          config.roomId,
          { onJoinError: () => undefined },
        );
        leaveRoom = () => room.leave();
        const presenceAction = room.makeAction<Presence>("presence");
        const playerAction = room.makeAction<PlayerState>("player");
        const wishAction = room.makeAction<Wish | Wish[]>("wish");
        const effectAction = room.makeAction<RoomEffect>("effect");
        const musicAction = room.makeAction<MusicState>("music");
        const spotlightAction = room.makeAction<Spotlight>("spotlight");
        const roomInfoAction = room.makeAction<RoomInfo>("room-info");
        presenceSendRef.current = presenceAction.send;
        playerSendRef.current = playerAction.send;
        wishSendRef.current = wishAction.send;
        effectSendRef.current = effectAction.send;
        musicSendRef.current = musicAction.send;
        spotlightSendRef.current = spotlightAction.send;
        roomInfoSendRef.current = roomInfoAction.send;

        presenceAction.onMessage = () => undefined;

        playerAction.onMessage = (incoming, { peerId }) => {
          if (!incoming || typeof incoming !== "object") return;
          const name = safeText(incoming.name, 24);
          if (!name || typeof incoming.x !== "number" || typeof incoming.y !== "number") return;
          const legacyIncoming = incoming as PlayerState & { style?: string };
          const fallbackAvatar: AvatarId = legacyIncoming.style === "nu" ? "coral" : legacyIncoming.style === "nam" ? "ocean" : "violet";
          const nextGuest: PlayerState = {
            token: safeText(incoming.token, 80), name,
            avatarId: isAvatarId(incoming.avatarId) ? incoming.avatarId : fallbackAvatar,
            x: Math.max(4, Math.min(96, incoming.x)), y: Math.max(24, Math.min(92, incoming.y)),
            joinedAt: typeof incoming.joinedAt === "number" ? incoming.joinedAt : timestamp(),
            action: isAvatarAction(incoming.action) ? incoming.action : "idle",
          };
          setPeers((current) => {
            const duplicateIds = Object.entries(current).filter(([id, guest]) => id !== peerId && guest.token && guest.token === nextGuest.token).map(([id]) => id);
            const previous = current[peerId];
            if (previous && samePlayer(previous, nextGuest) && duplicateIds.length === 0) return current;
            const next = { ...current, [peerId]: nextGuest };
            for (const id of duplicateIds) delete next[id];
            return next;
          });
        };

        wishAction.onMessage = enqueueWish;

        effectAction.onMessage = ({ type }) => {
          if (type === "confetti") setConfetti((value) => value + 1);
          if (type === "toast") setBeerToast((value) => value + 1);
        };

        musicAction.onMessage = (incoming) => {
          if (!incoming || typeof incoming.trackId !== "string" || typeof incoming.isPlaying !== "boolean" || typeof incoming.updatedAt !== "number") return;
          if (incoming.updatedAt <= musicRef.current.updatedAt) return;
          const next = { ...incoming, trackId: safeText(incoming.trackId, 60), startedAt: Number(incoming.startedAt) || timestamp() };
          musicRef.current = next;
          setMusic(next);
        };

        spotlightAction.onMessage = (incoming) => {
          if (!incoming || typeof incoming.updatedAt !== "number" || incoming.updatedAt <= spotlightRef.current.updatedAt) return;
          const next = { token: safeText(incoming.token, 80), updatedAt: incoming.updatedAt };
          spotlightRef.current = next;
          setSpotlight(next);
        };

        roomInfoAction.onMessage = (incoming) => {
          if (!incoming || typeof incoming.updatedAt !== "number" || incoming.updatedAt <= roomInfoRef.current.updatedAt) return;
          const next: RoomInfo = {
            birthdayName: safeText(incoming.birthdayName, 60),
            roomTitle: safeText(incoming.roomTitle, 80),
            roomMessage: safeText(incoming.roomMessage, 180),
            updatedAt: incoming.updatedAt,
          };
          if (!next.birthdayName || !next.roomTitle) return;
          roomInfoRef.current = next;
          setRoomInfo(next);
          setRoomInfoDraft(next);
        };

        const announce = (peerId?: string) => {
          const options = peerId ? { target: peerId } : undefined;
          sendQuietly(presenceAction.send, { token: clientToken, joinedAt }, options);
          if (playerRef.current) sendQuietly(playerAction.send, playerRef.current, options);
          if (musicRef.current.trackId) sendQuietly(musicAction.send, musicRef.current, options);
          if (spotlightRef.current.updatedAt) sendQuietly(spotlightAction.send, spotlightRef.current, options);
          if (isHostRef.current && roomInfoRef.current.updatedAt) sendQuietly(roomInfoAction.send, roomInfoRef.current, options);
        };
        const greet = (peerId: string) => {
          announce(peerId);
          for (const delay of [700, 2000, 5000]) {
            const timer = window.setTimeout(() => announce(peerId), delay);
            greetTimers.add(timer);
          }
        };
        room.onPeerJoin = (peerId) => {
          const pending = pendingLeaves.get(peerId);
          if (pending) {
            window.clearTimeout(pending);
            pendingLeaves.delete(peerId);
          }
          greet(peerId);
        };
        room.onPeerLeave = (peerId) => {
          const timer = window.setTimeout(() => {
            pendingLeaves.delete(peerId);
            setPeers((current) => {
              if (!current[peerId]) return current;
              const next = { ...current };
              delete next[peerId];
              return next;
            });
          }, 2200);
          pendingLeaves.set(peerId, timer);
        };
        const pulseId = window.setInterval(() => announce(), 2000);
        pulse = pulseId;
        setConnection("connected");
        announce();
      })
      .catch(() => setConnection("error"));

    return () => {
      cancelled = true;
      window.clearInterval(pulse);
      for (const timer of greetTimers) window.clearTimeout(timer);
      for (const timer of pendingLeaves.values()) window.clearTimeout(timer);
      presenceSendRef.current = null;
      playerSendRef.current = null;
      wishSendRef.current = null;
      effectSendRef.current = null;
      musicSendRef.current = null;
      spotlightSendRef.current = null;
      roomInfoSendRef.current = null;
      leaveRoom?.();
    };
  }, [clientToken, config.appId, config.roomId, enqueueWish, joinedAt]);

  const syncAudio = useCallback(async () => {
    const audio = audioRef.current;
    const state = musicRef.current;
    if (!audio || !state.trackId) return;
    if (!state.isPlaying) {
      audio.pause();
      return;
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Math.max(0, (timestamp() - state.startedAt) / 1000) % audio.duration;
    try {
      await audio.play();
      setNeedsAudioConsent(false);
    } catch {
      setNeedsAudioConsent(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    const onReady = () => { void syncAudio(); };
    audio.addEventListener("loadedmetadata", onReady);
    void syncAudio();
    return () => audio.removeEventListener("loadedmetadata", onReady);
  }, [currentTrack, music.isPlaying, music.startedAt, syncAudio]);

  const setPlayerAction = useCallback((action: AvatarAction) => {
    setPlayer((current) => {
      if (!current) return current;
      const next = { ...current, action };
      playerRef.current = next;
      sendQuietly(playerSendRef.current, next);
      return next;
    });
  }, []);

  const triggerAction = useCallback((action: AvatarAction) => {
    setDanceAlong(false);
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    setPlayerAction(action);
    const cycles = action === "dance" ? 6 : action === "cheer" ? 3 : 2;
    const duration = action === "signature"
      ? Math.round(activeDanceProfile.speed * 2.4)
      : Math.round(BASE_ACTION_SPEEDS[action] * cycles + 120);
    actionTimerRef.current = window.setTimeout(() => setPlayerAction("idle"), duration);
  }, [activeDanceProfile.speed, setPlayerAction]);

  const triggerCelebration = () => {
    triggerAction("cheer");
    setConfetti((value) => value + 1);
    sendQuietly(effectSendRef.current, { type: "confetti", at: timestamp() });
  };

  const triggerToast = () => {
    triggerAction("toast");
    setBeerToast((value) => value + 1);
    sendQuietly(effectSendRef.current, { type: "toast", at: timestamp() });
  };

  useEffect(() => {
    if (!danceAlong || !music.isPlaying) return;
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    let timer = 0;
    let lastAction: AvatarAction = "idle";
    let phraseIndex = 0;
    const beatMs = 60000 / Math.min(180, Math.max(80, currentTrack?.bpm ?? 120));
    const nextMove = () => {
      const isSignaturePhrase = phraseIndex % 3 === 0;
      const choices = activeDanceProfile.moves.filter((action) => action !== lastAction);
      lastAction = isSignaturePhrase ? "signature" : choices[Math.floor(Math.random() * choices.length)] ?? "signature";
      setPlayerAction(lastAction);
      const phraseBeats = activeDanceProfile.beatPattern[phraseIndex % activeDanceProfile.beatPattern.length];
      phraseIndex += 1;
      timer = window.setTimeout(nextMove, beatMs * phraseBeats);
    };
    nextMove();
    return () => {
      window.clearTimeout(timer);
      setPlayerAction("idle");
    };
  }, [activeDanceProfile, currentTrack?.bpm, danceAlong, music.isPlaying, setPlayerAction]);

  useEffect(() => () => { if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current); }, []);

  const publishMusic = useCallback((next: MusicState) => {
    musicRef.current = next;
    setMusic(next);
    sendQuietly(musicSendRef.current, next);
  }, []);

  const playNextTrack = useCallback(() => {
    if (!isHostRef.current || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((track) => track.id === musicRef.current.trackId);
    const nextTrack = tracks[(currentIndex + 1 + tracks.length) % tracks.length];
    const now = timestamp();
    publishMusic({ trackId: nextTrack.id, isPlaying: true, startedAt: now, updatedAt: now });
  }, [publishMusic, tracks]);

  const publishSpotlight = (token: string) => {
    if (!isHost) return;
    const next = { token: spotlight.token === token ? "" : token, updatedAt: timestamp() };
    spotlightRef.current = next;
    setSpotlight(next);
    sendQuietly(spotlightSendRef.current, next);
  };

  const playTrack = (trackId: string) => {
    if (!isHost) return;
    const now = timestamp();
    publishMusic({ trackId, isPlaying: true, startedAt: now, updatedAt: now });
  };

  const toggleMusicPlayback = () => {
    if (!isHost || tracks.length === 0) return;
    if (!music.trackId) {
      playTrack(tracks[0].id);
      return;
    }
    const now = timestamp();
    if (music.isPlaying) publishMusic({ ...music, isPlaying: false, updatedAt: now });
    else publishMusic({ ...music, isPlaying: true, startedAt: now - (audioRef.current?.currentTime ?? 0) * 1000, updatedAt: now });
  };

  const toggleDanceAlong = () => {
    if (!music.isPlaying) {
      setToast("Chủ phòng chưa bật nhạc.");
      window.setTimeout(() => setToast(""), 2000);
      return;
    }
    setDanceAlong((value) => !value);
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    const name = safeText(setupName, 24);
    if (!name) return;
    if (usedAvatarIds.has(setupAvatarId) && profile?.avatarId !== setupAvatarId) {
      setToast("Nhân vật này đã có người chọn.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    const nextProfile: GuestProfile = { token: profile?.token ?? clientToken ?? randomId(), name, avatarId: setupAvatarId };
    localStorage.setItem(profileKey, JSON.stringify(nextProfile));
    const nextPlayer: PlayerState = {
      ...nextProfile,
      ...(player ? { x: player.x, y: player.y } : spawnFor(nextProfile.token)),
      joinedAt: player?.joinedAt ?? joinedAt,
      action: "idle",
    };
    setProfile(nextProfile);
    setPlayer(nextPlayer);
    playerRef.current = nextPlayer;
    setShowSetup(false);
    setToast(`Chào ${name}, vào tiệc thôi!`);
    window.setTimeout(() => setToast(""), 2200);
    sendQuietly(playerSendRef.current, nextPlayer);
  };

  const openProfile = () => {
    setSetupName(profile?.name ?? "");
    setSetupAvatarId(profile?.avatarId ?? "violet");
    setShowSetup(true);
  };

  const saveRoomInfo = (event: FormEvent) => {
    event.preventDefault();
    if (!isHost) return;
    const next: RoomInfo = {
      birthdayName: safeText(roomInfoDraft.birthdayName, 60),
      roomTitle: safeText(roomInfoDraft.roomTitle, 80),
      roomMessage: safeText(roomInfoDraft.roomMessage, 180),
      updatedAt: timestamp(),
    };
    if (!next.birthdayName || !next.roomTitle) return;
    roomInfoRef.current = next;
    setRoomInfo(next);
    localStorage.setItem(roomInfoKey, JSON.stringify(next));
    sendQuietly(roomInfoSendRef.current, next);
    setShowHostSettings(false);
    setToast("Đã cập nhật thông tin phòng.");
    window.setTimeout(() => setToast(""), 2200);
  };

  const sendWish = (event: FormEvent) => {
    event.preventDefault();
    const text = safeText(wishDraft, 160);
    if (!text || !profile) return;
    const wish: Wish = { id: randomId(), author: profile.name, text, createdAt: timestamp() };
    enqueueWish(wish);
    sendQuietly(wishSendRef.current, wish);
    setWishDraft("");
    triggerCelebration();
  };

  const shareRoom = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("host");
    const data = { title: roomInfo.roomTitle, text: `Vào phòng sinh nhật 2D cùng chúc mừng ${roomInfo.birthdayName} nhé!`, url: url.toString() };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        setToast("Đã sao chép link phòng!");
        window.setTimeout(() => setToast(""), 2200);
      }
    } catch {
      // Người dùng đóng bảng chia sẻ.
    }
  };

  return (
    <main className="minimal-app">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Playlist contains music only. */}
      <audio ref={audioRef} src={currentTrack ? encodeURI(currentTrack.src) : undefined} onEnded={playNextTrack} preload="auto" />
      <section className="minimal-game" aria-label="Phòng sinh nhật 2D. Dùng các nút trên màn hình để tương tác.">
        <div className="ambient-room" aria-hidden="true" />
        <div className="room-scene">
          <img className="room-art" src="/birthday-stage-sprite.webp" alt="" aria-hidden="true" />
          <div className="stage-cast">
            <div className={`party-stage ${stageStar ? "has-star" : ""}`} aria-label={stageStar ? stageStar.guest.name : "Đài"}>
              <span className="party-stage-glow" aria-hidden="true" />
              <div className="party-dais" aria-hidden="true" />
              {stageStar ? (
                <Avatar key={stageStar.guest.token} player={{ ...stageStar.guest, x: 50, y: 67 }} remote={stageStar.peerId !== "self"} host={stageStar.guest.token === electedHostToken} size={narrowFrame ? 118 : 156} order={20} />
              ) : null}
            </div>
            {floorPlayers.map(({ peerId, guest, slot, position }) => (
              <Avatar key={guest.token || peerId} player={{ ...guest, ...position }} remote={peerId !== "self"} host={guest.token === electedHostToken} size={playerSize} order={slot} />
            ))}
            {confetti > 0 ? <div className="firework-show" key={confetti} aria-hidden="true"><span className="firework-sprite" /></div> : null}
            {beerToast > 0 ? (
              <div className="beer-toast-show" key={beerToast} aria-hidden="true">
                <span className="beer-mug beer-mug-left">🍺</span>
                <span className="beer-mug beer-mug-right">🍺</span>
                {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
              </div>
            ) : null}
          </div>
        </div>

        <header className="game-hud">
          <div className="hud-title">
            <span className={`live-dot ${connection === "error" ? "is-error" : ""}`} />
            <span className="hud-room-icon" aria-hidden="true">🎂</span>
            <div><small>Mã phòng {config.roomId}</small><strong>{roomInfo.birthdayName}</strong></div>
          </div>
          <div className="now-playing" data-playing={music.isPlaying}>
            <span className="music-status" aria-hidden="true">{music.isPlaying ? "♫" : "♪"}</span>
            <div><small>{music.isPlaying ? "ĐANG PHÁT" : "ÂM NHẠC"}</small><span>{currentTrack?.title ?? "Chưa có nhạc"}</span></div>
          </div>
          <div className="hud-actions">
            <span className="hud-guests">👋 {1 + peerList.length}</span>
            {isHost ? <button className={`hud-icon ${showStagePicker ? "is-active" : ""}`} type="button" onClick={() => { setShowStagePicker((value) => !value); setShowMusic(false); setShowWishes(false); }} aria-label="Chọn người lên sân khấu">🎤</button> : null}
            {isHost ? <button className="hud-icon" type="button" onClick={() => setShowHostSettings(true)} aria-label="Cài đặt phòng">⚙️</button> : null}
            <button className="hud-profile" type="button" onClick={openProfile} aria-label="Đổi tên và nhân vật"><span>{isHost ? "👑" : "🙂"}</span><b>{profile?.name ?? "Hồ sơ"}</b></button>
            <button className="hud-share" type="button" onClick={shareRoom}><span>Chia sẻ</span><i>↗</i></button>
          </div>
        </header>

        {flyby ? (
          <div className="rocket-flyby" aria-live="polite">
            <div
              key={flyby.id}
              className="rocket-rig"
              style={{ "--fly-duration": `${Math.min(6.2, Math.max(5.2, 4.7 + flyby.text.length / 48))}s` } as CSSProperties}
              onAnimationEnd={(event) => {
                if (event.animationName !== "rocket-pass" || event.currentTarget !== event.target) return;
                setFlyby(null);
              }}
            >
              <img className="rocket-sprite-art" src="/rocket-banner-sprite-v2.webp" alt="" aria-hidden="true" />
              <span className="rocket-banner"><b>{flyby.author}:</b><span>{flyby.text}</span></span>
            </div>
          </div>
        ) : null}
        {wishes.length > 0 ? <div className="wish-queue-indicator" role="status" aria-live="polite"><span aria-hidden="true">⏳</span><b>{wishes.length}</b><small>đang chờ</small></div> : null}
        {playedWishes.length > 0 ? (
          <aside className="wish-history" aria-hidden="true">
            <div className="wish-history-track" style={{ "--wish-rise": `${Math.max(14, playedWishes.length * 4.5)}s` } as CSSProperties}>
              {Array.from({ length: 2 }, (_, copy) => (
                <div key={copy}>
                  {playedWishes.map((wish) => <article key={`${copy}-${wish.id}`}><b>{wish.author}</b><p>{wish.text}</p></article>)}
                </div>
              ))}
            </div>
          </aside>
        ) : null}
        <aside className="stage-invite" aria-label="Thông tin buổi tiệc">
          <div>
            <small>Thời gian</small>
            <strong>19:00 · 26/09/2026</strong>
            <a href="https://maps.app.goo.gl/GjUqGVosSWSXcZWE8?g_st=iz" target="_blank" rel="noreferrer">📍 Khè Beer</a>
          </div>
          <a className="stage-invite-qr" href="https://maps.app.goo.gl/GjUqGVosSWSXcZWE8?g_st=iz" target="_blank" rel="noreferrer" aria-label="Mở vị trí Khè Beer trên Google Maps">
            <img src="/khe-beer-map-qr.png" alt="Mã QR chỉ đường đến Khè Beer" />
          </a>
          <button type="button" onClick={() => setShowPhotoIntro(true)}>Mở thiệp mời</button>
        </aside>

        {needsAudioConsent && music.isPlaying ? <button className="audio-consent" type="button" onClick={() => void syncAudio()}>🔊 Bật nhạc</button> : null}

        <div className="action-dock" aria-label="Các hành động">
          <button type="button" onClick={() => triggerAction("wave")}><span>👋</span>Vẫy chào</button>
          <button type="button" onClick={() => triggerAction("jump")}><span>⬆️</span>Nhảy</button>
          <button type="button" title={`Điệu riêng: ${activeDanceProfile.label}`} aria-label={`Điệu riêng: ${activeDanceProfile.label}`} onClick={() => triggerAction("signature")}><span>🕺</span>Điệu riêng</button>
          <button type="button" onClick={() => triggerAction("bow")}><span>🙇</span>Cúi chào</button>
          <button type="button" onClick={triggerToast}><span>🍻</span>Nâng ly</button>
          <button type="button" onClick={triggerCelebration}><span>🎉</span>Tung hoa</button>
          <button className={danceAlong ? "is-active" : ""} type="button" onClick={toggleDanceAlong} aria-pressed={danceAlong}><span>💃</span>{danceAlong ? `Đang nhảy · ${activeDanceProfile.label}` : "Nhảy theo nhạc"}</button>
          <button className={showMusic ? "is-active" : ""} type="button" onClick={() => { setShowMusic((value) => !value); setShowWishes(false); setShowStagePicker(false); }}><span>🎵</span>Âm nhạc</button>
          <button className={showWishes ? "is-active" : ""} type="button" onClick={() => { setShowWishes((value) => !value); setShowMusic(false); setShowStagePicker(false); }}><span>💌</span>Lời chúc</button>
        </div>

        {showStagePicker && isHost ? (
          <aside className="music-popover">
            <div className="popover-title"><div><strong>Sân khấu</strong><small>Chọn một người đứng lên</small></div><button type="button" onClick={() => setShowStagePicker(false)} aria-label="Đóng">×</button></div>
            <div className="track-list">{placedPlayers.map(({ guest }) => (
              <button className={spotlight.token === guest.token ? "selected" : ""} type="button" key={guest.token} onClick={() => publishSpotlight(guest.token)}>
                <span>{spotlight.token === guest.token ? "★" : "🎤"}</span><div><b>{guest.name}</b><small>{guest.token === clientToken ? "Bạn" : "Khách"}</small></div><i>{spotlight.token === guest.token ? "↓" : "↑"}</i>
              </button>
            ))}</div>
            <button className="music-toggle" type="button" onClick={() => publishSpotlight("")} disabled={!spotlight.token}>Cho xuống sân khấu</button>
          </aside>
        ) : null}

        {showMusic ? (
          <aside className="music-popover">
            <div className="popover-title"><div><strong>Âm nhạc</strong><small>{isHost ? "Bạn đang điều khiển phòng" : "Do chủ phòng điều khiển"}</small></div><button type="button" onClick={() => setShowMusic(false)} aria-label="Đóng">×</button></div>
            {tracks.length ? <div className="track-list">{tracks.map((track, index) => (
              <button className={music.trackId === track.id ? "selected" : ""} type="button" key={track.id} onClick={() => isHost && playTrack(track.id)} disabled={!isHost}>
                <span>{music.trackId === track.id && music.isPlaying ? "▮▮" : String(index + 1).padStart(2, "0")}</span><div><b>{track.title}</b><small>{track.artist}</small></div>{isHost ? <i>▶</i> : null}
              </button>
            ))}</div> : <p className="empty-copy">Chưa có bài hát trong thư mục music.</p>}
            {isHost && tracks.length ? <button className="music-toggle" type="button" onClick={toggleMusicPlayback}>{music.isPlaying ? "Tạm dừng" : "Phát nhạc"}</button> : null}
            <label className="volume-control">Âm lượng<input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          </aside>
        ) : null}

        {showWishes ? (
          <aside className="wish-popover">
            <div className="wish-popover-title"><strong>Lời chúc</strong><button type="button" onClick={() => setShowWishes(false)} aria-label="Đóng">×</button></div>
            <form className="wish-form" onSubmit={sendWish}>
              <textarea value={wishDraft} onChange={(event) => setWishDraft(event.target.value)} maxLength={160} placeholder={`Chúc ${roomInfo.birthdayName}...`} aria-label="Nội dung lời chúc" />
              <button type="submit" disabled={!profile || !wishDraft.trim()}>Gửi lời chúc <span>→</span></button>
            </form>
            <div className="wish-queue-heading"><span>⏳ Hàng chờ</span><b>{wishes.length}</b></div>
            <div className="wish-list">{wishes.map((wish) => <article key={wish.id}><p>“{wish.text}”</p><span>— {wish.author}</span></article>)}{!wishes.length ? <p className="empty-copy">Hàng chờ đang trống. Lời chúc sẽ biến mất khi lên băng rôn.</p> : null}</div>
          </aside>
        ) : null}
      </section>

      {showHostSettings && isHost ? (
        <div className="setup-overlay" role="dialog" aria-modal="true" aria-labelledby="host-settings-title">
          <form className="setup-card host-settings-card" onSubmit={saveRoomInfo}>
            <span className="setup-kicker">CHỦ PHÒNG</span>
            <div className="host-settings-heading"><h2 id="host-settings-title">Thông tin buổi tiệc</h2><button type="button" onClick={() => setShowHostSettings(false)} aria-label="Đóng">×</button></div>
            <p>Người vào phòng đầu tiên được quyền cập nhật nội dung và điều khiển nhạc.</p>
            <label>Tên người được chúc<input value={roomInfoDraft.birthdayName} onChange={(event) => setRoomInfoDraft((current) => ({ ...current, birthdayName: event.target.value }))} maxLength={60} required /></label>
            <label>Tiêu đề phòng<input value={roomInfoDraft.roomTitle} onChange={(event) => setRoomInfoDraft((current) => ({ ...current, roomTitle: event.target.value }))} maxLength={80} required /></label>
            <label>Lời nhắn<textarea value={roomInfoDraft.roomMessage} onChange={(event) => setRoomInfoDraft((current) => ({ ...current, roomMessage: event.target.value }))} maxLength={180} /></label>
            <button className="enter-button" type="submit">Lưu cho cả phòng <span>→</span></button>
          </form>
        </div>
      ) : null}

      {showSetup ? (
        <div className="setup-overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
          <form className="setup-card avatar-setup-card" onSubmit={saveProfile}>
            <span className="setup-kicker">{profile ? (isHost ? "HỒ SƠ CHỦ PHÒNG" : "HỒ SƠ CỦA BẠN") : "VÀO PHÒNG"}</span>
            <h2 id="setup-title">{profile ? "Đổi tên & nhân vật" : "Chọn nhân vật"}</h2>
            <p>Nhập tên và chọn avatar còn trống. Mỗi nhân vật chỉ thuộc về một người.</p>
            <label>Tên của bạn<input value={setupName} onChange={(event) => setSetupName(event.target.value)} maxLength={24} placeholder="Ví dụ: Linh" required /></label>
            <fieldset><legend>20 avatar · 10 nam · 10 nữ</legend><div className="avatar-options">{AVATARS.map((avatar) => {
              const unavailable = usedAvatarIds.has(avatar.id) && profile?.avatarId !== avatar.id;
              return (
                <button className={`${setupAvatarId === avatar.id ? "selected" : ""} ${unavailable ? "unavailable" : ""}`} type="button" key={avatar.id} onClick={() => setSetupAvatarId(avatar.id)} disabled={unavailable} aria-label={unavailable ? `${avatar.label} đã được chọn` : `Chọn ${avatar.label}`}>
                  <span className="avatar-option-sprite" style={spriteStyle(avatar.id)} /><b>{avatar.label} · {DANCE_PROFILES[avatar.id].label}</b>{unavailable ? <small>Đã chọn</small> : null}
                </button>
              );
            })}</div></fieldset>
            <button className="enter-button" type="submit">{profile ? "Lưu thay đổi" : "Bắt đầu"} <span>→</span></button>
          </form>
        </div>
      ) : null}
      {showPhotoIntro ? (
        <section className="birthday-intro" role="dialog" aria-modal="true" aria-labelledby="birthday-intro-title">
          <div className="intro-card">
            <div className="intro-garland" aria-hidden="true">
              {Array.from({ length: 11 }, (_, index) => <i key={index} />)}
            </div>
            <div className="intro-copy">
              <span className="intro-kicker">✦ BỮA TIỆC DÀNH RIÊNG CHO BẠN ✦</span>
              <h1 id="birthday-intro-title">Happy<br />Birthday <em>{roomInfo.birthdayName}</em></h1>
              <p>{roomInfo.roomMessage || "Chúc bạn có một tuổi mới thật rực rỡ, nhiều tiếng cười và đầy ắp những khoảnh khắc đáng nhớ!"}</p>
              <div className="intro-invitation" aria-label="Thông tin buổi tiệc">
                <div className="intro-event-details">
                  <span><i aria-hidden="true">🕖</i><small>Thời gian</small><strong>19:00 · 26/09/2026</strong></span>
                  <a href="https://maps.app.goo.gl/GjUqGVosSWSXcZWE8?g_st=iz" target="_blank" rel="noreferrer">
                    <i aria-hidden="true">📍</i><small>Địa điểm</small><strong>Khè Beer</strong>
                  </a>
                </div>
                <a className="intro-map-qr" href="https://maps.app.goo.gl/GjUqGVosSWSXcZWE8?g_st=iz" target="_blank" rel="noreferrer" aria-label="Mở vị trí Khè Beer trên Google Maps">
                  <img src="/khe-beer-map-qr.png" alt="Mã QR chỉ đường đến Khè Beer" />
                  <span><b>Quét để xem đường đi</b><small>Google Maps ↗</small></span>
                </a>
              </div>
              <button type="button" onClick={() => setShowPhotoIntro(false)}>
                <span>🎉</span> Vào sân khấu sinh nhật <b>→</b>
              </button>
            </div>
            <div className="intro-photo-panel">
              <span className="intro-balloon balloon-one" aria-hidden="true">🎈</span>
              <span className="intro-balloon balloon-two" aria-hidden="true">🎈</span>
              <span className="intro-star star-one" aria-hidden="true">✦</span>
              <span className="intro-star star-two" aria-hidden="true">★</span>
              <div className="intro-photo-frame">
                <img src="/birthday-portrait.webp" alt={`${roomInfo.birthdayName} trong buổi tiệc sinh nhật`} />
                <div className="intro-photo-badge"><span>🎂</span><b>Make a wish!</b></div>
              </div>
              <div className="intro-gifts" aria-hidden="true">🎁 🎁</div>
            </div>
          </div>
        </section>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
