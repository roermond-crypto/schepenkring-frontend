// Session-scoped translation cache keyed by `${lang}:${text}`.
// Survives React re-renders but resets on page reload (acceptable for task content).
const memCache = new Map<string, string>();

function cacheKey(text: string, lang: string) {
  return `${lang}:${text}`;
}

function fromCache(text: string, lang: string): string | undefined {
  return memCache.get(cacheKey(text, lang));
}

function toCache(text: string, lang: string, translation: string) {
  memCache.set(cacheKey(text, lang), translation);
  try {
    sessionStorage.setItem(`tx:${cacheKey(text, lang)}`, translation);
  } catch {
    // ignore quota errors
  }
}

function fromSessionStorage(text: string, lang: string): string | undefined {
  try {
    return sessionStorage.getItem(`tx:${cacheKey(text, lang)}`) ?? undefined;
  } catch {
    return undefined;
  }
}

// Returns texts from cache; returns undefined for unknown entries.
function lookupCache(texts: string[], lang: string): (string | undefined)[] {
  return texts.map((t) => {
    const mem = fromCache(t, lang);
    if (mem !== undefined) return mem;
    const ss = fromSessionStorage(t, lang);
    if (ss !== undefined) {
      memCache.set(cacheKey(t, lang), ss); // warm mem cache
      return ss;
    }
    return undefined;
  });
}

// Sends only uncached texts to the API route, then merges results.
export async function translateTexts(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  if (targetLang === "en") return texts;

  const cached = lookupCache(texts, targetLang);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  cached.forEach((v, i) => {
    if (v === undefined) {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  });

  if (uncachedTexts.length === 0) {
    return cached as string[];
  }

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: uncachedTexts, targetLang }),
    });

    if (res.ok) {
      const data = (await res.json()) as { translations: string[] };
      uncachedIndices.forEach((originalIdx, i) => {
        const translated = data.translations[i] ?? texts[originalIdx];
        cached[originalIdx] = translated;
        toCache(texts[originalIdx], targetLang, translated);
      });
    }
  } catch {
    // Network failure — fall back to originals
    uncachedIndices.forEach((idx) => {
      cached[idx] = texts[idx];
    });
  }

  return cached.map((v, i) => v ?? texts[i]);
}
