import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { InstallPromptProvider } from "./components/InstallPromptProvider";
import { SwRegister } from "./components/SwRegister";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grinshaw",
  description: "Ihr persönlicher Butler. Ob Sie es wünschen oder nicht.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${playfair.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__grinshawInstallPrompt = e;
          });
        `}} />
      </head>
      <body className="h-full">
        <InstallPromptProvider>
          <SwRegister />
          {children}
        </InstallPromptProvider>
      </body>
    </html>
  );
}
