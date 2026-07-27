import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PNN-LITTLE — Món quà dành cho người thương",
  description: "Một bất ngờ nhỏ với lời yêu thương, trái tim và những bức ảnh kỷ niệm.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
