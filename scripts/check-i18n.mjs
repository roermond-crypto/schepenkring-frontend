import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const localesDir = path.join(rootDir, "src", "locales");
const localeCodes = ["en", "de", "nl", "fr"];
const requiredSections = [
  "dashboard.header",
  "dashboard.sidebar",
  "DashboardYachts",
];

function readLocale(locale) {
  const filePath = path.join(localesDir, `${locale}.json`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getValue(source, dottedPath) {
  return dottedPath
    .split(".")
    .reduce(
      (value, segment) =>
        value && typeof value === "object" ? value[segment] : undefined,
      source,
    );
}

function flattenLeafPaths(source, prefix = "") {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(source).flatMap(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenLeafPaths(value, nextPrefix);
  });
}

const dictionaries = Object.fromEntries(
  localeCodes.map((locale) => [locale, readLocale(locale)]),
);

const baselineLeafPaths = requiredSections.flatMap((section) =>
  flattenLeafPaths(getValue(dictionaries.en, section), section),
);

const missingEntries = [];

for (const locale of localeCodes) {
  const dictionary = dictionaries[locale];

  for (const dottedPath of baselineLeafPaths) {
    const value = getValue(dictionary, dottedPath);
    if (typeof value !== "string" || value.trim().length === 0) {
      missingEntries.push(`${locale}: ${dottedPath}`);
    }
  }
}

if (missingEntries.length > 0) {
  console.error("I18N check failed. Missing or empty locale entries:");
  for (const entry of missingEntries) {
    console.error(`- ${entry}`);
  }
  process.exit(1);
}

console.log(
  `I18N check passed for ${localeCodes.length} locales across ${baselineLeafPaths.length} keys.`,
);
