import type { Metadata } from "next";
import "./globals.css";

const birthdayName = process.env.NEXT_PUBLIC_BIRTHDAY_NAME ?? "Trần Thế";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: `Phòng sinh nhật của ${birthdayName}`,
  description: `Vào phòng tiệc 2D và cùng gửi lời chúc tới ${birthdayName}.`,
  openGraph: {
    title: `Cùng chúc mừng sinh nhật ${birthdayName}!`,
    description: "Tạo nhân vật 2D, gặp bạn bè và để lại một lời chúc thật vui.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Phòng sinh nhật 2D" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Cùng chúc mừng sinh nhật ${birthdayName}!`,
    description: "Tạo nhân vật 2D, gặp bạn bè và để lại một lời chúc thật vui.",
    images: ["/og.png"],
  },
};

const zaloBrowserGuard = `
  var zaloJSV2 = window.zaloJSV2 || function () { return null; };
  zaloJSV2.postMessage = zaloJSV2.postMessage || function () { return null; };
  window.zaloJSV2 = zaloJSV2;
  window.addEventListener("error", function (event) {
    if (String(event.message || "").indexOf("zaloJSV2") === -1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  function hideZaloOverlay() {
    document.querySelectorAll("vite-error-overlay").forEach(function (node) {
      var text = (node.shadowRoot && node.shadowRoot.textContent) || "";
      if (text.indexOf("zaloJSV2") !== -1) node.remove();
    });
  }
  new MutationObserver(hideZaloOverlay).observe(document.documentElement, { childList: true, subtree: true });
  hideZaloOverlay();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <script dangerouslySetInnerHTML={{ __html: zaloBrowserGuard }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
