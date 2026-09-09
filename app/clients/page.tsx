'use client';

import Image from 'next/image';
import { ChangeEvent, useState } from 'react';
import { useLocalStorageState } from '@/lib/local-storage';
import { useT } from '@/lib/i18n';
import {
  BusinessProfile,
  ClientProfile,
  EMPTY_BUSINESS_PROFILE,
  SavedBusinessProfile,
  createEmptyClientProfile,
  toBusinessProfile,
} from '@/lib/billing';

function SavedBusinessProfilesPanel({
  profiles,
  onEdit,
  onRemove,
}: {
  profiles: SavedBusinessProfile[];
  onEdit: (profile: SavedBusinessProfile) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useT();
  return (
    <div className="card p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{t('cl.business')}</h2>
        <p className="mt-2 text-sm muted">
          {t('cl.businessHint')}
        </p>
      </div>

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <div className="panel p-5 text-sm muted">
            {t('cl.noBusiness')}
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="panel p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xl font-semibold">
                    {profile.businessName}
                  </div>
                  <div className="mt-2 text-sm muted">
                    {profile.contactName || '—'}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(profile)}
                      className="btn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onRemove(profile.id)}
                      className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-[var(--bad)] hover:bg-red-400/20"
                    >
                      {t('cl.remove')}
                    </button>
                  </div>

                  {profile.letterheadDataUrl && (
                    <div className="overflow-hidden rounded-2xl bg-white p-2">
                      <Image
                        src={profile.letterheadDataUrl}
                        alt={`${profile.businessName} logo`}
                        width={88}
                        height={88}
                        className="h-[88px] w-[88px] object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm muted">
                <div>{profile.streetAddress || '—'}</div>
                <div>{profile.postalCodeCity || '—'}</div>
                <div>KvK: {profile.kvkNumber || '—'}</div>
                <div>BTW: {profile.vatNumber || '—'}</div>
                <div>IBAN: {profile.iban || '—'}</div>
                <div>Bank: {profile.bankName || '—'}</div>
                <div>Payment terms: {profile.paymentTermsDays || '30'} days</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SavedClientProfilesPanel({
  profiles,
  onEdit,
  onRemove,
}: {
  profiles: ClientProfile[];
  onEdit: (profile: ClientProfile) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useT();
  return (
    <div className="card p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{t('cl.clients')}</h2>
        <p className="mt-2 text-sm muted">
          {t('cl.clientHint')}
        </p>
      </div>

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <div className="panel p-5 text-sm muted">
            {t('cl.noClientsYet')}
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="panel p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xl font-semibold">
                    {profile.companyName}
                  </div>
                  {profile.attentionName && (
                    <div className="mt-2 text-sm muted">{profile.attentionName}</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(profile)}
                    className="btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(profile.id)}
                    className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-[var(--bad)] hover:bg-red-400/20"
                  >
                    {t('cl.remove')}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm muted">
                <div>{profile.streetAddress}</div>
                <div>{profile.postalCodeCity}</div>
                <div>KvK: {profile.kvkNumber || '—'}</div>
                <div>BTW: {profile.vatNumber || '—'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { t } = useT();
  const [, setLegacyBusinessProfile] = useLocalStorageState<BusinessProfile>(
    'business-profile',
    EMPTY_BUSINESS_PROFILE
  );
  const [businessProfiles, setBusinessProfiles] = useLocalStorageState<SavedBusinessProfile[]>(
    'business-profiles',
    []
  );
  const [clientProfiles, setClientProfiles] = useLocalStorageState<ClientProfile[]>(
    'client-profiles',
    []
  );
  const [businessDraft, setBusinessDraft] = useState<BusinessProfile>({ ...EMPTY_BUSINESS_PROFILE });
  const [editingBusinessId, setEditingBusinessId] = useState<number | null>(null);
  const [clientForm, setClientForm] = useState<ClientProfile>(createEmptyClientProfile());
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [businessNotice, setBusinessNotice] = useState('');
  const [businessError, setBusinessError] = useState('');
  const [businessLogoInputKey, setBusinessLogoInputKey] = useState(0);
  const [error, setError] = useState('');

  const updateBusinessField = (field: keyof BusinessProfile, value: string) => {
    setBusinessDraft({
      ...businessDraft,
      [field]: value,
    });
    setBusinessNotice('');
    setBusinessError('');
  };

  const handleBusinessLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      const message = 'Please upload a PNG, JPG, or JPEG logo file.';
      setBusinessError(message);
      window.alert(message);
      setBusinessLogoInputKey((current) => current + 1);
      return;
    }

    if (file.size > 300 * 1024) {
      const message = 'Logo files must be 300 KB or smaller.';
      setBusinessError(message);
      window.alert(message);
      setBusinessLogoInputKey((current) => current + 1);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        const message = 'Could not read that logo file. Please try again.';
        setBusinessError(message);
        window.alert(message);
        return;
      }

      setBusinessDraft((current) => ({
        ...current,
        letterheadDataUrl: result,
      }));
      setBusinessNotice('');
      setBusinessError('');
      setBusinessLogoInputKey((current) => current + 1);
    };
    reader.readAsDataURL(file);
  };

  const emptyBusinessFields = () => {
    setBusinessDraft({ ...EMPTY_BUSINESS_PROFILE });
    setEditingBusinessId(null);
    setBusinessNotice('');
    setBusinessError('');
    setBusinessLogoInputKey((current) => current + 1);
  };

  const saveBusinessProfile = () => {
    const savedProfile: SavedBusinessProfile = {
      ...businessDraft,
      id: editingBusinessId ?? Date.now(),
    };

    const updatedBusinessProfiles = editingBusinessId
      ? businessProfiles.map((profile) => {
          if (profile.id === editingBusinessId) {
            return savedProfile;
          }

          return profile;
        })
      : [savedProfile, ...businessProfiles];

    setBusinessProfiles(updatedBusinessProfiles);
    setLegacyBusinessProfile(toBusinessProfile(savedProfile));
    setBusinessDraft({ ...EMPTY_BUSINESS_PROFILE });
    setEditingBusinessId(null);
    setBusinessNotice(editingBusinessId ? 'Business profile updated.' : 'Business profile saved.');
    setBusinessError('');
    setBusinessLogoInputKey((current) => current + 1);
  };

  const editBusinessProfile = (profile: SavedBusinessProfile) => {
    setBusinessDraft(toBusinessProfile(profile));
    setEditingBusinessId(profile.id);
    setBusinessNotice('');
    setBusinessError('');
    setBusinessLogoInputKey((current) => current + 1);
  };

  const removeBusinessProfile = (id: number) => {
    const updatedBusinessProfiles = businessProfiles.filter((profile) => profile.id !== id);
    setBusinessProfiles(updatedBusinessProfiles);

    if (editingBusinessId === id) {
      emptyBusinessFields();
    }

    setLegacyBusinessProfile(
      updatedBusinessProfiles[0]
        ? toBusinessProfile(updatedBusinessProfiles[0])
        : { ...EMPTY_BUSINESS_PROFILE }
    );
    setBusinessNotice('');
    setBusinessError('');
  };

  const updateClientField = (field: keyof ClientProfile, value: string | number) => {
    setClientForm({
      ...clientForm,
      [field]: value,
    });
  };

  const emptyClientFields = () => {
    setClientForm(createEmptyClientProfile());
    setEditingClientId(null);
    setError('');
  };

  const saveClientProfile = () => {
    setError('');

    if (
      !clientForm.companyName.trim() ||
      !clientForm.streetAddress.trim() ||
      !clientForm.postalCodeCity.trim()
    ) {
      setError(t('msg.fillClientFields'));
      return;
    }

    if (editingClientId) {
      setClientProfiles(
        clientProfiles.map((profile) => {
          if (profile.id === editingClientId) {
            return {
              ...clientForm,
              id: editingClientId,
            };
          }

          return profile;
        })
      );
    } else {
      setClientProfiles([
        {
          ...clientForm,
          id: Date.now(),
        },
        ...clientProfiles,
      ]);
    }

    setClientForm(createEmptyClientProfile());
    setEditingClientId(null);
    setError('');
  };

  const editClientProfile = (profile: ClientProfile) => {
    setClientForm(profile);
    setEditingClientId(profile.id);
    setError('');
  };

  const removeClientProfile = (id: number) => {
    setClientProfiles(clientProfiles.filter((profile) => profile.id !== id));

    if (editingClientId === id) {
      emptyClientFields();
    }
  };

  return (
    <main className="space-y-6">

      <div>
        <h1 className="text-3xl font-semibold">{t('cl.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm muted">{t('cl.intro')}</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{t('cl.business')}</h2>
              <p className="mt-2 text-sm muted">
                This becomes the <span className="font-medium">From</span> block on each invoice.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={emptyBusinessFields}
                className="btn"
              >
                {t('cl.emptyFields')}
              </button>
              <button
                onClick={saveBusinessProfile}
                className="btn btn-primary"
              >
                {t('cl.save')}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.businessName')}</span>
              <input
                className="field"
                placeholder="Northwind Advisory"
                value={businessDraft.businessName}
                onChange={(e) => updateBusinessField('businessName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.contactName')}</span>
              <input
                className="field"
                placeholder="Alex Example"
                value={businessDraft.contactName}
                onChange={(e) => updateBusinessField('contactName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.street')}</span>
              <input
                className="field"
                placeholder="Keizersgracht 100"
                value={businessDraft.streetAddress}
                onChange={(e) => updateBusinessField('streetAddress', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.postcodeCity')}</span>
              <input
                className="field"
                placeholder="1015 CV Amsterdam"
                value={businessDraft.postalCodeCity}
                onChange={(e) => updateBusinessField('postalCodeCity', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.kvk')}</span>
              <input
                className="field"
                placeholder="12345678"
                value={businessDraft.kvkNumber}
                onChange={(e) => updateBusinessField('kvkNumber', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.vatNumber')}</span>
              <input
                className="field"
                placeholder="NL001234567B01"
                value={businessDraft.vatNumber}
                onChange={(e) => updateBusinessField('vatNumber', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.iban')}</span>
              <input
                className="field"
                placeholder="NL91ABNA0417164300"
                value={businessDraft.iban}
                onChange={(e) => updateBusinessField('iban', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.bank')}</span>
              <input
                className="field"
                placeholder="Example Bank"
                value={businessDraft.bankName}
                onChange={(e) => updateBusinessField('bankName', e.target.value)}
              />
            </label>

            <label className="space-y-2 md:max-w-[15rem]">
              <span className="text-sm muted">{t('inv.terms')}</span>
              <input
                className="field"
                type="number"
                min="1"
                placeholder="30"
                value={businessDraft.paymentTermsDays}
                onChange={(e) => updateBusinessField('paymentTermsDays', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.logo')}</span>
              <input
                key={businessLogoInputKey}
                className="field file:mr-3 file:rounded-[7px] file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--accent-ink)]"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleBusinessLogoUpload}
              />
              <p className="text-xs faint">
                PNG, JPG, or JPEG. Maximum size: 300 KB.
              </p>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 text-sm faint">
            <div>
              {editingBusinessId ? 'Editing a saved business profile.' : 'Creating a new business profile.'}
            </div>
            <div className="flex flex-col items-end gap-2">
              {businessDraft.letterheadDataUrl && (
                <div className="overflow-hidden rounded-2xl bg-white p-2">
                  <Image
                    src={businessDraft.letterheadDataUrl}
                    alt="Business logo preview"
                    width={80}
                    height={80}
                    className="h-20 w-20 object-contain"
                    unoptimized
                  />
                </div>
              )}
              {businessNotice && <div className="text-[var(--good)]">{businessNotice}</div>}
            </div>
          </div>

          {businessError && (
            <div className="mt-4 panel p-3 text-sm text-[var(--bad)]">
              {businessError}
            </div>
          )}
        </div>

        <SavedBusinessProfilesPanel
          profiles={businessProfiles}
          onEdit={editBusinessProfile}
          onRemove={removeBusinessProfile}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {editingClientId ? 'Edit Client Profile' : 'New Client Profile'}
              </h2>
              <p className="mt-2 text-sm muted">
                {t('cl.clientHint2')}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={emptyClientFields}
                className="btn"
              >
                {t('cl.emptyFields')}
              </button>
              <button
                onClick={saveClientProfile}
                className="btn btn-primary"
              >
                {t('cl.save')}
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.companyName')}</span>
              <input
                className="field"
                placeholder="Acme Studio B.V."
                value={clientForm.companyName}
                onChange={(e) => updateClientField('companyName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.attention')}</span>
              <input
                className="field"
                placeholder="Taylor Example"
                value={clientForm.attentionName}
                onChange={(e) => updateClientField('attentionName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.street')}</span>
              <input
                className="field"
                placeholder="Stationsplein 45"
                value={clientForm.streetAddress}
                onChange={(e) => updateClientField('streetAddress', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">{t('cl.postcodeCity')}</span>
              <input
                className="field"
                placeholder="3013 AK Rotterdam"
                value={clientForm.postalCodeCity}
                onChange={(e) => updateClientField('postalCodeCity', e.target.value)}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm muted">{t('cl.kvk')}</span>
                <input
                  className="field"
                  placeholder="87654321"
                  value={clientForm.kvkNumber}
                  onChange={(e) => updateClientField('kvkNumber', e.target.value)}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm muted">{t('cl.vatNumber')}</span>
                <input
                  className="field"
                  placeholder="NL008765432B01"
                  value={clientForm.vatNumber}
                  onChange={(e) => updateClientField('vatNumber', e.target.value)}
                />
              </label>
            </div>

            {error && (
              <div className="panel p-3 text-sm text-[var(--bad)]">
                {error}
              </div>
            )}
          </div>
        </div>

        <SavedClientProfilesPanel
          profiles={clientProfiles}
          onEdit={editClientProfile}
          onRemove={removeClientProfile}
        />
      </section>
    </main>
  );
}
