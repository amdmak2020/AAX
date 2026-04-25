import type { MetadataRoute } from "next";
import { brand } from "@/lib/app-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/pricing",
    "/faq",
    "/examples",
    "/contact",
    "/privacy",
    "/terms",
    "/signup",
    "/login"
  ];

  return routes.map((route, index) => ({
    url: `${brand.url}${route}`,
    lastModified: now,
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : index < 3 ? 0.8 : 0.6
  }));
}
