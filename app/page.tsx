import BirthdayRoom from "./BirthdayRoom";

export default function Home() {
  return (
    <BirthdayRoom
      config={{
        birthdayName: process.env.NEXT_PUBLIC_BIRTHDAY_NAME ?? "Trần Thế",
        roomTitle: process.env.NEXT_PUBLIC_ROOM_TITLE ?? "Tiệc sinh nhật tí hon",
        roomMessage:
          process.env.NEXT_PUBLIC_ROOM_MESSAGE ??
          "Một căn phòng nhỏ, thật nhiều niềm vui và những lời chúc chỉ dành riêng cho bạn.",
        roomId: process.env.NEXT_PUBLIC_ROOM_ID ?? "minh-anh-birthday-2026",
        appId: process.env.NEXT_PUBLIC_APP_ID ?? "happy-birthday-2d-v1",
        musicManifest: process.env.NEXT_PUBLIC_MUSIC_MANIFEST ?? "/music/playlist.json",
      }}
    />
  );
}
