// Converts between live DOM Ranges and serializable TextAnchors.
// A TextAnchor points at an element (by selectors relative to the message element) plus a character offset
// within that element's text, so it survives ChatGPT re-rendering the same markup.

import type { HighlightedText, ResponseContext, TextAnchor } from '../shared/types';
import { messageCSSSelector } from './chatgptDom';

interface Point {
  node: Node;
  offset: number;
}

export function createAnchor(container: Node, offset: number, messageEl: HTMLElement, messageId: string): TextAnchor {
  const el = container instanceof Element ? container : container.parentElement!;
  const target = messageEl.contains(el) ? el : messageEl;
  const prefix = document.createRange();
  prefix.setStart(target, 0);
  prefix.setEnd(container, offset);
  const responseContext: ResponseContext = { messageId, messageCSSSelector: messageCSSSelector(messageId) };
  return {
    node: {
      responseContext,
      relativeCSSSelector: cssPath(target, messageEl),
      relativeXPathSelector: xPath(target, messageEl),
    },
    offset: prefix.toString().length,
  };
}

/** Rebuilds the DOM Range of a highlight, verifying it still covers the same text. */
export function resolveRange(highlight: HighlightedText): Range | null {
  const messageEl = document.querySelector<HTMLElement>(highlight.start.node.responseContext.messageCSSSelector);
  if (!messageEl) return null;

  const locators: Array<(anchor: TextAnchor) => Element | null> = [
    (a) => byCSS(messageEl, a.node.relativeCSSSelector),
    (a) => byXPath(messageEl, a.node.relativeXPathSelector),
  ];
  for (const locate of locators) {
    const range = buildRange(locate(highlight.start), highlight.start.offset, locate(highlight.end), highlight.end.offset);
    if (range && range.toString() === highlight.text) return range;
  }
  return findTextInElement(messageEl, highlight.text);
}

export function isRangeValid(range: Range, text: string): boolean {
  return range.startContainer.isConnected && range.endContainer.isConnected && range.toString() === text;
}

function buildRange(startEl: Element | null, startOffset: number, endEl: Element | null, endOffset: number): Range | null {
  if (!startEl || !endEl) return null;
  const start = pointAt(startEl, startOffset);
  const end = pointAt(endEl, endOffset);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

function pointAt(el: Element, offset: number): Point | null {
  let remaining = offset;
  for (const node of textNodes(el)) {
    if (remaining <= node.data.length) return { node, offset: remaining };
    remaining -= node.data.length;
  }
  return offset === 0 ? { node: el, offset: 0 } : null;
}

/** Last resort when ChatGPT changed the markup: find the text anywhere in the message. */
function findTextInElement(root: Element, text: string): Range | null {
  if (!text) return null;
  const nodes = textNodes(root);
  const index = nodes.map((n) => n.data).join('').indexOf(text);
  if (index < 0) return null;
  const locate = (target: number): Point | null => {
    let pos = 0;
    for (const node of nodes) {
      if (target <= pos + node.data.length) return { node, offset: target - pos };
      pos += node.data.length;
    }
    return null;
  };
  const start = locate(index);
  const end = locate(index + text.length);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function byCSS(root: Element, selector: string): Element | null {
  if (!selector) return root;
  try {
    return root.querySelector(`:scope > ${selector}`);
  } catch {
    return null;
  }
}

function byXPath(root: Element, path: string): Element | null {
  if (path === '.') return root;
  try {
    const result = document.evaluate(path, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue instanceof Element ? result.singleNodeValue : null;
  } catch {
    return null;
  }
}

function cssPath(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const index = Array.prototype.indexOf.call(e.parentElement!.children, e) + 1;
    parts.unshift(`${CSS.escape(e.localName)}:nth-child(${index})`);
  }
  return parts.join(' > ');
}

function xPath(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const name = e.localName;
    const sameName = Array.from(e.parentElement!.children).filter((c) => c.localName === name);
    const step = e.namespaceURI === 'http://www.w3.org/1999/xhtml' ? name : `*[local-name()='${name}']`;
    parts.unshift(`${step}[${sameName.indexOf(e) + 1}]`);
  }
  return parts.length ? `./${parts.join('/')}` : '.';
}
