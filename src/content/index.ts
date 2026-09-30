import type { AskSideQuestionMessage, AskSideQuestionResult } from '../shared/messages';
import { debug } from '../shared/debug';
import { templateId } from '../shared/defaults';
import { loadOptions, onConversationHighlightsRemoved, onOptionsChanged } from '../shared/storage';
import type { HighlightedText, Options, QuestionTemplate } from '../shared/types';
import { createAnchor } from './anchors';
import { collectContext, getConversationKey } from './chatgptDom';
import { HighlightManager } from './highlights';
import { SelectionMenu, type SelectionInfo } from './menu';
import { isUnasked, MessageBox } from './messagebox';

/** Debounce for re-resolving highlights after ChatGPT re-renders. */
const RECONCILE_DELAY = 300;
const INTERRUPTED_ERROR = 'The request was interrupted (page reloaded or closed).';

async function main(): Promise<void> {
  let options: Options = await loadOptions();
  debug('Content script started', { url: location.href, templates: options.templates.map((t) => t.id) });
  const manager = new HighlightManager(options.highlightStyle);
  /** Ids of requests started by this page; any other 'pending' item was interrupted. */
  const inFlight = new Set<string>();

  const box = new MessageBox({
    onDelete: async (id) => {
      if (options.confirmRemoveHighlight && !confirm('Delete this message box and its highlight?')) return;
      box.close();
      await manager.remove(id);
    },
    onRetry: (id) => {
      const item = manager.get(id);
      if (item) void ask(item);
    },
    onAsk: (id, question) => {
      const item = manager.get(id);
      if (!item) return;
      const { request } = item.messagebox;
      const template = { ...request.template, id: templateId(question), templateText: question };
      void ask({ ...item, messagebox: { ...item.messagebox, request: { ...request, template } } });
    },
  });

  const openBox = (item: HighlightedText) => box.open(item, () => manager.getRange(item.id));

  async function setResponse(item: HighlightedText, response: HighlightedText['messagebox']['response']) {
    const updated: HighlightedText = { ...item, messagebox: { ...item.messagebox, response } };
    await manager.update(updated);
    box.update(updated);
    return updated;
  }

  async function ask(item: HighlightedText): Promise<void> {
    const key = manager.key;
    inFlight.add(item.id);
    item = await setResponse(item, { status: 'pending', content: '', responseId: '' });
    const message: AskSideQuestionMessage = {
      type: 'askSideQuestion',
      request: item.messagebox.request,
      context: collectContext(item.messagebox.request.responseMessageId),
    };
    let result: AskSideQuestionResult;
    try {
      result = await chrome.runtime.sendMessage(message);
    } catch (e) {
      result = { ok: false, error: `Extension error: ${e instanceof Error ? e.message : String(e)}. Try reloading the page.` };
    }
    inFlight.delete(item.id);
    const current = manager.key === key ? manager.get(item.id) : undefined;
    if (!current) return; // deleted or conversation switched meanwhile
    await setResponse(
      current,
      result.ok
        ? { status: 'fulfilled', content: result.content, responseId: result.responseId }
        : { status: 'error', content: result.error, responseId: '' },
    );
  }

  async function createSideQuestion(template: QuestionTemplate, selection: SelectionInfo): Promise<void> {
    debug('Template chosen', template.id, selection.text);
    const { range, messageEl, messageId, text, referencedText } = selection;
    const item: HighlightedText = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      start: createAnchor(range.startContainer, range.startOffset, messageEl, messageId),
      end: createAnchor(range.endContainer, range.endOffset, messageEl, messageId),
      text,
      messagebox: {
        request: { referencedText, template: { ...template }, responseMessageId: messageId },
        response: { status: 'pending', content: '', responseId: '' },
      },
    };
    await manager.add(item, range);
    openBox(item);
    if (!isUnasked(item)) await ask(item); // "Other questions...": asked once the user types the question
  }

  new SelectionMenu(() => options, (template, selection) => void createSideQuestion(template, selection));

  // --- conversation loading & keeping highlights attached to ChatGPT's re-rendered DOM ---
  async function loadConversation(): Promise<void> {
    box.close();
    const items = await manager.load(getConversationKey());
    debug(`Loaded ${items.length} highlight(s) for conversation ${manager.key}`);
    for (const item of items) {
      if (item.messagebox.response.status === 'pending' && !inFlight.has(item.id) && !isUnasked(item)) {
        await setResponse(item, { status: 'error', content: INTERRUPTED_ERROR, responseId: '' });
      }
    }
  }

  let reconcileTimer = 0;
  new MutationObserver(() => {
    clearTimeout(reconcileTimer);
    reconcileTimer = window.setTimeout(() => {
      if (getConversationKey() !== manager.key) void loadConversation();
      else manager.reconcile();
    }, RECONCILE_DELAY);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  await loadConversation();

  // e.g. "Clear all local storage" on the options page: drop the in-memory copies so they aren't saved back.
  onConversationHighlightsRemoved((key) => {
    if (key === manager.key && manager.all().length > 0) void loadConversation();
  });

  onOptionsChanged((next) => {
    options = next;
    manager.setStyle(next.highlightStyle);
  });

  // --- hover to (re)open, click outside to close ---
  let hoverId: string | null = null;
  /** A box closed by clicking while hovering stays closed until the mouse leaves its highlight. */
  let suppressedId: string | null = null;
  let hoverTimer = 0;
  let moveFrame = 0;

  document.addEventListener('mousemove', (event) => {
    if (moveFrame) return;
    const { clientX, clientY, buttons } = event;
    const overBox = box.contains(event);
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      const id = buttons || overBox ? null : (manager.hitTest(clientX, clientY)[0] ?? null);
      if (id === hoverId) return;
      hoverId = id;
      clearTimeout(hoverTimer);
      if (id !== suppressedId) suppressedId = null;
      if (!id || id === box.currentId || id === suppressedId) return;
      hoverTimer = window.setTimeout(() => {
        const item = manager.get(id);
        if (item && hoverId === id) openBox(item);
      }, options.timeToShowMessage);
    });
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (box.currentId && !box.contains(event)) {
        suppressedId = hoverId;
        box.close();
      }
    },
    true,
  );
}

if (window.top === window) void main();
