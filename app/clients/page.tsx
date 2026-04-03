'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocalStorageState } from '@/lib/local-storage';
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
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Saved Business Profiles</h2>
        <p className="mt-2 text-sm text-white/60">
          Save multiple sender profiles and reuse them on invoices.
        </p>
      </div>

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
            No business profiles saved yet.
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-[2rem] border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xl font-semibold text-white">
                    {profile.businessName}
                  </div>
                  <div className="mt-2 text-sm text-white/65">
                    {profile.contactName || '—'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(profile)}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(profile.id)}
                    className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200 hover:bg-red-400/20"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-white/75">
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
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Saved Client Profiles</h2>
        <p className="mt-2 text-sm text-white/60">
          Reuse client invoice details without typing them every time.
        </p>
      </div>

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
            No client profiles yet.
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-[2rem] border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xl font-semibold text-white">
                    {profile.companyName}
                  </div>
                  {profile.attentionName && (
                    <div className="mt-2 text-sm text-white/60">{profile.attentionName}</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(profile)}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(profile.id)}
                    className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200 hover:bg-red-400/20"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-white/75">
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
  const [error, setError] = useState('');

  const updateBusinessField = (field: keyof BusinessProfile, value: string) => {
    setBusinessDraft({
      ...businessDraft,
      [field]: value,
    });
    setBusinessNotice('');
  };

  const emptyBusinessFields = () => {
    setBusinessDraft({ ...EMPTY_BUSINESS_PROFILE });
    setEditingBusinessId(null);
    setBusinessNotice('');
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
  };

  const editBusinessProfile = (profile: SavedBusinessProfile) => {
    setBusinessDraft(toBusinessProfile(profile));
    setEditingBusinessId(profile.id);
    setBusinessNotice('');
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
      setError('Please fill in company name, street address, and postal code/city.');
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
      <Link
        href="/"
        className="inline-block rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
      >
        ← Back
      </Link>

      <div>
        <h1 className="text-3xl font-semibold">Billing Profiles</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/65">
          Save your own invoice details once, create reusable client profiles, and use them on the invoice page.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Your Business Profile</h2>
              <p className="mt-2 text-sm text-white/60">
                This becomes the <span className="font-medium text-white">From</span> block on each invoice.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={emptyBusinessFields}
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Empty fields
              </button>
              <button
                onClick={saveBusinessProfile}
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Save profile
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-white/70">Business name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Northwind Advisory"
                value={businessDraft.businessName}
                onChange={(e) => updateBusinessField('businessName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Contact name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Alex Example"
                value={businessDraft.contactName}
                onChange={(e) => updateBusinessField('contactName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Street and number</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Keizersgracht 100"
                value={businessDraft.streetAddress}
                onChange={(e) => updateBusinessField('streetAddress', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Postal code and city</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="1015 CV Amsterdam"
                value={businessDraft.postalCodeCity}
                onChange={(e) => updateBusinessField('postalCodeCity', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">KvK number</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="12345678"
                value={businessDraft.kvkNumber}
                onChange={(e) => updateBusinessField('kvkNumber', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">BTW number</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="NL001234567B01"
                value={businessDraft.vatNumber}
                onChange={(e) => updateBusinessField('vatNumber', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">IBAN</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="NL91ABNA0417164300"
                value={businessDraft.iban}
                onChange={(e) => updateBusinessField('iban', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Bank name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Example Bank"
                value={businessDraft.bankName}
                onChange={(e) => updateBusinessField('bankName', e.target.value)}
              />
            </label>

            <label className="space-y-2 md:max-w-[15rem]">
              <span className="text-sm text-white/70">Default payment terms (days)</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                type="number"
                min="1"
                placeholder="30"
                value={businessDraft.paymentTermsDays}
                onChange={(e) => updateBusinessField('paymentTermsDays', e.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm text-white/55">
            <div>
              {editingBusinessId ? 'Editing a saved business profile.' : 'Creating a new business profile.'}
            </div>
            {businessNotice && <div className="text-emerald-200">{businessNotice}</div>}
          </div>
        </div>

        <SavedBusinessProfilesPanel
          profiles={businessProfiles}
          onEdit={editBusinessProfile}
          onRemove={removeBusinessProfile}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {editingClientId ? 'Edit Client Profile' : 'New Client Profile'}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Save reusable invoice details for each client so the To block is prefilled.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={emptyClientFields}
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Empty fields
              </button>
              <button
                onClick={saveClientProfile}
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Save profile
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm text-white/70">Company name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Acme Studio B.V."
                value={clientForm.companyName}
                onChange={(e) => updateClientField('companyName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Attention / contact person</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Taylor Example"
                value={clientForm.attentionName}
                onChange={(e) => updateClientField('attentionName', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Street and number</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="Stationsplein 45"
                value={clientForm.streetAddress}
                onChange={(e) => updateClientField('streetAddress', e.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white/70">Postal code and city</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                placeholder="3013 AK Rotterdam"
                value={clientForm.postalCodeCity}
                onChange={(e) => updateClientField('postalCodeCity', e.target.value)}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-white/70">KvK number</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                  placeholder="87654321"
                  value={clientForm.kvkNumber}
                  onChange={(e) => updateClientField('kvkNumber', e.target.value)}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-white/70">BTW number</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-white placeholder-white/35 outline-none"
                  placeholder="NL008765432B01"
                  value={clientForm.vatNumber}
                  onChange={(e) => updateClientField('vatNumber', e.target.value)}
                />
              </label>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
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
