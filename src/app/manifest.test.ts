import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, test, vi } from "vitest";

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

test("declares the install manifest and its public icons", async () => {
  const manifestFile = join(process.cwd(), "src/app/manifest.ts");
  expect(existsSync(manifestFile), "src/app/manifest.ts is missing").toBe(true);

  const { default: manifest } = await vi.importActual<{ default: () => typeof expectedManifest }>("./manifest");
  const metadata = manifest();

  expect(metadata).toEqual(expectedManifest);

  for (const icon of metadata.icons) {
    const repositoryPath = `public${icon.src}`;
    const publicFile = join(process.cwd(), repositoryPath);
    expect(existsSync(publicFile), `${icon.src} does not resolve to a committed public file`).toBe(true);
    expect(
      () => execFileSync("git", ["cat-file", "-e", `HEAD:${repositoryPath}`], { stdio: "ignore" }),
      `${icon.src} is not committed in HEAD`,
    ).not.toThrow();
  }
});
