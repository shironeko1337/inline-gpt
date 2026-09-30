import type { ContextMessage, SideQuestionRequest } from './types';

/** content script -> background */
export interface AskSideQuestionMessage {
  type: 'askSideQuestion';
  request: SideQuestionRequest;
  context: ContextMessage[];
}

export type AskSideQuestionResult =
  | { ok: true; content: string; responseId: string }
  | { ok: false; error: string };
