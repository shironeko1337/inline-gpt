import {
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  NumberField,
  Slider,
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { CUSTOMIZED_QUESTION_ID, DEFAULT_TEMPLATE, templateId } from '../shared/defaults';
import { clearAllStorage, loadOptions, saveOptions } from '../shared/storage';
import type { HighlightStyle, Options, QuestionTemplate } from '../shared/types';
import { HighlightsTable } from './HighlightsTable';

export function App() {
  const [options, setOptions] = useState<Options | null>(null);

  useEffect(() => {
    void loadOptions().then(setOptions);
  }, []);

  if (!options) return null;
  return <OptionsForm initial={options} />;
}

/** Every change is saved immediately; templates only while they are valid (non-empty, unique menu text). */
function OptionsForm({ initial }: { initial: Options }) {
  const [options, setOptions] = useState(initial);
  const [templates, setTemplates] = useState(initial.templates);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saved = useRef(initial);

  const persist = (next: Options) => {
    saved.current = next;
    void saveOptions(next).then(() => setSavedAt(Date.now()));
  };

  const update = (patch: Partial<Options>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    persist({ ...next, templates: saved.current.templates });
  };

  const updateStyle = (patch: Partial<HighlightStyle>) =>
    update({ highlightStyle: { ...options.highlightStyle, ...patch } });

  const templateErrors = templates.map((t) => templateError(t, templates));

  const updateTemplates = (next: QuestionTemplate[]) => {
    setTemplates(next);
    if (next.every((t) => !templateError(t, next))) {
      const cleaned = next.map((t) => ({ ...t, id: templateId(t.templateText), templateText: t.templateText.trim() }));
      setOptions((o) => ({ ...o, templates: cleaned }));
      persist({ ...options, templates: cleaned });
    }
  };

  const { highlightStyle } = options;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inline Question for ChatGPT</h1>
          <p className="text-sm text-muted">Settings are saved automatically.</p>
        </div>
        {savedAt && <span className="text-xs text-muted">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
      </header>

      <Card>
        <Card.Header>
          <Card.Title>OpenAI</Card.Title>
          <Card.Description>
            Side questions are answered with the OpenAI API. Create a key at{' '}
            <a className="underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
              platform.openai.com/api-keys
            </a>
            . It is stored only in this browser.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <TextField value={options.chatGPTAPIKey} onChange={(v) => update({ chatGPTAPIKey: v.trim() })}>
            <Label>API key</Label>
            <Input type="password" placeholder="sk-..." autoComplete="off" />
          </TextField>
          <TextField value={options.chatGPTModel} onChange={(v) => update({ chatGPTModel: v })}>
            <div className="flex items-baseline justify-between gap-2">
              <Label>Model</Label>
              <a
                className="text-xs text-muted underline"
                href="https://platform.openai.com/docs/models"
                target="_blank"
                rel="noreferrer"
              >
                Available models ↗
              </a>
            </div>
            <Input placeholder="gpt-4o-mini" />
          </TextField>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Highlight & message box</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-3 text-sm font-medium">
              Highlight color
              <input
                type="color"
                className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
                value={highlightStyle.backgroundColor}
                onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
              />
            </label>
            <Switch isSelected={highlightStyle.underline} onChange={(underline) => updateStyle({ underline })}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>Underline</Label>
              </Switch.Content>
            </Switch>
            <span
              className="rounded px-1"
              style={{
                textDecoration: highlightStyle.underline ? 'underline' : undefined,
                background: `color-mix(in srgb, ${highlightStyle.backgroundColor} ${Math.round(highlightStyle.opacity * 100)}%, transparent)`,
              }}
            >
              Preview text
            </span>
          </div>

          <Slider
            className="max-w-sm"
            minValue={0.05}
            maxValue={1}
            step={0.05}
            value={highlightStyle.opacity}
            onChange={(v) => updateStyle({ opacity: v as number })}
          >
            <Label>Highlight opacity</Label>
            <Slider.Output />
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>

          <NumberField
            className="max-w-xs"
            minValue={0}
            step={100}
            value={options.timeToShowMessage}
            onChange={(v) => update({ timeToShowMessage: Number.isFinite(v) ? v : 0 })}
          >
            <Label>Hover delay before showing the message box (ms)</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>

          <Switch isSelected={options.showOtherQuestions} onChange={(showOtherQuestions) => update({ showOtherQuestions })}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>Show “Other questions...” in the selection menu (type your own question in the message box)</Label>
            </Switch.Content>
          </Switch>

          <Switch
            isSelected={options.confirmRemoveHighlight}
            onChange={(confirmRemoveHighlight) => update({ confirmRemoveHighlight })}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>Ask for confirmation before deleting a message box</Label>
            </Switch.Content>
          </Switch>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Question templates</Card.Title>
          <Card.Description>
            Shown below “Ask ChatGPT” when you select text in an answer. In the prompt,{' '}
            <code>&lt;referenced text&gt;</code> is replaced by the selected text and <code>&lt;question&gt;</code> by
            the menu text.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {templates.map((template, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <TextField
                value={template.templateText}
                isInvalid={!!templateErrors[i]}
                onChange={(templateText) => updateTemplates(templates.map((t, j) => (j === i ? { ...t, templateText } : t)))}
              >
                <Label>Menu text</Label>
                <Input placeholder="What is this?" />
                <FieldError>{templateErrors[i]}</FieldError>
              </TextField>
              <TextField
                value={template.templateContent}
                onChange={(templateContent) =>
                  updateTemplates(templates.map((t, j) => (j === i ? { ...t, templateContent } : t)))
                }
              >
                <Label>Prompt</Label>
                <TextArea rows={4} />
                <Description>Sent to the model together with the conversation up to the answer.</Description>
              </TextField>
              <div className="flex justify-end">
                <Button variant="danger-soft" size="sm" onPress={() => updateTemplates(templates.filter((_, j) => j !== i))}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted">No templates. The selection menu is disabled.</p>}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onPress={() =>
                updateTemplates([...templates, { id: '', templateText: '', templateContent: DEFAULT_TEMPLATE.templateContent }])
              }
            >
              Add template
            </Button>
            {!templates.some((t) => templateId(t.templateText) === DEFAULT_TEMPLATE.id) && (
              <Button variant="ghost" onPress={() => updateTemplates([...templates, { ...DEFAULT_TEMPLATE }])}>
                Restore “{DEFAULT_TEMPLATE.templateText}”
              </Button>
            )}
          </div>
        </Card.Content>
      </Card>

      <HighlightsTable />

      <Card>
        <Card.Header>
          <Card.Title>Storage</Card.Title>
          <Card.Description>
            Deletes everything this extension saved in this browser: all highlights and answers, templates and
            settings (including the API key).
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div>
            <Button variant="danger" onPress={() => void clearAll()}>
              Clear all local storage
            </Button>
          </div>
        </Card.Content>
      </Card>
    </main>
  );
}

/** Templates are identified by templateId(menu text), so ids must be non-empty, unique and not reserved. */
function templateError(template: QuestionTemplate, all: QuestionTemplate[]): string {
  const id = templateId(template.templateText);
  if (!id) return 'Menu text needs at least one letter or digit';
  if (id === CUSTOMIZED_QUESTION_ID) return 'This name is reserved for “Other questions...”';
  if (all.filter((o) => templateId(o.templateText) === id).length > 1) return 'Too similar to another template’s menu text';
  return '';
}

async function clearAll(): Promise<void> {
  if (!confirm('Delete all saved highlights, answers, templates and settings (including the API key)? This cannot be undone.')) return;
  await clearAllStorage();
  location.reload(); // start over from the default options
}
