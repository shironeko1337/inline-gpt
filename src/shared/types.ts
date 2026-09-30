// Mirrors "data structure.txt". Everything here is JSON-serializable.

export interface ResponseContext {
  messageId: string;
  /** Locates the full answer message element by message id. */
  messageCSSSelector: string;
}

/**
 * Describes the element that contains a boundary of the highlight.
 * Selectors are relative to the message element so a ChatGPT UI change only
 * requires updating the message selector.
 */
export interface TextNode {
  responseContext: ResponseContext;
  /** Empty string means the message element itself. */
  relativeCSSSelector: string;
  /** Fallback when the CSS selector does not match the text. */
  relativeXPathSelector: string;
}

export interface TextAnchor {
  node: TextNode;
  /** Character offset within the textContent of the element located by `node`. */
  offset: number;
}

export interface QuestionTemplate {
  /** templateId(templateText), e.g. "what-is-this"; CUSTOMIZED_QUESTION_ID for "Other questions...". */
  id: string;
  /** Text shown in the menu and the <question> placeholder value. */
  templateText: string;
  /** Prompt with <referenced text> and <question> placeholders. */
  templateContent: string;
}

export interface SideQuestionRequest {
  referencedText: string;
  template: QuestionTemplate;
  responseMessageId: string;
}

export type SideQuestionStatus = 'pending' | 'fulfilled' | 'error';

export interface SideQuestionResponse {
  status: SideQuestionStatus;
  /** Answer markdown when fulfilled, error message when error. */
  content: string;
  /** OpenAI response id of the side conversation (usable as previous_response_id). */
  responseId: string;
}

export interface Messagebox {
  request: SideQuestionRequest;
  response: SideQuestionResponse;
}

export interface HighlightedText {
  id: string;
  createdAt: number;
  start: TextAnchor;
  end: TextAnchor;
  /** Used to verify the restored range still covers the same text. */
  text: string;
  messagebox: Messagebox;
}

export interface HighlightStyle {
  backgroundColor: string;
  underline: boolean;
  opacity: number;
}

export interface Options {
  highlightStyle: HighlightStyle;
  timeToShowMessage: number;
  chatGPTAPIKey: string;
  chatGPTModel: string;
  confirmRemoveHighlight: boolean;
  /** Show "Other questions..." at the end of the selection menu (the user types the question in the message box). */
  showOtherQuestions: boolean;
  templates: QuestionTemplate[];
}

/** One message of the ChatGPT web conversation, sent as side chat context. */
export interface ContextMessage {
  role: 'user' | 'assistant';
  text: string;
}
