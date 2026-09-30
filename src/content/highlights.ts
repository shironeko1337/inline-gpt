// Keeps the stored highlights of the current conversation, their live Ranges and CSS Custom Highlights in sync.

import { loadHighlights, saveHighlights } from '../shared/storage';
import type { HighlightedText, HighlightStyle } from '../shared/types';
import { isRangeValid, resolveRange } from './anchors';

const NAME_PREFIX = 'inline-chatgpt-';

/** Current spec returns HighlightHitResult ({ highlight, ranges }); early implementations returned Highlights. */
type HighlightHit = Highlight | { highlight: Highlight; ranges: AbstractRange[] };
type HighlightsFromPoint = (x: number, y: number) => HighlightHit[];

export class HighlightManager {
  private conversationKey = '';
  private items: HighlightedText[] = [];
  private ranges = new Map<string, Range>();
  private highlights = new Map<string, Highlight>();
  private styleEl = document.createElement('style');
  private style: HighlightStyle;

  constructor(style: HighlightStyle) {
    this.style = style;
    this.styleEl.dataset.inlineChatgpt = '';
    document.head.append(this.styleEl);
  }

  get key(): string {
    return this.conversationKey;
  }

  /** Switches to another conversation and loads its highlights. */
  async load(conversationKey: string): Promise<HighlightedText[]> {
    this.clearRegistry();
    this.conversationKey = conversationKey;
    const items = await loadHighlights(conversationKey);
    if (this.conversationKey !== conversationKey) return this.items; // switched again while loading
    this.items = items;
    this.reconcile();
    return this.items;
  }

  get(id: string): HighlightedText | undefined {
    return this.items.find((h) => h.id === id);
  }

  all(): HighlightedText[] {
    return this.items;
  }

  getRange(id: string): Range | undefined {
    return this.ranges.get(id);
  }

  async add(item: HighlightedText, range: Range): Promise<void> {
    this.items.push(item);
    this.register(item.id, range);
    this.renderStyles();
    await this.persist();
  }

  async update(item: HighlightedText): Promise<void> {
    const index = this.items.findIndex((h) => h.id === item.id);
    if (index < 0) return;
    this.items[index] = item;
    await this.persist();
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((h) => h.id !== id);
    this.unregister(id);
    this.renderStyles();
    await this.persist();
  }

  setStyle(style: HighlightStyle): void {
    this.style = style;
    this.renderStyles();
  }

  /** Re-resolves ranges that ChatGPT's re-rendering invalidated. Cheap when nothing changed. */
  reconcile(): void {
    let changed = false;
    for (const item of this.items) {
      const current = this.ranges.get(item.id);
      if (current && isRangeValid(current, item.text)) continue;
      const range = resolveRange(item);
      if (range) {
        this.register(item.id, range);
        changed = true;
      } else if (current) {
        this.unregister(item.id);
        changed = true;
      }
    }
    if (changed || this.styleEl.textContent === '') this.renderStyles();
  }

  /** Ids of the highlights under the point, newest first. */
  hitTest(x: number, y: number): string[] {
    const fromPoint = (CSS.highlights as unknown as { highlightsFromPoint?: HighlightsFromPoint }).highlightsFromPoint;
    let ids: string[];
    if (fromPoint) {
      const hitRanges = fromPoint
        .call(CSS.highlights, x, y)
        .flatMap((hit) => ('highlight' in hit ? [...hit.highlight] : [...hit]) as AbstractRange[]);
      ids = [...this.ranges].filter(([, range]) => hitRanges.some((r) => sameBoundaries(r, range))).map(([id]) => id);
    } else {
      ids = [...this.ranges].filter(([, range]) => rangeContainsPoint(range, x, y)).map(([id]) => id);
    }
    const createdAt = (id: string) => this.get(id)?.createdAt ?? 0;
    return ids.sort((a, b) => createdAt(b) - createdAt(a));
  }

  private register(id: string, range: Range): void {
    this.ranges.set(id, range);
    let highlight = this.highlights.get(id);
    if (highlight) {
      highlight.clear();
      highlight.add(range);
    } else {
      highlight = new Highlight(range);
      this.highlights.set(id, highlight);
      CSS.highlights.set(NAME_PREFIX + id, highlight);
    }
  }

  private unregister(id: string): void {
    this.highlights.delete(id);
    this.ranges.delete(id);
    CSS.highlights.delete(NAME_PREFIX + id);
  }

  private clearRegistry(): void {
    for (const id of [...this.highlights.keys()]) this.unregister(id);
    this.renderStyles();
  }

  private renderStyles(): void {
    const { backgroundColor, underline, opacity } = this.style;
    const declarations = `background-color: ${withAlpha(backgroundColor, opacity)};` +
      (underline ? ' text-decoration: underline; text-decoration-thickness: 2px;' : '');
    const selectors = [...this.highlights.keys()].map((id) => `::highlight(${NAME_PREFIX}${id})`);
    this.styleEl.textContent = selectors.length ? `${selectors.join(',\n')} { ${declarations} }` : ' ';
  }

  private async persist(): Promise<void> {
    await saveHighlights(this.conversationKey, this.items);
  }
}

function sameBoundaries(a: AbstractRange, b: AbstractRange): boolean {
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

function rangeContainsPoint(range: Range, x: number, y: number): boolean {
  for (const rect of range.getClientRects()) {
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
  }
  return false;
}

/** ::highlight() doesn't support `opacity`, so opacity is applied to the background color. */
function withAlpha(color: string, opacity: number): string {
  const hex = color.trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return color;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, opacity))})`;
}
