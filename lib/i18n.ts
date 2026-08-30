'use client';

import { useLocalStorageState } from '@/lib/local-storage';

export type Language = 'en' | 'nl';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'nl', label: 'NL' },
];

/**
 * The app mixed "VAT" and "BTW" arbitrarily. The rule now: English says VAT,
 * Dutch says BTW, and Belastingdienst keeps its name in both because that is the
 * institution. Tax-chain terms are given bilingually in English, since the Dutch
 * word is what appears on the Belastingdienst forms.
 */
type Entry = { en: string; nl: string };

export const STRINGS = {
  'nav.dashboard': { en: 'Dashboard', nl: 'Dashboard' },
  'nav.invoices': { en: 'Invoices', nl: 'Facturen' },
  'nav.profiles': { en: 'Profiles', nl: 'Profielen' },
  'nav.expenses': { en: 'Expenses', nl: 'Uitgaven' },
  'nav.vatSummary': { en: 'VAT Summary', nl: 'BTW-overzicht' },
  'nav.belastingdienst': { en: 'Belastingdienst', nl: 'Belastingdienst' },

  'common.vat': { en: 'VAT', nl: 'BTW' },
  'common.year': { en: 'Year', nl: 'Jaar' },
  'common.taxYear': { en: 'Tax year', nl: 'Belastingjaar' },
  'common.allYears': { en: 'All years', nl: 'Alle jaren' },
  'common.allQuarters': { en: 'All quarters', nl: 'Alle kwartalen' },
  'common.quarter': { en: 'Quarter', nl: 'Kwartaal' },
  'common.back': { en: '← Back', nl: '← Terug' },
  'common.toPay': { en: 'To pay', nl: 'Te betalen' },
  'common.toReclaim': { en: 'To reclaim', nl: 'Terug te vorderen' },
  'common.exVat': { en: 'Revenue ex VAT', nl: 'Omzet excl. BTW' },
  'common.paid': { en: 'Paid', nl: 'Betaald' },
  'common.unpaid': { en: 'Unpaid', nl: 'Niet betaald' },
  'common.settled': { en: 'Filed and paid', nl: 'Aangegeven en betaald' },
  'common.showTable': { en: 'Show data table', nl: 'Toon datatabel' },
  'common.hideTable': { en: 'Hide data table', nl: 'Verberg datatabel' },

  'vat.title': { en: 'VAT Summary', nl: 'BTW-overzicht' },
  'vat.subtitle': {
    en: 'VAT charged on invoices minus deductible VAT on expenses, per quarter.',
    nl: 'BTW op facturen minus aftrekbare BTW op uitgaven, per kwartaal.',
  },
  'vat.netToPay': { en: 'VAT to pay', nl: 'Te betalen BTW' },
  'vat.netToReclaim': { en: 'VAT to reclaim', nl: 'Terug te vorderen BTW' },
  'vat.charged': { en: 'VAT charged (output)', nl: 'Afgedragen BTW (output)' },
  'vat.deductible': { en: 'VAT deductible (input)', nl: 'Aftrekbare BTW (voorbelasting)' },
  'vat.chargedShort': { en: 'VAT charged', nl: 'Afgedragen BTW' },
  'vat.deductibleShort': { en: 'VAT deductible', nl: 'Aftrekbare BTW' },
  'vat.expensesExVat': { en: 'Expenses ex VAT', nl: 'Uitgaven excl. BTW' },
  'vat.stillToPay': { en: 'Still to pay', nl: 'Nog te betalen' },
  'vat.stillToPayHint': { en: 'Not yet filed and paid:', nl: 'Nog niet aangegeven en betaald:' },
  'vat.allSettled': {
    en: 'Every quarter this year is marked filed and paid.',
    nl: 'Elk kwartaal dit jaar is gemarkeerd als aangegeven en betaald.',
  },
  'vat.grossHint': {
    en: '{gross} was charged across all of {year}, including quarters already settled.',
    nl: '{gross} is over heel {year} in rekening gebracht, inclusief al afgeronde kwartalen.',
  },
  'vat.markSettled': { en: 'Mark as filed and paid', nl: 'Markeer als aangegeven en betaald' },
  'vat.deadline': { en: 'Filing deadline', nl: 'Aangiftedeadline' },
  'vat.noData': { en: 'No invoices or expenses yet.', nl: 'Nog geen facturen of uitgaven.' },
  'vat.excluded': {
    en: 'Excluded from these totals because of a missing, invalid or implausible date (for example a mistyped year):',
    nl: 'Niet meegeteld door een ontbrekende, ongeldige of onwaarschijnlijke datum (bijvoorbeeld een verkeerd jaartal):',
  },
  'vat.fixDates': { en: 'Fix the dates so they are counted.', nl: 'Corrigeer de datums zodat ze meetellen.' },
  'vat.disclaimer': {
    en: 'Figures are based on invoice and expense dates as entered. Reverse-charge, KOR and intra-EU supplies are not modelled — check those cases against your own situation before filing.',
    nl: 'Bedragen zijn gebaseerd op de ingevoerde factuur- en uitgavendatums. Verlegde BTW, KOR en intracommunautaire leveringen zijn niet meegenomen — controleer die gevallen zelf vóór de aangifte.',
  },

  'bd.title': { en: 'Belastingdienst', nl: 'Belastingdienst' },
  'bd.subtitle': {
    en: 'What you have earned, what you still have to collect, and what the year ends at.',
    nl: 'Wat je hebt verdiend, wat je nog moet ontvangen, en waar het jaar op uitkomt.',
  },
  'bd.download': { en: 'Download {year} as JSON', nl: 'Download {year} als JSON' },
  'bd.invoicedThisYear': { en: 'Invoiced this year', nl: 'Gefactureerd dit jaar' },
  'bd.outstanding': { en: 'Still outstanding', nl: 'Nog openstaand' },
  'bd.outstandingHint': {
    en: 'Client invoices not yet marked paid',
    nl: 'Facturen aan klanten die nog niet als betaald zijn gemarkeerd',
  },
  'bd.overdue': { en: 'Overdue', nl: 'Achterstallig' },
  'bd.nothingOverdue': { en: 'Nothing past due', nl: 'Niets over de vervaldatum' },
  'bd.netVatYear': { en: 'Net VAT for the year', nl: 'Netto BTW over het jaar' },
  'bd.revenueSplit': { en: 'Where the revenue goes', nl: 'Waar de omzet heen gaat' },
  'bd.takeHome': { en: 'Take-home (est.)', nl: 'Netto over (schatting)' },
  'bd.incomeTaxEst': { en: 'Income tax (est.)', nl: 'Inkomstenbelasting (schatting)' },
  'bd.businessExpenses': { en: 'Business expenses', nl: 'Zakelijke kosten' },
  'bd.netVatPerQuarter': { en: 'Net VAT per quarter', nl: 'Netto BTW per kwartaal' },
  'bd.projection': { en: 'Projection to 31 December', nl: 'Prognose tot 31 december' },
  'bd.projectedRevenue': { en: 'Projected revenue', nl: 'Verwachte omzet' },
  'bd.projectedProfit': { en: 'Projected profit', nl: 'Verwachte winst' },
  'bd.projectedTax': { en: 'Projected income tax', nl: 'Verwachte inkomstenbelasting' },
  'bd.netProfit': { en: 'Net profit (est.)', nl: 'Nettowinst (schatting)' },
  'bd.projectedNetProfit': { en: 'Projected net profit', nl: 'Verwachte nettowinst' },
  'bd.onProfitSoFar': { en: 'On profit so far', nl: 'Over de winst tot nu toe' },
  'bd.projectedFullYear': { en: 'Projected full year', nl: 'Verwacht over het hele jaar' },
  'bd.nextDeadline': { en: 'Next VAT deadline', nl: 'Volgende BTW-deadline' },
  'bd.howBuilt': {
    en: 'How the income tax estimate is built',
    nl: 'Hoe de schatting van de inkomstenbelasting is opgebouwd',
  },
  'bd.editAssumptions': { en: 'Edit assumptions', nl: 'Uitgangspunten aanpassen' },
  'bd.hideAssumptions': { en: 'Hide assumptions', nl: 'Verberg uitgangspunten' },

  // Tax chain: English keeps the Dutch term alongside, because that is the word
  // that appears on the actual Belastingdienst forms.
  'tax.revenue': { en: 'Revenue ex VAT (omzet excl. BTW)', nl: 'Omzet excl. BTW' },
  'tax.expenses': { en: 'Business expenses ex VAT (zakelijke kosten)', nl: 'Zakelijke kosten excl. BTW' },
  'tax.profit': { en: 'Profit (winst)', nl: 'Winst' },
  'tax.ondernemersaftrek': { en: 'Entrepreneur deduction (ondernemersaftrek)', nl: 'Ondernemersaftrek' },
  'tax.mkb': { en: 'SME profit exemption (MKB-winstvrijstelling)', nl: 'MKB-winstvrijstelling' },
  'tax.taxable': { en: 'Taxable income (belastbaar inkomen)', nl: 'Belastbaar inkomen' },
  'tax.box1': { en: 'Income tax box 1 (inkomstenbelasting box 1)', nl: 'Inkomstenbelasting box 1' },
  'tax.credits': { en: 'Tax credits (heffingskortingen)', nl: 'Heffingskortingen' },
  'tax.zvw': { en: 'Health insurance contribution (Zvw-bijdrage)', nl: 'Zvw-bijdrage' },
  'tax.total': { en: 'Estimated tax owed', nl: 'Geschatte verschuldigde belasting' },
  'tax.basisNote': {
    en: 'The rows above are calculated on the profit recorded so far.',
    nl: 'De regels hierboven zijn berekend over de tot nu toe geboekte winst.',
  },
  'tax.zelfstandigenaftrek': { en: 'Self-employed deduction / zelfstandigenaftrek (€)', nl: 'Zelfstandigenaftrek (€)' },
  'tax.startersaftrek': { en: 'Starter deduction / startersaftrek (€)', nl: 'Startersaftrek (€)' },
  'tax.mkbPercent': { en: 'SME profit exemption / MKB-winstvrijstelling (%)', nl: 'MKB-winstvrijstelling (%)' },
  'tax.creditsField': { en: 'Tax credits / heffingskortingen (€)', nl: 'Heffingskortingen (€)' },
  'tax.zvwPercent': { en: 'Health contribution / Zvw (%)', nl: 'Zvw-percentage (%)' },
  'tax.zvwMax': { en: 'Zvw maximum base (€)', nl: 'Zvw maximum grondslag (€)' },
  'tax.brackets': { en: 'Box 1 brackets (schijven)', nl: 'Schijven box 1' },
  'tax.reset': { en: 'Reset to defaults', nl: 'Terug naar standaardwaarden' },
  'tax.effective': { en: 'Effective rate on profit', nl: 'Effectief tarief over de winst' },
  'tax.disclaimer': {
    en: 'This is an estimate for planning how much to set aside, not a filing figure or tax advice. The rates above ship as editable starting points — check them against belastingdienst.nl for {year}, and confirm anything you file with your accountant.',
    nl: 'Dit is een schatting om te bepalen hoeveel je opzij zet, geen aangiftebedrag of belastingadvies. De tarieven hierboven zijn aanpasbare uitgangspunten — controleer ze op belastingdienst.nl voor {year} en bespreek je aangifte met je boekhouder.',
  },

  'exp.title': { en: 'Expenses', nl: 'Uitgaven' },
  'exp.exVat': { en: 'Ex VAT', nl: 'Excl. BTW' },
  'exp.deductibleVat': { en: 'Deductible VAT', nl: 'Aftrekbare BTW' },
  'exp.inclVat': { en: 'Incl VAT', nl: 'Incl. BTW' },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

export function useLanguage() {
  return useLocalStorageState<Language>('language', 'en');
}

/** Translate a key, substituting {placeholders}. */
export function translate(key: StringKey, language: Language, vars?: Record<string, string | number>) {
  const entry = STRINGS[key] as Entry;
  let text = entry ? entry[language] : (key as string);

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }

  return text;
}

export function useT() {
  const [language] = useLanguage();
  return {
    language,
    t: (key: StringKey, vars?: Record<string, string | number>) => translate(key, language, vars),
  };
}

const MONTHS: Record<Language, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  nl: ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'],
};

export const MONTHS_SHORT: Record<Language, string[]> = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  nl: ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'],
};

/** "January – March" for Q1, so a quarter never has to be decoded. */
export function quarterMonths(quarter: number, language: Language) {
  const start = (quarter - 1) * 3;
  return `${MONTHS[language][start]} – ${MONTHS[language][start + 2]}`;
}
