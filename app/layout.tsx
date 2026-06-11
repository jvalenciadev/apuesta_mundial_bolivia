import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Polla Mundial 2026 | Apuestas de Grupos en Vivo",
  description: "Crea tu grupo con un código secreto y compite en tiempo real pronosticando los resultados de la Copa Mundial de Fútbol 2026. Conversión automática a Hora de Bolivia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#090d16] text-[#f1f5f9]">
        {children}
      </body>
    </html>
  );
}

