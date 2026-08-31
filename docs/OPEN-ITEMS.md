# Open items

Known gaps and deliberate debt, kept here so they are not rediscovered later.
Ordered by what should be done first. The product direction lives in the README
roadmap; this file is the engineering backlog behind it.

## Blocking a hosted launch

**Move AI extraction behind a server route.**
`lib/ai-import.ts` keeps the provider API key in `localStorage`. That is fine on a
personal machine and a real vulnerability once hosted — any script on the page can
read it. This blocks the whole wealth roadmap: asking people for bank data on a
frontend that holds keys in browser storage is not defensible. Do this before
adding features on top of the seam.

**No authentication or backend.** Fine while local-first, mandatory before the
bank-statement work is offered to anyone but the author.

## Correctness

**There are no tests.** The VAT quarter maths, the ZZP tax chain, the backup merge
dedupe, and the money helpers were verified by driving a browser — none of which
survives a refactor. `lib/tax.ts`, `lib/backup.ts` and `lib/billing.ts` are pure
and would take about an hour to cover. Two real bugs of exactly this class have
already shipped and been caught by hand:
- the storage layer reported a save that never reached disk
- a filing deadline rendered a day early because a local date was converted to UTC

**The 2026 tax rates are unverified defaults.** `DEFAULT_TAX_SETTINGS` ships
plausible figures, not checked ones, and every projection inherits them. They are
editable and labelled, but they should be confirmed against belastingdienst.nl.

**VAT edge cases are not modelled**: reverse-charge (`BTW verlegd`), the small
business scheme (`KOR`), and intra-EU supplies.

## Product

**Retire the JSON backup/restore** once AI import works. Requiring an exact file
shape is too rigid to ship to anyone else; it exists today because it is the only
safe path into the app.

**Invoice line items are hours × rate only.** Fixed-fee work has to be entered as
`hours = 1`, which then reads wrong on the PDF. Multiple line items are also not
possible.

**Invoice document language should follow the client, not the interface.** The UI
is fully NL/EN, but the printed invoice is deliberately left fixed: flipping the
app to Dutch to read your own books must not change what a client's PDF says.
Belongs on the client profile.

**README screenshots predate the light/dark restyle** and the Belastingdienst tab.

## Housekeeping

- `public/seed/backfill.json` is a one-time local backfill, gitignored, holding
  real bookkeeping data. It must never be committed.
- Money is stored as floats and summed in integer cents via `sumEuros`. Storing
  cents directly would remove the class of problem entirely.
