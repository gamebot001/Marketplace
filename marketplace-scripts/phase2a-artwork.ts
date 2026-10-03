/**
 * PHASE 2A — artwork ingestion + metadata generation pipeline.
 *
 * Discovers the user's real artwork under ARTWORK_ROOT, normalizes collection
 * slugs and NFT names, copies each file into the backend's served artwork
 * directory, and writes generated metadata + a manifest that the mint script
 * consumes. The original artwork directory is never modified.
 *
 * Run (dry validation with no writes):
 *   npx tsx phase2a-artwork.ts --check
 * Run (copy + generate manifest):
 *   npx tsx phase2a-artwork.ts
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ARTWORK_ROOT =
  process.env.ZECIANS_ARTWORK_ROOT ||
  resolve(homedir(), "Desktop", "collections");

const BACKEND_DATA_DIR = resolve(__dirname, "..", "marketplace_backend", "data");
const ARTWORK_OUT_DIR = join(BACKEND_DATA_DIR, "artwork");
const METADATA_OUT_DIR = join(BACKEND_DATA_DIR, "metadata", "phase2a");
export const MANIFEST_PATH = resolve(__dirname, ".keys", "phase2a-artwork-manifest.json");

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"];

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

const MAGIC: Record<string, number[]> = {
  ".png": [0x89, 0x50, 0x4e, 0x47],
  ".jpg": [0xff, 0xd8, 0xff],
  ".jpeg": [0xff, 0xd8, 0xff],
  ".gif": [0x47, 0x49, 0x46],
  ".webp": [0x52, 0x49, 0x46, 0x46],
};

export interface DiscoveredAsset {
  index: number;
  name: string;
  source: string;
  stored: string; // relative path under backend data dir
  artwork_path: string; // absolute path the backend serves
  mime_type: string;
  metadata: AssetMetadata;
}

export interface DiscoveredCollection {
  slug: string;
  name: string;
  directory: string;
  pfp: {
    source: string;
    stored: string;
    artwork_path: string;
    mime_type: string;
  };
  assets: DiscoveredAsset[];
  metadata: CollectionMetadata;
}

interface AssetMetadata {
  name: string;
  description: string;
  image: string;
  attributes: never[];
}

interface CollectionMetadata {
  name: string;
  description: string;
  image: string;
  symbol: string;
  external_url: string;
  attributes: never[];
}

export function normalizeSlug(value: string): string {
  const slug = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Could not normalize a valid slug from ${JSON.stringify(value)}`);
  }
  return slug;
}

function isImageExtension(file: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extname(file).toLowerCase());
}

function isPfp(file: string): boolean {
  return basename(file, extname(file)).toLowerCase() === "pfp";
}

function assertReadableImage(path: string, ext: string): void {
  const stats = statSync(path);
  if (!stats.isFile() || stats.size === 0) {
    throw new Error(`${path} is not a readable, non-empty file`);
  }
  const expected = MAGIC[ext.toLowerCase()];
  if (!expected) return; // svg/avif are validated by extension + parsers downstream
  const head = readFileSync(path).subarray(0, expected.length);
  const matches = expected.every((byte, i) => head[i] === byte);
  if (!matches) {
    throw new Error(`${path} does not look like a valid ${ext} image`);
  }
}

/** Trailing number in a filename ("Dog #3" -> 3), else fallback order index. */
function trailingNumber(file: string, fallback: number): number {
  const match = basename(file, extname(file)).match(/#\s*(\d+)\s*$/);
  if (match) return parseInt(match[1], 10);
  const loose = basename(file, extname(file)).match(/(\d+)/);
  return loose ? parseInt(loose[1], 10) : fallback;
}

export function discoverCollections(root: string): DiscoveredCollection[] {
  if (!existsSync(root)) {
    throw new Error(`ARTWORK_ROOT does not exist: ${root}`);
  }
  const entries = readdirSync(root)
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(join(root, name)).isDirectory())
    .sort((a, b) => a.localeCompare(b));

  if (entries.length === 0) {
    throw new Error(`No collection directories found under ${root}`);
  }

  const seenSlugs = new Set<string>();
  const collections: DiscoveredCollection[] = [];

  for (const dirName of entries) {
    const directory = join(root, dirName);
    const files = readdirSync(directory)
      .filter((name) => !name.startsWith("."))
      .filter((name) => isImageExtension(name))
      .sort((a, b) => trailingNumber(a, 0) - trailingNumber(b, 0));

    const slug = normalizeSlug(dirName);
    if (seenSlugs.has(slug)) {
      throw new Error(`Duplicate normalized collection slug: ${slug}`);
    }
    seenSlugs.add(slug);

    const pfpFile = files.find(isPfp);
    if (!pfpFile) {
      throw new Error(`Collection ${dirName} has no pfp.<ext> image`);
    }
    const nftFiles = files.filter((file) => !isPfp(file));
    if (nftFiles.length === 0) {
      throw new Error(`Collection ${dirName} has no NFT artwork files`);
    }

    const pfpSource = join(directory, pfpFile);
    assertReadableImage(pfpSource, extname(pfpFile));

    const pfpStored = join(slug, `pfp${extname(pfpFile).toLowerCase()}`);
    const assets: DiscoveredAsset[] = [];

    nftFiles.forEach((file, order) => {
      const source = join(directory, file);
      const ext = extname(file).toLowerCase();
      assertReadableImage(source, ext);
      const index = trailingNumber(file, order + 1);
      const name = `${dirName} #${index}`;
      const stored = join(slug, `${index}${ext}`);
      assets.push({
        index,
        name,
        source,
        stored,
        artwork_path: join(ARTWORK_OUT_DIR, stored),
        mime_type: MIME_BY_EXTENSION[ext] || "application/octet-stream",
        metadata: {
          name,
          description: `${name} — a ${dirName} collectible on the Zecians Marketplace.`,
          image: "",
          attributes: [],
        },
      });
    });

    collections.push({
      slug,
      name: dirName,
      directory,
      pfp: {
        source: pfpSource,
        stored: pfpStored,
        artwork_path: join(ARTWORK_OUT_DIR, pfpStored),
        mime_type: MIME_BY_EXTENSION[extname(pfpFile).toLowerCase()] || "image/jpeg",
      },
      assets,
      metadata: {
        name: dirName,
        description:
          `${dirName} — a custom Solana Devnet test collection created for the ` +
          "Zecians Marketplace. Not affiliated with any existing collection.",
        image: "",
        symbol: dirName.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase(),
        external_url: "",
        attributes: [],
      },
    });
  }

  return collections;
}

