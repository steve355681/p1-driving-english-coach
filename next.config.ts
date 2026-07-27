import type { NextConfig } from "next";

/**
 * GitHub Pages can only serve static files, so the Pages build switches on a
 * static export. This is opt-in via `GITHUB_PAGES=true` rather than the default
 * so that local dev and any future server-backed deploy (Vercel) keep the full
 * Next.js feature set — route handlers included, which Phase 4 needs to mint
 * OpenAI ephemeral tokens without shipping the API key to the browser.
 */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

/** Project pages are served from `https://<user>.github.io/<repo>/`. */
const basePath = isGitHubPages ? "/p1-driving-english-coach" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isGitHubPages
    ? {
        output: "export",
        basePath,
        // Emit `route/index.html` instead of `route.html` — the safest shape
        // for a plain static host.
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
