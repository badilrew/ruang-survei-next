import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RuangSurvei",
  description: "Kelola survei dan pahami respons dalam satu ruang kerja.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
