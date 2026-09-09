'use client';

import { ChangeEvent, useState } from 'react';
import { useLocalStorageState } from '@/lib/local-storage';
import { useT } from '@/lib/i18n';
import {
  AI_MODELS,
  AiProvider,
  AiSettings,
  DEFAULT_AI_SETTINGS,
  SourceDocument,
  extractFromDocuments,
  isAiConfigured,
} from '@/lib/ai-import';

/**
 * The user-facing half of the AI import seam. Settings and file collection work;
 * pressing Extract reports honestly that the provider call is not wired yet.
 */
export default function AiImportPanel() {
  const [settings, setSettings] = useLocalStorageState<AiSettings>('ai-settings', DEFAULT_AI_SETTINGS);
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const { t } = useT();

  const update = (patch: Partial<AiSettings>) => {
    try {
      setSettings({ ...settings, ...patch });
    } catch {
      setError(t('msg.settingsFailed'));
    }
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const loaded: SourceDocument[] = [];

    for (const file of files) {
      loaded.push({
        name: file.name,
        mediaType: file.type || 'application/octet-stream',
        content: file.type.startsWith('text/') || file.name.endsWith('.csv') ? await file.text() : '',
      });
    }

    setDocuments((current) => [...current, ...loaded]);
    setStatus('');
    setError('');
  };

  const runExtraction = async () => {
    setStatus('');
    setError('');

    try {
      const result = await extractFromDocuments(documents, settings);
      setStatus(`Extracted ${result.payload.data.invoices ? 'records' : 'nothing'}.`);
    } catch (extractionError) {
      setError(extractionError instanceof Error ? extractionError.message : 'Extraction failed.');
    }
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('ai.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm muted">
            {t('ai.intro')}
          </p>
        </div>
        <span className="chip chip-warn">{t('ai.preview')}</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm muted">
          <span className="mb-2 block">{t('ai.provider')}</span>
          <select
            className="field"
            value={settings.provider}
            onChange={(event) => update({ provider: event.target.value as AiProvider })}
          >
            <option value="none" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>{t('ai.notConfigured')}</option>
            <option value="anthropic" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>Anthropic</option>
            <option value="openai" style={{ color: 'var(--ink)', background: 'var(--surface)' }}>OpenAI</option>
          </select>
        </label>

        <label className="text-sm muted">
          <span className="mb-2 block">{t('ai.model')}</span>
          <select
            className="field"
            value={settings.model}
            disabled={settings.provider === 'none'}
            onChange={(event) => update({ model: event.target.value })}
          >
            {(settings.provider === 'none' ? [] : AI_MODELS[settings.provider]).map((model) => (
              <option key={model} value={model} style={{ color: 'var(--ink)', background: 'var(--surface)' }}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm muted">
          <span className="mb-2 block">{t('ai.apiKey')}</span>
          <div className="flex gap-2">
            <input
              className="field"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-…"
              value={settings.apiKey}
              onChange={(event) => update({ apiKey: event.target.value })}
            />
            <button className="btn" onClick={() => setShowKey((value) => !value)}>
              {showKey ? t('ai.hide') : t('ai.show')}
            </button>
          </div>
        </label>
      </div>

      <div className="mt-4 panel p-4 text-xs muted">
        {t('ai.keyWarning')}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="file"
          multiple
          accept=".pdf,.csv,.txt,.json,.xlsx,image/*"
          onChange={addFiles}
          disabled={!isAiConfigured(settings)}
          className="field max-w-sm file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        {!isAiConfigured(settings) && (
          <span className="text-sm faint">{t('ai.notAcceptingFiles')}</span>
        )}

        <button className="btn btn-primary" onClick={runExtraction} disabled={!isAiConfigured(settings) || documents.length === 0}>
          {t('ai.extract')}
        </button>
        {documents.length > 0 && (
          <button className="btn" onClick={() => setDocuments([])}>{t('ai.clearFiles', { count: documents.length })}</button>
        )}
      </div>

      {documents.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm muted">
          {documents.map((document) => (
            <li key={document.name}>• {document.name} <span className="faint">({document.mediaType || 'unknown type'})</span></li>
          ))}
        </ul>
      )}

      {error && <div className="mt-4 panel border-[var(--bad)] bg-[var(--bad-soft)] p-3 text-sm text-[var(--bad)]">{error}</div>}
      {status && !error && <div className="mt-4 panel border-[var(--good)] bg-[var(--good-soft)] p-3 text-sm text-[var(--good)]">{status}</div>}
    </section>
  );
}
