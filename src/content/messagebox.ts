// The popup message box showing a side question and its answer. Rendered in a Shadow DOM so ChatGPT's CSS
// doesn't leak in. Only one box is open at a time.

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { CUSTOMIZED_QUESTION_ID, getTemplateId } from '../shared/defaults';
import type { HighlightedText } from '../shared/types';
import { isDarkMode } from './chatgptDom';

const GAP = 8;
const MARGIN = 8;

const ICONS = {
  trash:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

const STYLES = `
:host { all: initial; }
[hidden] { display: none !important; }
.box {
  --bg: #ffffff; --fg: #0d0d0d; --muted: #6b6b6b; --chip: #ececec; --border: rgba(0,0,0,.12); --code: #f4f4f4; --link: #2964aa;
  position: fixed; z-index: 2147483000; box-sizing: border-box; display: flex; flex-direction: column;
  min-width: 16rem; min-height: 6rem; max-width: min(40rem, calc(100vw - 16px)); max-height: 40rem;
  background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,.18); font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.box.dark { --bg: #2f2f2f; --fg: #ececec; --muted: #b4b4b4; --chip: #424242; --border: rgba(255,255,255,.14); --code: #1f1f1f; --link: #7ab7ff; }
.box.user-sized { max-width: none; max-height: none; }
.header { display: flex; align-items: center; gap: 6px; padding: 8px 8px 6px; flex: none; }
.question {
  flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  background: var(--chip); border-radius: 999px; padding: 3px 12px; font-size: 13px;
}
.question .ref { color: var(--muted); }
.box.asking { min-height: 0; }
.ask { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.ask input { all: unset; box-sizing: border-box; flex: none; width: 16rem; max-width: 60%; padding: 4px 10px; border-radius: 999px;
  background: var(--chip); border: 1px solid transparent; color: var(--fg); font-size: 13px; cursor: text; }
.ask input::placeholder { color: var(--muted); }
.ask input:focus { border-color: var(--border); }
.ask.invalid input { border-color: #d93025; }
.ask .ref { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--muted); font-size: 13px; }
button.icon {
  all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 28px; height: 28px; border-radius: 8px; color: var(--muted); cursor: pointer;
}
button.icon:hover { background: var(--chip); color: var(--fg); }
.body { flex: 1; overflow: auto; padding: 4px 14px 14px; user-select: text; cursor: text; }
.body > :first-child { margin-top: 0; }
.body > :last-child { margin-bottom: 0; }
.body p, .body ul, .body ol, .body pre, .body blockquote { margin: 0 0 .6em; }
.body ul, .body ol { padding-left: 1.4em; }
.body a { color: var(--link); }
.body code { background: var(--code); border-radius: 4px; padding: 1px 4px; font: 12.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.body pre { background: var(--code); border-radius: 8px; padding: 10px; overflow: auto; }
.body pre code { padding: 0; background: none; }
.body blockquote { border-left: 3px solid var(--border); padding-left: 10px; color: var(--muted); }
.status { display: flex; align-items: center; gap: 8px; color: var(--muted); }
.spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--fg); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error { color: #d93025; white-space: pre-wrap; }
.box.dark .error { color: #ff7b72; }
button.link { all: unset; color: var(--link); cursor: pointer; text-decoration: underline; margin-top: 6px; display: inline-block; }
.resize { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--border) 50%, var(--border) 60%, transparent 60%, transparent 75%, var(--border) 75%, var(--border) 85%, transparent 85%);
  border-bottom-right-radius: 12px; }
`;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
});

export interface MessageBoxHandlers {
  onDelete(id: string): void;
  onRetry(id: string): void;
  /** The user typed the question of an "Other questions..." box. */
  onAsk(id: string, question: string): void;
}

/** Key events typed in the question input must not reach ChatGPT's page handlers (e.g. "type to focus composer"). */
const ISOLATED_EVENTS = ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'paste', 'copy', 'cut'];

export class MessageBox {
  private host = document.createElement('inline-chatgpt-messagebox');
  private box: HTMLDivElement;
  private questionEl: HTMLSpanElement;
  private bodyEl: HTMLDivElement;
  private copyBtn: HTMLButtonElement;
  private askEl: HTMLDivElement;
  private askInput: HTMLInputElement;
  private askRef: HTMLSpanElement;
  private item: HighlightedText | null = null;
  private getRange: () => Range | undefined = () => undefined;
  private frame = 0;

