import type { AskSideQuestionMessage, AskSideQuestionResult } from '../shared/messages';
import { buildPrompt } from '../shared/prompt';
import { loadOptions, saveOptions } from '../shared/storage';
import { createSideChat } from '../sidechat/openai';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await saveOptions(await loadOptions());
  }
});

chrome.runtime.onMessage.addListener((message: AskSideQuestionMessage, _sender, sendResponse) => {
  if (message?.type !== 'askSideQuestion') return false;
  askSideQuestion(message).then(sendResponse);
  return true; // keep the channel open for the async response
});

async function askSideQuestion(message: AskSideQuestionMessage): Promise<AskSideQuestionResult> {
  try {
    const options = await loadOptions();
    const result = await createSideChat({
      apiKey: options.chatGPTAPIKey,
      model: options.chatGPTModel,
      prompt: buildPrompt(message.request),
      context: message.context,
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
