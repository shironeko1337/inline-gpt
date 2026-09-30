// Shows the question templates when text inside a single assistant answer is selected: injected below ChatGPT's
// own "Ask ChatGPT" button, or in a small floating bar of our own if that button can't be found.

import { debug } from '../shared/debug';
import { OTHER_QUESTIONS_TEMPLATE } from '../shared/defaults';
import type { Options, QuestionTemplate } from '../shared/types';
import { describeAskButtonCandidates, findAskChatGPTButton, findMessageElement, getMessageId, isAssistantMessage, isDarkMode } from './chatgptDom';

/** How long to wait for ChatGPT's "Ask ChatGPT" popup before showing the fallback bar. */
const ASK_BUTTON_TIMEOUT = 400;
const TEMPLATE_ATTR = 'data-icg-template';

export interface SelectionInfo {
  range: Range;
  messageEl: HTMLElement;
  messageId: string;
  /** range.toString(): raw DOM text, used to verify the highlight when restoring it. */
  text: string;
  /** What the user sees as selected (skips hidden duplicates such as KaTeX's MathML); sent in the prompt. */
  referencedText: string;
}

export type TemplateHandler = (template: QuestionTemplate, selection: SelectionInfo) => void;

export class SelectionMenu {
  private selection: SelectionInfo | null = null;
  private observer = new MutationObserver(() => this.scheduleInject());
  private injectFrame = 0;
  private fallbackTimer = 0;
  /** First injected button; while it is still on the page nothing needs to be done on DOM changes. */
  private injected: HTMLElement | null = null;
  private fallback = new FallbackBar((template) => this.choose(template));

  constructor(
    private getOptions: () => Pick<Options, 'templates' | 'showOtherQuestions'>,
    private onTemplate: TemplateHandler,
  ) {
    document.addEventListener('mouseup', () => setTimeout(() => this.onSelectionEnd()));
    document.addEventListener('keyup', (e) => {
      if (e.shiftKey || e.key === 'Shift') setTimeout(() => this.onSelectionEnd());
    });
    document.addEventListener('selectionchange', () => {
      if (!this.selection) return;
      const sel = getSelection();
      if (!sel || sel.isCollapsed) this.reset();
    });
  }

  /** Configured templates plus "Other questions..." at the end when enabled. */
  private menuTemplates(): QuestionTemplate[] {
    const { templates, showOtherQuestions } = this.getOptions();
    return showOtherQuestions ? [...templates, OTHER_QUESTIONS_TEMPLATE] : templates;
  }

  private onSelectionEnd(): void {
    const info = readSelection();
    if (!info || this.menuTemplates().length === 0) {
      if (info) debug('No question templates configured; menu disabled');
      this.reset();
      return;
    }
    this.reset();
    this.selection = info;
    debug('Selection accepted', { messageId: info.messageId, text: info.text });
    this.observer.observe(document.body, { childList: true, subtree: true });
    if (!this.inject()) {
      debug(`"Ask ChatGPT" button not found yet, waiting ${ASK_BUTTON_TIMEOUT}ms`);
      this.fallbackTimer = window.setTimeout(() => {
        if (this.selection && !this.inject()) {
          debug('"Ask ChatGPT" button still not found, showing fallback bar. Candidates:', describeAskButtonCandidates());
          this.fallback.show(this.menuTemplates(), info.range);
          this.observer.disconnect(); // stop watching the page once our own bar is shown
        }
      }, ASK_BUTTON_TIMEOUT);
    }
  }

  private scheduleInject(): void {
    // ChatGPT mutates the DOM constantly; keep this callback cheap.
    if (this.injectFrame || this.injected?.isConnected) return;
    this.injectFrame = requestAnimationFrame(() => {
      this.injectFrame = 0;
      if (this.selection && this.inject()) this.fallback.hide();
    });
  }

  /** Adds the template buttons below "Ask ChatGPT". Returns false if the button isn't on the page. */
  private inject(): boolean {
    if (this.injected?.isConnected) return true;
    const askButton = findAskChatGPTButton();
    const parent = askButton?.parentElement;
    if (!askButton || !parent) return false;
    clearTimeout(this.fallbackTimer);
    debug('Found "Ask ChatGPT" button, injecting templates', { button: askButton });

    const style = getComputedStyle(parent);
    if (style.display.includes('flex') && style.flexDirection.startsWith('row')) {
      parent.style.flexDirection = 'column';
      parent.style.alignItems = 'stretch';
    }

    let after: Element = askButton;
    for (const template of this.menuTemplates()) {
      const button = cloneAsTemplateButton(askButton, template);
      button.addEventListener('pointerdown', stop);
      button.addEventListener('mousedown', stop);
      button.addEventListener('click', (e) => {
        stop(e);
        this.choose(template);
      });
      after.after(button);
      after = button;
      this.injected ??= button;
    }
    return true;
  }

