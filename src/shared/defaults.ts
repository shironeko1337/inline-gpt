import type { Options, QuestionTemplate } from './types';

export const DEFAULT_MODEL = 'gpt-4o-mini';

/** Template id: the lowercased question with runs of other characters replaced by dashes ("What is this?" -> "what-is-this"). */
export function templateId(templateText: string): string {
  return templateText
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** Templates saved before ids existed have none; derive it from the text. */
export function getTemplateId(template: Pick<QuestionTemplate, 'templateText'> & { id?: string }): string {
  return template.id || templateId(template.templateText);
}

export const DEFAULT_TEMPLATE: QuestionTemplate = {
  id: 'what-is-this',
  templateText: 'What is this?',
  templateContent:
    'For "<referenced text>", explain "<question>". The answer should be as straightforward as possible. ' +
    'The question and answer should be based on the conversation context, but it is independent to the other following questions.',
};

/**
 * Reserved menu entry whose question the user types in the message box. A message box whose template has this id
 * hasn't been asked yet; submitting replaces the template with one built from the typed question.
 */
export const CUSTOMIZED_QUESTION_ID = 'customized-question';

export const OTHER_QUESTIONS_TEMPLATE: QuestionTemplate = {
  id: CUSTOMIZED_QUESTION_ID,
  templateText: 'Other questions...',
  templateContent: DEFAULT_TEMPLATE.templateContent,
};

export const DEFAULT_OPTIONS: Options = {
  highlightStyle: {
    backgroundColor: '#ffd54f',
    underline: false,
    opacity: 0.4,
  },
  timeToShowMessage: 500,
  chatGPTAPIKey: '',
  chatGPTModel: DEFAULT_MODEL,
  confirmRemoveHighlight: true,
  showOtherQuestions: true,
  templates: [DEFAULT_TEMPLATE],
};
