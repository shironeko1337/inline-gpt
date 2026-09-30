import type { SideQuestionRequest } from './types';

/** Fills <referenced text> and <question> in the template content. */
export function buildPrompt(request: SideQuestionRequest): string {
  return request.template.templateContent
    .replace(/<referenced text>/gi, request.referencedText)
    .replace(/<question>/gi, request.template.templateText);
}