export interface ArtworkManifest {
  root: string;
  generated_at: string;
  collections: DiscoveredCollection[];
}

export function buildManifest(root: string = ARTWORK_ROOT): ArtworkManifest {
  return {
    root,
    generated_at: new Date().toISOString(),
    collections: discoverCollections(root),
  };
}

function materialize(manifest: ArtworkManifest) {
  for (const collection of manifest.collections) {
    const dir = join(ARTWORK_OUT_DIR, collection.slug);
    mkdirSync(dir, { recursive: true });
    copyFileSync(collection.pfp.source, collection.pfp.artwork_path);
    for (const asset of collection.assets) {
      copyFileSync(asset.source, asset.artwork_path);
    }
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  mkdirSync(METADATA_OUT_DIR, { recursive: true });
  for (const collection of manifest.collections) {
    writeFileSync(
      join(METADATA_OUT_DIR, `${collection.slug}.collection.json`),
      JSON.stringify(collection.metadata, null, 2)
    );
    for (const asset of collection.assets) {
      writeFileSync(
        join(METADATA_OUT_DIR, `${collection.slug}-${asset.index}.json`),
        JSON.stringify(asset.metadata, null, 2)
      );
    }
  }
}

function printManifest(manifest: ArtworkManifest) {
  console.log(`ARTWORK_ROOT: ${manifest.root}`);
  console.log(`Collections: ${manifest.collections.length}`);
  let total = 0;
  for (const collection of manifest.collections) {
    console.log(
      `  • ${collection.name} (${collection.slug}) — pfp ${basename(
        collection.pfp.source
      )}, ${collection.assets.length} NFT artworks`
    );
    for (const asset of collection.assets) {
      console.log(`      - ${asset.name}  [${asset.mime_type}]  ${basename(asset.source)}`);
      total += 1;
    }
  }
  console.log(`Total NFT artworks: ${total}`);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const manifest = buildManifest();
  printManifest(manifest);

  if (checkOnly) {
    console.log("\nValidation passed (dry run — no files copied).");
    return;
  }
  materialize(manifest);
  console.log(`\nWrote artwork + metadata under ${ARTWORK_OUT_DIR}`);
  console.log(`Wrote manifest ${MANIFEST_PATH}`);
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
