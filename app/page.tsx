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
        roomId: "KHEBEER",
        appId: "happy-birthday-khebeer",
        musicManifest: process.env.NEXT_PUBLIC_MUSIC_MANIFEST ?? "/music/playlist.json",
      }}
    />
  );
}