  private choose(template: QuestionTemplate): void {
    const selection = this.selection;
    if (!selection) return;
    this.reset();
    getSelection()?.removeAllRanges();
    this.onTemplate(template, selection);
  }

  private reset(): void {
    if (this.selection) debug('Selection cleared, removing menu');
    this.selection = null;
    this.observer.disconnect();
    cancelAnimationFrame(this.injectFrame);
    this.injectFrame = 0;
    clearTimeout(this.fallbackTimer);
    this.fallback.hide();
    this.injected = null;
    document.querySelectorAll(`[${TEMPLATE_ATTR}]`).forEach((el) => el.remove());
  }
}

function stop(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * A selection is usable only inside a single assistant answer. Looking the message up from the common ancestor
 * covers that: a selection spanning two answers has its common ancestor above both, so no message is found.
 */
function readSelection(): SelectionInfo | null {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const messageEl = findMessageElement(range.commonAncestorContainer);
  if (!messageEl || !isAssistantMessage(messageEl)) {
    debug('Selection ignored: not inside a single assistant answer', {
      commonAncestor: range.commonAncestorContainer,
      message: messageEl,
    });
    return null;
  }
  const text = range.toString();
  if (!text.trim()) return null;
  const referencedText = sel.toString().trim() || text.trim();
  return { range: range.cloneRange(), messageEl, messageId: getMessageId(messageEl), text, referencedText };
}

/** Copies ChatGPT's button so ours look the same, then swaps the label. */
function cloneAsTemplateButton(source: HTMLElement, template: QuestionTemplate): HTMLElement {
  const label = template.templateText;
  const button = source.cloneNode(true) as HTMLElement;
  button.removeAttribute('id');
  button.removeAttribute('data-testid');
  button.removeAttribute('aria-label');
  button.setAttribute(TEMPLATE_ATTR, template.id);
  button.querySelectorAll('svg, img').forEach((el) => el.remove());

  const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n as Text).data.trim()) textNodes.push(n as Text);
  }
  if (textNodes.length) {
    textNodes[0].data = label;
    textNodes.slice(1).forEach((n) => n.remove());
  } else {
    button.textContent = label;
  }
  return button;
}

const FALLBACK_STYLES = `
:host { all: initial; }
:host([hidden]) { display: none !important; }
.bar { position: fixed; z-index: 2147483000; display: flex; flex-direction: column; gap: 2px; padding: 4px;
  background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.16);
  font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.bar.dark { background: #2f2f2f; border-color: rgba(255,255,255,.14); }
button { all: unset; padding: 6px 12px; border-radius: 8px; cursor: pointer; color: #0d0d0d; white-space: nowrap; }
.bar.dark button { color: #ececec; }
button:hover { background: rgba(0,0,0,.06); }
.bar.dark button:hover { background: rgba(255,255,255,.08); }
`;

class FallbackBar {
  private host = document.createElement('inline-chatgpt-menu');
  private bar: HTMLDivElement;

  constructor(private onChoose: (template: QuestionTemplate) => void) {
    const shadow = this.host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${FALLBACK_STYLES}</style><div class="bar"></div>`;
    this.bar = shadow.querySelector('.bar')!;
    this.host.hidden = true;
    document.documentElement.append(this.host);
  }

  show(templates: QuestionTemplate[], range: Range): void {
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    if (!last) return;
    this.bar.classList.toggle('dark', isDarkMode());
    this.bar.replaceChildren(
      ...templates.map((template) => {
        const button = Object.assign(document.createElement('button'), { textContent: template.templateText });
        button.setAttribute(TEMPLATE_ATTR, template.id);
        button.addEventListener('mousedown', stop);
        button.addEventListener('click', (e) => {
          stop(e);
          this.onChoose(template);
        });
        return button;
      }),
    );
    this.host.hidden = false;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const { offsetWidth: w, offsetHeight: h } = this.bar;
    const top = last.bottom + 8 + h <= vh ? last.bottom + 8 : Math.max(8, rects[0].top - 8 - h);
    this.bar.style.top = `${top}px`;
    this.bar.style.left = `${Math.min(Math.max(8, last.left), vw - w - 8)}px`;
  }

  hide(): void {
    this.host.hidden = true;
  }
}
