import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GF-CARE - Deteksi Dini Glaukoma",
  description: "Sistem skrining dan analisis citra fundus untuk indikasi glaukoma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-gray-50 text-gray-800 flex flex-col font-sans">
        {children}
        <footer className="mt-auto py-6 text-center text-sm text-gray-500 bg-white border-t">
          <div className="max-w-4xl mx-auto px-4">
            <p className="font-semibold text-gray-600 mb-1">Peringatan Medis / Medical Disclaimer</p>
            <p>
              GF-CARE adalah alat penelitian untuk segmentasi citra fundus. 
              Sistem ini <strong>BUKAN</strong> merupakan sistem diagnosis medis. 
              Harap konsultasikan dengan dokter spesialis mata (Oftalmologis) untuk diagnosis klinis yang definitif.
            </p>
            <p className="mt-2 text-xs text-gray-400">&copy; {new Date().getFullYear()} GF-CARE Project</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
