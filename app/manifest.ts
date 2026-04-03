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
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
