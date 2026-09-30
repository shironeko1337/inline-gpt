import { Card, Chip, Table } from '@heroui/react';
import { useEffect, useState } from 'react';
import { CUSTOMIZED_QUESTION_ID, getTemplateId } from '../shared/defaults';
import { loadAllHighlights, onHighlightsChanged, type StoredHighlight } from '../shared/storage';
import type { HighlightedText } from '../shared/types';

/** Read-only list of every saved highlight; refreshes when ChatGPT tabs add or change highlights. */
export function HighlightsTable() {
  const [rows, setRows] = useState<StoredHighlight[]>([]);

  useEffect(() => {
    const refresh = () => void loadAllHighlights().then(setRows);
    refresh();
    return onHighlightsChanged(refresh);
  }, []);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Saved highlights ({rows.length})</Card.Title>
        <Card.Description>Every highlighted text with its side question, across all conversations.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Saved highlights" className="min-w-[48rem]">
              <Table.Header>
                <Table.Column isRowHeader>Selected text</Table.Column>
                <Table.Column>Question</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Answer</Table.Column>
                <Table.Column>Conversation</Table.Column>
                <Table.Column>Created</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <p className="p-4 text-center text-sm text-muted">No saved highlights.</p>}>
                {rows.map(({ conversationKey, highlight }) => (
                  <Table.Row key={highlight.id} id={highlight.id}>
                    <Table.Cell>
                      <Clamp text={highlight.messagebox.request.referencedText} />
                    </Table.Cell>
                    <Table.Cell>
                      <Clamp text={questionLabel(highlight)} />
                    </Table.Cell>
                    <Table.Cell>
                      <StatusChip highlight={highlight} />
                    </Table.Cell>
                    <Table.Cell>
                      <Clamp text={highlight.messagebox.response.content} />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-xs text-muted" title={conversationKey}>
                        {conversationKey.slice(0, 8)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="whitespace-nowrap text-xs">{new Date(highlight.createdAt).toLocaleString()}</span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
}

function isUnasked(highlight: HighlightedText): boolean {
  return getTemplateId(highlight.messagebox.request.template) === CUSTOMIZED_QUESTION_ID;
}

function questionLabel(highlight: HighlightedText): string {
  return isUnasked(highlight) ? '(not asked yet)' : highlight.messagebox.request.template.templateText;
}

function StatusChip({ highlight }: { highlight: HighlightedText }) {
  if (isUnasked(highlight)) return <Chip size="sm">not asked</Chip>;
  const { status } = highlight.messagebox.response;
  const color = status === 'fulfilled' ? 'success' : status === 'error' ? 'danger' : 'warning';
  return (
    <Chip size="sm" color={color}>
      {status}
    </Chip>
  );
}

function Clamp({ text }: { text: string }) {
  return (
    <span className="line-clamp-2 max-w-[18rem] break-words text-sm" title={text}>
      {text || '—'}
    </span>
  );
}
