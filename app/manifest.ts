import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grinshaw",
    short_name: "Grinshaw",
    description: "Ihr Butler. Widerwillig, aber pflichtbewusst.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a2e20",
    theme_color: "#1a2e20",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
