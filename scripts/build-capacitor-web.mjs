import { access, cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "www");
const pages = [
    "index.html",
    "lung.html",
    "followup.html",
    "lab.html",
    "record.html",
    "study.html"
];
const directories = new Map([
    ["assets", new Set([".png", ".svg", ".webp", ".jpg", ".jpeg"])],
    ["css", new Set([".css"])],
    ["data", new Set([".json"])],
    ["js", new Set([".js"])]
]);

for (const page of pages) {
    try {
        await access(join(root, page));
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(`Required Capacitor page is missing: ${page}`, { cause: error });
        }
        throw error;
    }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const page of pages) {
    await cp(join(root, page), join(output, page));
}

for (const [directory, allowedExtensions] of directories) {
    const source = join(root, directory);
    const destination = join(output, directory);
    await mkdir(destination, { recursive: true });
    await copyAllowedFiles(source, destination, allowedExtensions);
}

async function copyAllowedFiles(source, destination, allowedExtensions) {
    for (const entry of await readdir(source, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) {
            continue;
        }

        const sourcePath = join(source, entry.name);
        const destinationPath = join(destination, entry.name);
        if (entry.isDirectory()) {
            await mkdir(destinationPath, { recursive: true });
            await copyAllowedFiles(sourcePath, destinationPath, allowedExtensions);
        } else if (entry.isFile() && allowedExtensions.has(extname(entry.name).toLowerCase())) {
            await cp(sourcePath, destinationPath);
        }
    }
}

console.log(`Capacitor web assets built at ${output}`);
