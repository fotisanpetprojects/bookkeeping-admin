'use client';

/**
 * Skeleton for AI-assisted import.
 *
 * The goal: a user drops in whatever they already have — invoice PDFs, a bank
 * export, a spreadsheet — and a model turns it into records this app understands,
 * instead of a JSON file whose shape has to match exactly.
 *
 * What exists today is the seam, not the integration: provider settings, a typed
 * contract, and a single extract() entry point that currently reports that no
 * provider is wired. Everything downstream — review, then the existing merge —
 * is deliberately unchanged, so extraction can be swapped in without touching
 * how records are written.
 *
 * Deliberately NOT here yet:
 *   - a real provider call (the request/response shape belongs with the model)
 *   - file → text conversion for PDFs and spreadsheets
 *   - a server route to keep the key off the client (see the note below)
 */

import { BackupPayload, BACKUP_FORMAT } from './backup.ts';

export type AiProvider = 'anthropic' | 'openai' | 'none';

export type AiSettings = {
  provider: AiProvider;
  /**
   * Stored in localStorage for a local-first tool with no backend. That is
   * acceptable for a single-user machine and NOT acceptable once this is hosted:
   * a key in browser storage is readable by any script on the page. Moving
   * extraction behind a server route is the prerequisite for launching this.
   */
  apiKey: string;
  model: string;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'none',
  apiKey: '',
  model: 'claude-sonnet-5',
};

export const AI_MODELS: Record<Exclude<AiProvider, 'none'>, string[]> = {
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-5', 'gpt-5-mini'],
};

export type SourceDocument = {
  name: string;
  mediaType: string;
  /** Extracted text, or base64 for formats a model reads directly. */
  content: string;
};

/** What extraction must return: the same shape a backup file has. */
export type ExtractionResult = {
  payload: BackupPayload;
  /** Per-record notes: what was inferred, what was uncertain. */
  notes: string[];
  /** Anything the model could not place, kept so nothing is silently dropped. */
  unresolved: string[];
};

export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

export function isAiConfigured(settings: AiSettings) {
  return settings.provider !== 'none' && settings.apiKey.trim().length > 0;
}

/**
 * The contract the model must satisfy. Kept next to the types it describes so
 * the two cannot drift apart.
 */
export const EXTRACTION_CONTRACT = `Return JSON matching:
{
  "format": "${BACKUP_FORMAT}",
  "version": 1,
  "data": {
    "business-profiles": [...], "client-profiles": [...],
    "invoices": [...], "expenses": [...]
  },
  "notes": [...], "unresolved": [...]
}
Rules: never invent an amount, a date or a VAT rate that is not in the source.
Anything ambiguous goes to "unresolved" rather than being guessed. Amounts are
numbers in euro; dates are ISO (YYYY-MM-DD); VAT is a percentage number.`;

/**
 * Turn source documents into records. Not implemented: this is the seam a
 * provider call drops into, and it fails loudly rather than pretending.
 */
export async function extractFromDocuments(
  documents: SourceDocument[],
  settings: AiSettings
): Promise<ExtractionResult> {
  if (!isAiConfigured(settings)) {
    throw new AiNotConfiguredError(
      'No AI provider is configured. Add a provider and API key in Import settings.'
    );
  }

  if (documents.length === 0) {
    throw new AiNotConfiguredError('Add at least one document to import.');
  }

  throw new AiNotConfiguredError(
    'AI import is not wired up yet. The settings, the contract and the review step are in place; the provider call is the remaining piece.'
  );
}
