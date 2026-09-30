// Side chat backed by the OpenAI Responses API (https://platform.openai.com/docs/api-reference/responses).
// API keys are created at https://platform.openai.com/api-keys and billed separately from a ChatGPT subscription.
//
// ChatGPT web message ids are not OpenAI API response ids, so the side conversation cannot be forked from the
// web conversation directly. Instead the web conversation up to the answer (responseMessageId) is sent as input,
// and the returned response id can be used as `previousResponseId` to continue the side conversation later.

import type { ContextMessage } from '../shared/types';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

const INSTRUCTIONS =
  'You answer short side questions about a ChatGPT conversation. ' +
  'The conversation so far is given as prior messages; the last user message is the side question. ' +
  'Answer only the side question, concisely, in Markdown.';

export interface SideChatInput {
  apiKey: string;
  model: string;
  prompt: string;
  /** ChatGPT web conversation up to and including the answer the question is about. */
  context: ContextMessage[];
  /** Continue an existing side conversation instead of sending `context` again. */
  previousResponseId?: string;
}

export interface SideChatOutput {
  content: string;
  responseId: string;
}

interface ResponsesApiResult {
  id: string;
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
  error?: { message?: string } | null;
}

export async function createSideChat(input: SideChatInput): Promise<SideChatOutput> {
  if (!input.apiKey) {
    throw new Error('OpenAI API key is not set. Add it on the extension options page.');
  }

  const messages = input.previousResponseId
    ? [{ role: 'user', content: input.prompt }]
    : [...input.context.map((m) => ({ role: m.role, content: m.text })), { role: 'user', content: input.prompt }];

  const res = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      instructions: INSTRUCTIONS,
      input: messages,
      previous_response_id: input.previousResponseId,
      store: true,
    }),
  });

  const body = (await res.json().catch(() => null)) as ResponsesApiResult | null;
  if (!res.ok || !body) {
    throw new Error(body?.error?.message ?? `OpenAI API request failed (HTTP ${res.status})`);
  }

  const content = (body.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');

  return { content, responseId: body.id };
}
