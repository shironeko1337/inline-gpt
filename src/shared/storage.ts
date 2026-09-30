import { DEFAULT_OPTIONS, getTemplateId } from './defaults';
import type { HighlightedText, Options } from './types';

const OPTIONS_KEY = 'options';
const HIGHLIGHTS_PREFIX = 'highlights:';

export async function loadOptions(): Promise<Options> {
  const stored = (await chrome.storage.local.get(OPTIONS_KEY))[OPTIONS_KEY] as Partial<Options> | undefined;
  return mergeOptions(stored);
}

export function mergeOptions(stored: Partial<Options> | undefined): Options {
  return {
    ...DEFAULT_OPTIONS,
    ...stored,
    highlightStyle: { ...DEFAULT_OPTIONS.highlightStyle, ...stored?.highlightStyle },
    templates: (stored?.templates ?? DEFAULT_OPTIONS.templates).map((t) => ({ ...t, id: getTemplateId(t) })),
  };
}

export async function saveOptions(options: Options): Promise<void> {
  await chrome.storage.local.set({ [OPTIONS_KEY]: options });
}

export function onOptionsChanged(listener: (options: Options) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[OPTIONS_KEY]) {
      listener(mergeOptions(changes[OPTIONS_KEY].newValue as Partial<Options> | undefined));
    }
  });
}

/** Highlights are stored per ChatGPT conversation. */
export async function loadHighlights(conversationKey: string): Promise<HighlightedText[]> {
  const key = HIGHLIGHTS_PREFIX + conversationKey;
  return ((await chrome.storage.local.get(key))[key] as HighlightedText[] | undefined) ?? [];
}

export async function saveHighlights(conversationKey: string, highlights: HighlightedText[]): Promise<void> {
  const key = HIGHLIGHTS_PREFIX + conversationKey;
  if (highlights.length === 0) {
    await chrome.storage.local.remove(key);
  } else {
    await chrome.storage.local.set({ [key]: highlights });
  }
}

export interface StoredHighlight {
  conversationKey: string;
  highlight: HighlightedText;
}

/** Every saved highlight across all conversations, newest first. */
export async function loadAllHighlights(): Promise<StoredHighlight[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(HIGHLIGHTS_PREFIX))
    .flatMap(([key, value]) =>
      (value as HighlightedText[]).map((highlight) => ({ conversationKey: key.slice(HIGHLIGHTS_PREFIX.length), highlight })),
    )
    .sort((a, b) => b.highlight.createdAt - a.highlight.createdAt);
}

/** Fires when the stored highlights of a conversation are removed entirely (last one deleted, or storage cleared). */
export function onConversationHighlightsRemoved(listener: (conversationKey: string) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      if (key.startsWith(HIGHLIGHTS_PREFIX) && change.newValue === undefined) listener(key.slice(HIGHLIGHTS_PREFIX.length));
    }
  });
}

export function onHighlightsChanged(listener: () => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && Object.keys(changes).some((key) => key.startsWith(HIGHLIGHTS_PREFIX))) listener();
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/** Removes everything the extension stored: settings (including the API key) and all highlights. */
export async function clearAllStorage(): Promise<void> {
  await chrome.storage.local.clear();
}
