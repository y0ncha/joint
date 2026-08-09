import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import manifest from "./manifest";

const expectedManifest = {
  name: "Joint",
  short_name: "Joint",
  description: "A shared household money workspace.",
  start_url: "/",
  display: "standalone",
  background_color: "#f6d4b8",
  theme_color: "#f6d4b8",
  icons: [
    { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png" },
    { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png" },
  ],
} as const;

test("declares the install manifest and its public icons", () => {
  const metadata = manifest();

  expect(metadata).toEqual(expectedManifest);

  for (const icon of metadata.icons ?? []) {
    const repositoryPath = `public${icon.src}`;
    const publicFile = join(process.cwd(), repositoryPath);
    expect(existsSync(publicFile), `${icon.src} does not resolve to a committed public file`).toBe(true);
  }
});
