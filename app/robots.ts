import type { MetadataRoute } from "next";
import { brand } from "@/lib/app-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: `${brand.url}/sitemap.xml`,
    host: brand.url
  };
}