  constructor(private handlers: MessageBoxHandlers) {
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="box" role="dialog" hidden>
        <div class="header">
          <button class="icon" data-action="delete" title="Delete">${ICONS.trash}</button>
          <span class="question"></span>
          <div class="ask" hidden>
            <input type="text" placeholder="Type your question…" aria-label="Your question" />
            <span class="ref"></span>
            <button class="icon" data-action="ask" title="Ask" aria-label="Ask">${ICONS.arrow}</button>
          </div>
          <button class="icon" data-action="copy" title="Copy answer">${ICONS.copy}</button>
          <button class="icon" data-action="close" title="Close">${ICONS.close}</button>
        </div>
        <div class="body"></div>
        <div class="resize"></div>
      </div>`;
    this.box = shadow.querySelector('.box')!;
    this.questionEl = shadow.querySelector('.question')!;
    this.bodyEl = shadow.querySelector('.body')!;
    this.copyBtn = shadow.querySelector('[data-action="copy"]')!;
    this.askEl = shadow.querySelector('.ask')!;
    this.askInput = shadow.querySelector('.ask input')!;
    this.askRef = shadow.querySelector('.ask .ref')!;

    for (const type of ISOLATED_EVENTS) this.host.addEventListener(type, (e) => e.stopPropagation());
    this.askInput.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitQuestion();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
    this.askInput.addEventListener('input', () => this.askEl.classList.remove('invalid'));

    shadow.addEventListener('click', (e) => this.onClick(e));
    this.setupResize(shadow.querySelector('.resize')!);
    document.documentElement.append(this.host);

    const reposition = () => this.schedulePosition();
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition);
  }

  get currentId(): string | null {
    return this.item?.id ?? null;
  }

  /** Whether the event happened inside the message box. */
  contains(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  open(item: HighlightedText, getRange: () => Range | undefined): void {
    const switching = this.item?.id !== item.id;
    this.item = item;
    this.getRange = getRange;
    if (switching) {
      this.askInput.value = '';
      this.askEl.classList.remove('invalid');
      this.box.classList.remove('user-sized');
      this.box.style.width = '';
      this.box.style.height = '';
    }
    this.box.classList.toggle('dark', isDarkMode());
    this.box.hidden = false;
    this.render();
    this.position();
    if (isUnasked(item)) this.askInput.focus();
  }

  /** Re-renders if `item` is the one being shown. */
  update(item: HighlightedText): void {
    if (this.item?.id !== item.id) return;
    this.item = item;
    this.render();
    this.position();
  }

  close(): void {
    this.item = null;
    this.box.hidden = true;
  }

  private render(): void {
    const item = this.item!;
    const { request, response } = item.messagebox;
    const asking = isUnasked(item);
    this.box.classList.toggle('asking', asking);
    this.askEl.hidden = !asking;
    this.questionEl.hidden = asking;
    this.bodyEl.hidden = asking;
    if (asking) {
      this.askRef.textContent = `“${request.referencedText}”`;
      this.askRef.title = request.referencedText;
      this.copyBtn.hidden = true;
      return;
    }

    this.questionEl.replaceChildren(
      document.createTextNode(`${request.template.templateText} `),
      Object.assign(document.createElement('span'), { className: 'ref', textContent: `“${request.referencedText}”` }),
    );
    this.questionEl.title = `${request.template.templateText} “${request.referencedText}”`;
    this.copyBtn.hidden = response.status !== 'fulfilled';

    if (response.status === 'pending') {
      this.bodyEl.innerHTML = '<div class="status"><div class="spinner"></div>Thinking…</div>';
    } else if (response.status === 'error') {
      const error = Object.assign(document.createElement('div'), { className: 'error', textContent: response.content });
      const retry = Object.assign(document.createElement('button'), { className: 'link', textContent: 'Retry' });
      retry.dataset.action = 'retry';
      this.bodyEl.replaceChildren(error, retry);
    } else {
      const html = marked.parse(response.content, { async: false });
      this.bodyEl.innerHTML = DOMPurify.sanitize(html);
    }
  }

  private onClick(e: Event): void {
    const action = (e.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
    const item = this.item;
    if (!action || !item) return;
    if (action === 'close') this.close();
    else if (action === 'delete') this.handlers.onDelete(item.id);
    else if (action === 'retry') this.handlers.onRetry(item.id);
    else if (action === 'copy') void this.copy(item.messagebox.response.content);
    else if (action === 'ask') this.submitQuestion();
  }

  private submitQuestion(): void {
    const question = this.askInput.value.trim();
    if (!this.item || !question) {
      this.askEl.classList.add('invalid');
      this.askInput.focus();
      return;
    }
    this.handlers.onAsk(this.item.id, question);
  }

  private async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    this.copyBtn.innerHTML = ICONS.check;
    setTimeout(() => (this.copyBtn.innerHTML = ICONS.copy), 1200);
  }

  private schedulePosition(): void {
    if (!this.item || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.position();
    });
  }

  /** Below the highlight if it fits, otherwise above, otherwise wherever there is more room. */
  private position(): void {
    const range = this.item ? this.getRange() : undefined;
    const rects = range ? Array.from(range.getClientRects()) : [];
    if (rects.length === 0) return;
    const first = rects[0];
    const last = rects[rects.length - 1];
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const userSized = this.box.classList.contains('user-sized');

    if (!userSized) this.box.style.maxHeight = '';
    const height = this.box.offsetHeight;
    const width = this.box.offsetWidth;
    const spaceBelow = vh - last.bottom - GAP - MARGIN;
    const spaceAbove = first.top - GAP - MARGIN;
    const below = height <= spaceBelow || spaceBelow >= spaceAbove;
    if (!userSized) {
      const available = Math.max(below ? spaceBelow : spaceAbove, 96);
      if (height > available) this.box.style.maxHeight = `${available}px`;
    }
    const finalHeight = this.box.offsetHeight;
    const top = below ? last.bottom + GAP : first.top - GAP - finalHeight;
    const anchorLeft = below ? last.left : first.left;
    const left = Math.min(Math.max(anchorLeft, MARGIN), Math.max(MARGIN, vw - width - MARGIN));
    this.box.style.top = `${Math.round(top)}px`;
    this.box.style.left = `${Math.round(left)}px`;
  }

  private setupResize(handle: HTMLElement): void {
    handle.addEventListener('pointerdown', (down) => {
      down.preventDefault();
      const rect = this.box.getBoundingClientRect();
      handle.setPointerCapture(down.pointerId);
      this.box.classList.add('user-sized');
      this.box.style.maxHeight = '';
      const move = (e: PointerEvent) => {
        this.box.style.width = `${Math.max(256, rect.width + e.clientX - down.clientX)}px`;
        this.box.style.height = `${Math.max(96, rect.height + e.clientY - down.clientY)}px`;
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }
}

/** An "Other questions..." box whose question hasn't been typed yet. */
export function isUnasked(item: HighlightedText): boolean {
  return getTemplateId(item.messagebox.request.template) === CUSTOMIZED_QUESTION_ID;
}
