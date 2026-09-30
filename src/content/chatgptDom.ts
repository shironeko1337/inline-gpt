// All knowledge about ChatGPT's web DOM lives here, so UI changes only need updates in this file.

import type { ContextMessage } from '../shared/types';

// Current markup (see "chatGPT response html.txt"):
//   div[data-content-search-unit-key="…:assistant"]                    conversation turn
//     h4[data-conversation-role="assistant"]  "ChatGPT said:"          role label (screen readers only)
//     div[data-chatgpt-selection-message-id="<id>"]                   message element
//       div[data-markdown-text-style="assistant-message"]              rendered answer
// Legacy markup: div[data-message-author-role="assistant"][data-message-id="<id>"], kept as a fallback.
const MESSAGE_ATTR = 'data-chatgpt-selection-message-id';
const TURN_ROLE_ATTR = 'data-conversation-role';
const TURN_KEY_ATTR = 'data-content-search-unit-key';
const ASSISTANT_MARKDOWN_SELECTOR = '[data-markdown-text-style="assistant-message"]';
const LEGACY_MESSAGE_ATTR = 'data-message-id';
const LEGACY_ROLE_ATTR = 'data-message-author-role';
const ANY_MESSAGE_SELECTOR = `[${MESSAGE_ATTR}], [${LEGACY_MESSAGE_ATTR}]`;

const ASK_CHATGPT_LABEL = 'ask chatgpt';
/** Max characters of conversation sent as side chat context (oldest messages are dropped first). */
const MAX_CONTEXT_CHARS = 60_000;

type Role = ContextMessage['role'];

export function messageCSSSelector(messageId: string): string {
  const id = CSS.escape(messageId);
  return `[${MESSAGE_ATTR}="${id}"], [${LEGACY_MESSAGE_ATTR}="${id}"]`;
}

export function findMessageElement(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest(ANY_MESSAGE_SELECTOR) as HTMLElement | null) ?? null;
}

export function getMessageId(messageEl: HTMLElement): string {
  return messageEl.getAttribute(MESSAGE_ATTR) ?? messageEl.getAttribute(LEGACY_MESSAGE_ATTR) ?? '';
}

export function isAssistantMessage(messageEl: HTMLElement): boolean {
  return getRole(messageEl) === 'assistant';
}

function getRole(messageEl: HTMLElement): Role | null {
  const legacy = messageEl.getAttribute(LEGACY_ROLE_ATTR);
  if (legacy === 'user' || legacy === 'assistant') return legacy;

  const turn = messageEl.closest(`[${TURN_KEY_ATTR}]`);
  const heading = (turn ?? messageEl.parentElement)?.querySelector(`[${TURN_ROLE_ATTR}]`);
  const role = heading?.getAttribute(TURN_ROLE_ATTR) ?? turn?.getAttribute(TURN_KEY_ATTR)?.split(':').pop();
  if (role === 'user' || role === 'assistant') return role;

  return messageEl.querySelector(ASSISTANT_MARKDOWN_SELECTOR) ? 'assistant' : null;
}

/** Highlights are stored per conversation: /c/<id> (also inside projects /g/<gizmo>/c/<id>). */
export function getConversationKey(): string {
  const match = location.pathname.match(/\/c\/([^/?#]+)/);
  return match ? match[1] : `path:${location.pathname}`;
}

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

/** The web conversation up to and including the message with `messageId`. */
export function collectContext(messageId: string): ContextMessage[] {
  const messages: ContextMessage[] = [];
  const headings = document.querySelectorAll<HTMLElement>(`[${TURN_ROLE_ATTR}]`);
  if (headings.length > 0) {
    for (const heading of headings) {
      const role = heading.getAttribute(TURN_ROLE_ATTR);
      const turn = heading.parentElement;
      if (!turn || (role !== 'user' && role !== 'assistant')) continue;
      // Skip the "ChatGPT said:" / "You said:" label.
      const text = [...turn.children]
        .filter((child): child is HTMLElement => child !== heading && child instanceof HTMLElement)
        .map((child) => child.innerText.trim())
        .filter(Boolean)
        .join('\n');
      if (text) messages.push({ role, text });
      if (turn.querySelector(messageCSSSelector(messageId))) break;
    }
  } else {
    for (const el of document.querySelectorAll<HTMLElement>(`[${LEGACY_ROLE_ATTR}]`)) {
      const role = el.getAttribute(LEGACY_ROLE_ATTR);
      const text = el.innerText.trim();
      if ((role === 'user' || role === 'assistant') && text) messages.push({ role, text });
      if (el.getAttribute(LEGACY_MESSAGE_ATTR) === messageId) break;
    }
  }

  let total = 0;
  const kept: ContextMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].text.length;
    if (total > MAX_CONTEXT_CHARS && kept.length > 0) break;
    kept.unshift(messages[i]);
  }
  return kept;
}

/** The floating "Ask ChatGPT" button ChatGPT shows when text in an answer is selected. */
export function findAskChatGPTButton(): HTMLElement | null {
  for (const button of document.querySelectorAll<HTMLElement>('button')) {
    if (button.closest(ANY_MESSAGE_SELECTOR) || button.hasAttribute('data-icg-template')) continue;
    if (button.textContent?.trim().toLowerCase() !== ASK_CHATGPT_LABEL) continue;
    if (button.getClientRects().length === 0) continue;
    return button;
  }
  return null;
}

/** Debug helper: every visible element whose text mentions "Ask ChatGPT", to adapt findAskChatGPTButton. */
export function describeAskButtonCandidates(): unknown[] {
  return [...document.querySelectorAll<HTMLElement>('button, [role="button"]')]
    .filter((el) => el.textContent?.trim().toLowerCase().includes(ASK_CHATGPT_LABEL))
    .slice(0, 10)
    .map((el) => ({
      el,
      tag: el.tagName,
      role: el.getAttribute('role'),
      text: el.textContent?.trim(),
      visible: el.getClientRects().length > 0,
      insideMessage: !!el.closest(ANY_MESSAGE_SELECTOR),
    }));
}
