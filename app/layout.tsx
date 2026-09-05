import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PNN-LITTLE — Món quà dành cho người thương",
  description: "Một bất ngờ nhỏ với lời yêu thương, trái tim và những bức ảnh kỷ niệm.",
  metadataBase: new URL("https://pnn-little.pnn-little-nam.workers.dev"),
  applicationName: "PNN-LITTLE",
  keywords: ["PNN-LITTLE", "món quà online", "quà tặng người thương", "lời yêu thương"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: {
    type: "website", locale: "vi_VN", url: "/", siteName: "PNN-LITTLE",
    title: "PNN-LITTLE — Món quà dành cho người thương",
    description: "Tạo một bất ngờ nhỏ với lời yêu thương, ảnh kỷ niệm và món quà bí mật.",
  },
  twitter: { card: "summary", title: "PNN-LITTLE — Món quà dành cho người thương", description: "Tạo một bất ngờ nhỏ dành cho người bạn thương." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
