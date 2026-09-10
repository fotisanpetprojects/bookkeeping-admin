'use client';

import { useLocalStorageState } from './local-storage.ts';

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
  'nav.home': { en: 'Home', nl: 'Home' },
  'nav.invoices': { en: 'Invoices', nl: 'Facturen' },
  'nav.profiles': { en: 'Profiles', nl: 'Profielen' },
  'nav.expenses': { en: 'Expenses', nl: 'Uitgaven' },
  'nav.vatSummary': { en: 'VAT Summary', nl: 'BTW-overzicht' },
  'nav.belastingdienst': { en: 'Tax office', nl: 'Belastingdienst' },

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

  'bd.title': { en: 'Tax office', nl: 'Belastingdienst' },
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
  'bd.revenueCentre': { en: 'Revenue', nl: 'Omzet' },
  'bd.revenueSplit': { en: 'Where the revenue goes', nl: 'Waar de omzet heen gaat' },
  'bd.revenueSplitHint': {
    en: 'Your {year} invoiced revenue ex VAT, split by what leaves again. VAT is not shown here — it is collected on the tax office\'s behalf, so it was never your revenue. It has its own figure above.',
    nl: 'Je gefactureerde omzet excl. BTW over {year}, verdeeld naar wat er weer afgaat. BTW staat hier niet bij — die wordt geïnd voor de Belastingdienst en was dus nooit jouw omzet. Die heeft hierboven een eigen bedrag.',
  },
  'bd.lossYear': {
    en: 'Expenses of {expenses} exceed revenue of {revenue}, so {year} is a loss of {loss}. There is nothing to split up, and no income tax is estimated on a loss.',
    nl: 'Kosten van {expenses} zijn hoger dan de omzet van {revenue}, dus {year} is een verlies van {loss}. Er valt niets te verdelen, en over verlies wordt geen inkomstenbelasting geschat.',
  },
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


  'inv.title': { en: 'Invoices', nl: 'Facturen' },
  'inv.subtitle': {
    en: 'Build invoices from saved profiles and calculate VAT from hours and rate.',
    nl: 'Stel facturen samen uit opgeslagen profielen en bereken de BTW uit uren en tarief.',
  },
  'inv.details': { en: 'Invoice details', nl: 'Factuurgegevens' },
  'inv.number': { en: 'Invoice number', nl: 'Factuurnummer' },
  'inv.date': { en: 'Invoice date', nl: 'Factuurdatum' },
  'inv.period': { en: 'Service period', nl: 'Dienstperiode' },
  'inv.terms': { en: 'Payment terms (days)', nl: 'Betaaltermijn (dagen)' },
  'inv.workAndVat': { en: 'Work and VAT', nl: 'Werk en BTW' },
  'inv.description': { en: 'Description', nl: 'Omschrijving' },
  'inv.hours': { en: 'Hours', nl: 'Uren' },
  'inv.rate': { en: 'Rate (EUR)', nl: 'Tarief (EUR)' },
  'inv.vatRate': { en: 'VAT rate', nl: 'BTW-tarief' },
  'inv.subtotal': { en: 'Subtotal', nl: 'Subtotaal' },
  'inv.vatAmount': { en: 'VAT amount', nl: 'BTW-bedrag' },
  'inv.totalIncl': { en: 'Total incl. VAT', nl: 'Totaal incl. BTW' },
  'inv.save': { en: 'Save invoice', nl: 'Factuur opslaan' },
  'inv.update': { en: 'Update invoice', nl: 'Factuur bijwerken' },
  'inv.cancelEdit': { en: 'Cancel edit', nl: 'Bewerken annuleren' },
  'inv.saved': { en: 'Saved invoices', nl: 'Opgeslagen facturen' },
  'inv.savedHint': {
    en: 'Sort any column. Actions are on the right; the checkbox marks an invoice paid, and hovering it shows the payment date.',
    nl: 'Sorteer op elke kolom. Acties staan rechts; het vinkje markeert een factuur als betaald en bij hover zie je de betaaldatum.',
  },
  'inv.from': { en: 'From', nl: 'Van' },
  'inv.to': { en: 'To', nl: 'Aan' },
  'inv.selectClient': { en: 'Select a saved client profile', nl: 'Kies een opgeslagen klantprofiel' },
  'inv.none': { en: 'No invoices yet.', nl: 'Nog geen facturen.' },
  'inv.count': { en: 'invoice(s)', nl: 'factu(u)r(en)' },
  'inv.paidOpen': { en: '{paid} paid · {open} open', nl: '{paid} betaald · {open} open' },
  'inv.colInvoice': { en: 'Invoice', nl: 'Factuur' },
  'inv.colDate': { en: 'Date', nl: 'Datum' },
  'inv.colClient': { en: 'Client', nl: 'Klant' },
  'inv.colExVat': { en: 'Ex VAT', nl: 'Excl. BTW' },
  'inv.colVat': { en: 'VAT', nl: 'BTW' },
  'inv.colTotal': { en: 'Total', nl: 'Totaal' },
  'inv.colPaid': { en: 'Paid', nl: 'Betaald' },
  'inv.colActions': { en: 'Actions', nl: 'Acties' },
  'inv.statusPaid': { en: 'Paid', nl: 'Betaald' },
  'inv.statusOverdue': { en: 'Overdue', nl: 'Achterstallig' },
  'inv.statusOpen': { en: 'Open', nl: 'Open' },
  'inv.paidOn': { en: 'Paid on {date}', nl: 'Betaald op {date}' },
  'inv.wasDue': { en: 'Overdue — was due {date}', nl: 'Achterstallig — vervallen op {date}' },
  'inv.due': { en: 'Due {date}', nl: 'Vervalt {date}' },
  'inv.actLoad': { en: 'Load into preview', nl: 'In voorbeeld laden' },
  'inv.actPrint': { en: 'Download PDF', nl: 'PDF downloaden' },
  'inv.actEdit': { en: 'Edit invoice', nl: 'Factuur bewerken' },
  'inv.actDelete': { en: 'Delete invoice', nl: 'Factuur verwijderen' },

  'cl.title': { en: 'Profiles', nl: 'Profielen' },
  'cl.business': { en: 'Your business profiles', nl: 'Je bedrijfsprofielen' },
  'cl.clients': { en: 'Client profiles', nl: 'Klantprofielen' },
  'cl.businessName': { en: 'Business name', nl: 'Bedrijfsnaam' },
  'cl.contactName': { en: 'Contact name', nl: 'Contactpersoon' },
  'cl.companyName': { en: 'Company name', nl: 'Bedrijfsnaam' },
  'cl.attention': { en: 'Attention of', nl: 'Ter attentie van' },
  'cl.street': { en: 'Street address', nl: 'Adres' },
  'cl.postcodeCity': { en: 'Postal code and city', nl: 'Postcode en plaats' },
  'cl.kvk': { en: 'KvK number', nl: 'KvK-nummer' },
  'cl.vatNumber': { en: 'VAT number', nl: 'BTW-nummer' },
  'cl.iban': { en: 'IBAN', nl: 'IBAN' },
  'cl.bank': { en: 'Bank name', nl: 'Banknaam' },
  'cl.logo': { en: 'Logo / letterhead', nl: 'Logo / briefhoofd' },
  'cl.save': { en: 'Save profile', nl: 'Profiel opslaan' },
  'cl.remove': { en: 'Remove', nl: 'Verwijderen' },
  'cl.noBusiness': { en: 'No business profiles saved yet.', nl: 'Nog geen bedrijfsprofielen opgeslagen.' },
  'cl.noClients': { en: 'No client profiles saved yet.', nl: 'Nog geen klantprofielen opgeslagen.' },



  'nav.finance': { en: 'Finance', nl: 'Financiën' },
  'fin.title': { en: 'Finance', nl: 'Financiën' },
  'fin.subtitle': {
    en: 'What comes in, what goes out, and where the year is heading.',
    nl: 'Wat er binnenkomt, wat eruit gaat, en waar het jaar op uitkomt.',
  },
  'fin.import': { en: 'Import a bank statement', nl: 'Bankafschrift importeren' },
  'fin.importHint': {
    en: 'A CSV export from your bank. It is read in this browser and never uploaded — nothing leaves your machine.',
    nl: 'Een CSV-export van je bank. Deze wordt in deze browser gelezen en nooit geüpload — er verlaat niets je machine.',
  },
  'fin.imported': {
    en: 'Imported {added} new transaction(s) from {from} to {to}. {duplicates} already present.',
    nl: '{added} nieuwe transactie(s) geïmporteerd van {from} tot {to}. {duplicates} al aanwezig.',
  },
  'fin.noData': {
    en: 'No transactions yet. Use the upload button above to import a CSV export from your bank — it is read here in your browser and never uploaded anywhere.',
    nl: 'Nog geen transacties. Gebruik de uploadknop hierboven om een CSV-export van je bank te importeren — die wordt hier in je browser gelezen en nergens naartoe gestuurd.',
  },
  'fin.moneyIn': { en: 'Money in', nl: 'Inkomend' },
  'fin.spending': { en: 'Spending', nl: 'Uitgaven' },
  'fin.net': { en: 'Left over', nl: 'Overgehouden' },
  'fin.balance': { en: 'Latest balance', nl: 'Laatste saldo' },
  'fin.fixed': { en: 'Fixed commitments', nl: 'Vaste lasten' },
  'fin.flexible': { en: 'Flexible spending', nl: 'Variabele uitgaven' },
  'fin.perMonth': { en: '{amount} a month on average', nl: 'gemiddeld {amount} per maand' },
  'fin.coverage': {
    en: 'Based on {days} days of {year} — the dashed part of the chart is projected from that pace.',
    nl: 'Gebaseerd op {days} dagen van {year} — het gestippelde deel van de grafiek is daarop gebaseerd.',
  },
  'fin.projection': { en: 'Where the year lands', nl: 'Waar het jaar uitkomt' },
  'fin.cumIn': { en: 'Money in', nl: 'Inkomend' },
  'fin.cumSpending': { en: 'Spending', nl: 'Uitgaven' },
  'fin.projectedIn': { en: 'Projected money in', nl: 'Verwacht inkomend' },
  'fin.projectedSpending': { en: 'Projected spending', nl: 'Verwachte uitgaven' },
  'fin.projectedNet': { en: 'Projected left over', nl: 'Verwacht overschot' },
  'fin.breakdown': { en: 'Where the money goes', nl: 'Waar het geld heen gaat' },
  'fin.breakdownHint': {
    en: 'Transfers between your own accounts, card repayments and investments are left out — moving money is not spending it.',
    nl: 'Overboekingen tussen eigen rekeningen, creditcard-aflossingen en beleggingen tellen niet mee — geld verplaatsen is geen uitgave.',
  },
  'fin.tidy': { en: 'Tidy up the unknowns', nl: 'Onbekende posten opruimen' },
  'fin.tidyHint': {
    en: 'These did not match any rule. Assign a merchant once and every transaction from it is filed, now and in future imports.',
    nl: 'Deze matchten geen enkele regel. Wijs een winkelier één keer toe en al zijn transacties worden gerubriceerd, nu en bij toekomstige imports.',
  },
  'fin.tidyDone': { en: 'Everything is categorised.', nl: 'Alles is gerubriceerd.' },
  'fin.unknownWarning': {
    en: '{amount} across {count} transaction(s) is still uncategorised, so the split below is incomplete.',
    nl: '{amount} verdeeld over {count} transactie(s) is nog niet gerubriceerd, dus de verdeling hieronder is onvolledig.',
  },

  // Validation and outcome messages. These were English string literals in the
  // pages, so a Dutch reader got English the moment anything went wrong.
  'msg.fillClientFields': {
    en: 'Please fill in company name, street address, and postal code/city.',
    nl: 'Vul bedrijfsnaam, adres en postcode/plaats in.',
  },
  'msg.fillExpense': {
    en: 'Please fill in date, supplier and amount.',
    nl: 'Vul datum, leverancier en bedrag in.',
  },
  'msg.expenseDateRange': {
    en: 'That date is outside the range this app accepts, and cannot be in the future.',
    nl: 'Die datum valt buiten het bereik dat deze app accepteert, en mag niet in de toekomst liggen.',
  },
  'msg.amountInvalid': { en: 'Amount ex VAT must be a valid number.', nl: 'Bedrag excl. BTW moet een geldig getal zijn.' },
  'msg.customVatInvalid': { en: 'Please enter a valid custom VAT %.', nl: 'Voer een geldig aangepast BTW-percentage in.' },
  'msg.expenseSaved': { en: 'Saved the expense from {supplier}.', nl: 'Uitgave van {supplier} opgeslagen.' },
  'msg.expenseUpdated': { en: 'Updated the expense from {supplier}.', nl: 'Uitgave van {supplier} bijgewerkt.' },
  'msg.expenseDeleted': { en: 'Deleted the expense from {supplier}.', nl: 'Uitgave van {supplier} verwijderd.' },
  'msg.fillInvoice': {
    en: 'Please fill in invoice number, invoice date, period, description, hours, and rate.',
    nl: 'Vul factuurnummer, factuurdatum, periode, omschrijving, uren en tarief in.',
  },
  'msg.completeProfile': { en: 'Please complete your business profile first.', nl: 'Maak eerst je bedrijfsprofiel compleet.' },
  'msg.selectClient': { en: 'Please select a saved client profile.', nl: 'Kies een opgeslagen klantprofiel.' },
  'msg.invoiceDateRange': {
    en: 'Invoice date must be within the last year and no more than a year ahead.',
    nl: 'De factuurdatum moet binnen het afgelopen jaar liggen en maximaal een jaar vooruit.',
  },
  'msg.hoursPositive': { en: 'Hours must be greater than 0.', nl: 'Uren moeten groter dan 0 zijn.' },
  'msg.ratePositive': { en: 'Rate must be greater than 0.', nl: 'Tarief moet groter dan 0 zijn.' },
  'msg.invoiceDeleted': { en: 'Deleted invoice {number}.', nl: 'Factuur {number} verwijderd.' },
  'msg.backupDownloaded': {
    en: 'Backup downloaded. Keep it somewhere outside this browser.',
    nl: 'Back-up gedownload. Bewaar hem ergens buiten deze browser.',
  },
  'msg.backupFailed': { en: 'Could not generate the backup file.', nl: 'Kon het back-upbestand niet maken.' },
  'msg.safetyBackupFailed': {
    en: 'Could not download the safety backup, so nothing was replaced.',
    nl: 'Kon de veiligheidsback-up niet downloaden, dus er is niets vervangen.',
  },
  'msg.settingsFailed': { en: 'Could not save these settings.', nl: 'Kon deze instellingen niet opslaan.' },
  'msg.fileUnreadable': { en: 'Could not read that file.', nl: 'Kon dat bestand niet lezen.' },

  'common.confirm': { en: 'Confirm', nl: 'Bevestigen' },
  'inv.deleteConfirm': {
    en: 'Delete invoice {number} ({amount})? This cannot be undone.',
    nl: 'Factuur {number} ({amount}) verwijderen? Dit kan niet ongedaan worden gemaakt.',
  },
  'exp.deleteConfirm': {
    en: 'Delete the {amount} expense from {supplier} on {date}? This cannot be undone.',
    nl: 'De uitgave van {amount} bij {supplier} op {date} verwijderen? Dit kan niet ongedaan worden gemaakt.',
  },
  'backup.replaceConfirm': {
    en: 'Replace mode deletes everything currently stored in this browser and puts the backup in its place. A safety backup of your current data is downloaded first.',
    nl: 'Vervangen wist alles wat nu in deze browser staat en zet de back-up ervoor in de plaats. Er wordt eerst een veiligheidsback-up van je huidige gegevens gedownload.',
  },
  'common.close': { en: 'Close', nl: 'Sluiten' },
  'common.previous': { en: 'Previous', nl: 'Vorige' },
  'common.next': { en: 'Next', nl: 'Volgende' },
  'common.pageOf': { en: 'Page {page} of {pages}', nl: 'Pagina {page} van {pages}' },
  'fin.setByHand': { en: 'set by hand', nl: 'handmatig ingesteld' },
  'fin.totalOut': { en: 'Total out', nl: 'Totaal uit' },
  'fin.viewTransactions': { en: 'Show the transactions behind this', nl: 'Toon de transacties hierachter' },
  'nav.settings': { en: 'Settings', nl: 'Instellingen' },
  'set.title': { en: 'Settings', nl: 'Instellingen' },
  'set.subtitle': {
    en: 'Security, backups and import. Everything here affects only this browser.',
    nl: 'Beveiliging, back-ups en import. Alles hier geldt alleen voor deze browser.',
  },
  'set.security': { en: 'Security', nl: 'Beveiliging' },
  'vault.changeTitle': { en: 'Change your passphrase', nl: 'Wachtwoordzin wijzigen' },
  'vault.currentPassphrase': { en: 'Current passphrase', nl: 'Huidige wachtwoordzin' },
  'vault.newPassphrase': { en: 'New passphrase', nl: 'Nieuwe wachtwoordzin' },
  'vault.changeAction': { en: 'Change passphrase', nl: 'Wachtwoordzin wijzigen' },
  'vault.changed': { en: 'Passphrase changed. Your recovery code still works.', nl: 'Wachtwoordzin gewijzigd. Je herstelcode werkt nog steeds.' },
  'vault.newCodeTitle': { en: 'Issue a new recovery code', nl: 'Nieuwe herstelcode aanmaken' },
  'vault.newCodeBody': {
    en: 'Use this if you have lost the old code, or if someone may have seen it. The previous code stops working immediately.',
    nl: 'Gebruik dit als je de oude code kwijt bent, of als iemand hem gezien kan hebben. De vorige code werkt daarna niet meer.',
  },
  'vault.newCodeAction': { en: 'Issue a new code', nl: 'Nieuwe code aanmaken' },
  'vault.removeTitle': { en: 'Turn encryption off', nl: 'Versleuteling uitschakelen' },
  'vault.removeBody': {
    en: 'Decrypts everything back to ordinary browser storage. Anyone who opens this app on your computer will be able to read your books again.',
    nl: 'Ontsleutelt alles terug naar gewone browseropslag. Iedereen die deze app op jouw computer opent kan je boeken dan weer lezen.',
  },
  'vault.removeAction': { en: 'Turn it off', nl: 'Uitschakelen' },
  'vault.removeConfirm': {
    en: 'Decrypt everything back into ordinary browser storage? Your books will no longer be protected by a passphrase.',
    nl: 'Alles terug ontsleutelen naar gewone browseropslag? Je boeken zijn dan niet meer beveiligd met een wachtwoordzin.',
  },
  'vault.autoLock': { en: 'Lock automatically when idle', nl: 'Automatisch vergrendelen bij inactiviteit' },
  'vault.autoLockNever': { en: 'Never', nl: 'Nooit' },
  'vault.autoLockMinutes': { en: 'After {count} minutes', nl: 'Na {count} minuten' },
  'vault.notSetUp': {
    en: 'No passphrase is set, so these records are readable by anyone using this browser.',
    nl: 'Er is geen wachtwoordzin ingesteld, dus deze gegevens zijn leesbaar voor iedereen die deze browser gebruikt.',
  },
  'vault.panelTitle': { en: 'Lock with a passphrase', nl: 'Vergrendelen met een wachtwoordzin' },
  'vault.panelBody': {
    en: 'Encrypt everything stored in this browser. Without the passphrase the records are unreadable, including to anyone who opens this app on your computer.',
    nl: 'Versleutel alles wat in deze browser staat. Zonder de wachtwoordzin zijn de gegevens onleesbaar, ook voor wie deze app op jouw computer opent.',
  },
  'vault.enable': { en: 'Set a passphrase', nl: 'Wachtwoordzin instellen' },
  'vault.enabled': { en: 'This browser is protected by a passphrase.', nl: 'Deze browser is beveiligd met een wachtwoordzin.' },
  'vault.lock': { en: 'Lock', nl: 'Vergrendelen' },
  'vault.setupTitle': { en: 'Choose a passphrase', nl: 'Kies een wachtwoordzin' },
  'vault.setupBody': {
    en: 'Everything already in this browser will be encrypted with it. Pick something long that you will not forget — a sentence works better than a word.',
    nl: 'Alles wat al in deze browser staat wordt hiermee versleuteld. Kies iets langs dat je niet vergeet — een zin werkt beter dan een woord.',
  },
  'vault.passphrase': { en: 'Passphrase', nl: 'Wachtwoordzin' },
  'vault.repeat': { en: 'Repeat it', nl: 'Herhaal' },
  'vault.tooShort': { en: 'Use at least {min} characters.', nl: 'Gebruik minstens {min} tekens.' },
  'vault.mismatch': { en: 'Those two do not match.', nl: 'Die twee komen niet overeen.' },
  'vault.noResetWarning': {
    en: 'There is no password reset. Nothing stores this passphrase, which is exactly why nobody else can read your books — but it also means we cannot recover it for you. You will be given a recovery code next; keep it.',
    nl: 'Er is geen wachtwoordherstel. De wachtwoordzin wordt nergens opgeslagen — precies daarom kan niemand anders je boeken lezen, maar wij kunnen hem ook niet herstellen. Je krijgt hierna een herstelcode; bewaar die.',
  },
  'vault.createVault': { en: 'Encrypt this browser', nl: 'Deze browser versleutelen' },
  'vault.working': { en: 'Working…', nl: 'Bezig…' },
  'vault.recoveryTitle': { en: 'Save your recovery code', nl: 'Bewaar je herstelcode' },
  'vault.recoveryBody': {
    en: 'This is the only way back in if you forget your passphrase. It is shown once and never stored anywhere we can reach. Treat it like a spare key — anyone holding it can open your books.',
    nl: 'Dit is de enige manier terug als je je wachtwoordzin vergeet. Hij wordt één keer getoond en nergens bewaard waar wij bij kunnen. Behandel hem als een reservesleutel — wie hem heeft, kan je boeken openen.',
  },
  'vault.download': { en: 'Download it', nl: 'Downloaden' },
  'vault.copy': { en: 'Copy', nl: 'Kopiëren' },
  'vault.confirmSaved': {
    en: 'I have saved this somewhere safe. I understand it cannot be shown again.',
    nl: 'Ik heb dit veilig opgeslagen. Ik begrijp dat hij niet opnieuw getoond kan worden.',
  },
  'vault.continue': { en: 'Continue', nl: 'Doorgaan' },
  'vault.lockedTitle': { en: 'Locked', nl: 'Vergrendeld' },
  'vault.lockedBody': {
    en: 'Enter your passphrase to read the books stored in this browser.',
    nl: 'Voer je wachtwoordzin in om de boeken in deze browser te lezen.',
  },
  'vault.unlock': { en: 'Unlock', nl: 'Ontgrendelen' },
  'vault.forgot': { en: 'I have forgotten it — use my recovery code', nl: 'Vergeten — gebruik mijn herstelcode' },
  'vault.usePassphrase': { en: 'Use my passphrase instead', nl: 'Toch mijn wachtwoordzin gebruiken' },
  'vault.recoveryCode': { en: 'Recovery code', nl: 'Herstelcode' },

  'acc.title': { en: 'Your bank accounts', nl: 'Je bankrekeningen' },
  'acc.body': {
    en: 'Name each imported account and say what it is for. Business income is revenue you invoice; personal income is what you actually pay yourself. Money moving between two of your own accounts is never counted as either.',
    nl: 'Geef elke geïmporteerde rekening een naam en geef aan waarvoor die is. Zakelijke inkomsten zijn omzet die je factureert; privé-inkomsten zijn wat je jezelf uitbetaalt. Geld tussen twee eigen rekeningen telt nooit als een van beide.',
  },
  'acc.none': {
    en: 'No accounts yet. Import a bank statement on the Finance page first.',
    nl: 'Nog geen rekeningen. Importeer eerst een bankafschrift op de Financiën-pagina.',
  },
  'acc.name': { en: 'Name', nl: 'Naam' },
  'acc.namePlaceholder': { en: 'e.g. Personal current account', nl: 'bijv. Privé betaalrekening' },
  'acc.kind': { en: 'Used for', nl: 'Gebruikt voor' },
  'acc.personal': { en: 'Personal', nl: 'Privé' },
  'acc.business': { en: 'Business', nl: 'Zakelijk' },
  'acc.transactions': { en: '{count} transaction(s)', nl: '{count} transactie(s)' },

  'fin.allAccountsOption': { en: 'All accounts', nl: 'Alle rekeningen' },
  'fin.personalOnly': { en: 'Personal only', nl: 'Alleen privé' },
  'fin.businessOnly': { en: 'Business only', nl: 'Alleen zakelijk' },
  'fin.internal': { en: 'From your other accounts', nl: 'Van je andere rekeningen' },
  'fin.internalHint': {
    en: '{amount} arrived here from another account of yours across {count} transfer(s). It is shown because the money did arrive, and left out of income because you did not earn it twice.',
    nl: '{amount} kwam hier binnen vanaf een eigen rekening in {count} overboeking(en). Het staat er omdat het geld wél binnenkwam, en telt niet mee als inkomsten omdat je het niet twee keer hebt verdiend.',
  },

  'acc.clearAll': { en: 'Delete all imported transactions', nl: 'Alle geïmporteerde transacties verwijderen' },
  'acc.clearHint': {
    en: 'Start over with a clean import. Your invoices, expenses and profiles are untouched.',
    nl: 'Begin opnieuw met een schone import. Je facturen, uitgaven en profielen blijven ongemoeid.',
  },
  'acc.clearConfirm': {
    en: 'Delete all {count} imported transactions, including any categories you set by hand? Your invoices and expenses are not affected.',
    nl: 'Alle {count} geïmporteerde transacties verwijderen, inclusief categorieën die je zelf hebt ingesteld? Je facturen en uitgaven blijven ongemoeid.',
  },

  'rec.title': { en: 'Does this add up?', nl: 'Klopt het?' },
  'rec.info': {
    en: 'Every category on this page is a judgement. The balance your bank printed on each line is not. This checks the two against each other: opening balance, plus everything that moved, should equal the closing balance. If it does, nothing is being counted twice or missed.',
    nl: 'Elke categorie op deze pagina is een inschatting. Het saldo dat je bank op elke regel afdrukt niet. Dit vergelijkt beide: beginsaldo plus alles wat er bewoog hoort gelijk te zijn aan het eindsaldo. Klopt dat, dan wordt er niets dubbel geteld of overgeslagen.',
  },
  'rec.balances': { en: 'Balances to the cent', nl: 'Klopt tot op de cent' },
  'rec.mismatch': { en: 'Off by {amount}', nl: '{amount} verschil' },
  'rec.opening': { en: 'Opening balance', nl: 'Beginsaldo' },
  'rec.closing': { en: 'Closing balance', nl: 'Eindsaldo' },
  'rec.bankSays': { en: 'Bank says moved', nl: 'Bank zegt beweging' },
  'rec.rowsSay': { en: 'Transactions add up to', nl: 'Transacties tellen op tot' },
  'rec.moneyIn': { en: 'Money in', nl: 'Inkomend' },
  'rec.spending': { en: 'Spending', nl: 'Uitgaven' },
  'rec.investments': { en: 'Investments', nl: 'Beleggingen' },
  'rec.transfersOut': { en: 'Transfers out', nl: 'Overboekingen uit' },
  'rec.internal': { en: 'Between your accounts', nl: 'Tussen eigen rekeningen' },
  'rec.perMonth': { en: 'Spending per month', nl: 'Uitgaven per maand' },
  'rec.months': { en: 'over {count} month(s) with data', nl: 'over {count} maand(en) met data' },

  'acs.title': { en: '{count} accounts imported', nl: '{count} rekeningen geïmporteerd' },
  'acs.info': {
    en: 'Each imported statement gets its own colour, with the spending it is responsible for. Marking an account business separates its costs from your personal ones — otherwise both are added together, which is usually why a combined total looks too high. Transfers-only means money between it and your other accounts is not income or spending.',
    nl: 'Elk geïmporteerd afschrift krijgt een eigen kleur, met de uitgaven die eronder vallen. Een rekening als zakelijk markeren scheidt die kosten van je privé-uitgaven — anders worden ze bij elkaar opgeteld, wat meestal de reden is dat een totaal te hoog lijkt. Alleen-overboekingen betekent dat geld tussen deze en je andere rekeningen geen inkomen of uitgave is.',
  },
  'acs.rows': { en: '{count} transaction(s)', nl: '{count} transactie(s)' },
  'acs.balance': { en: 'balance {amount}', nl: 'saldo {amount}' },
  'acs.spends': { en: 'Spending here', nl: 'Uitgaven hier' },
  'acs.transfersOnly': { en: 'Transfers only', nl: 'Alleen overboekingen' },
  'fin.movedNotEarned': { en: 'moved, not earned', nl: 'verplaatst, niet verdiend' },

  // Every figure on the page explains the rule behind it.
  'info.totalOut': {
    en: 'Everything that left and was actually spent, over the period covered by your import. Money moved between your own accounts, credit-card repayments and investments are excluded — those are not costs.',
    nl: 'Alles wat wegging en daadwerkelijk is uitgegeven, over de periode van je import. Geld tussen eigen rekeningen, creditcard-aflossingen en beleggingen tellen niet mee — dat zijn geen kosten.',
  },
  'info.fixed': {
    en: 'Costs collected from you on a schedule — rent or mortgage, energy, insurance, phone, and anything direct-debited in most months. A gym counts even though it sits under sport, because you cannot skip it this month.',
    nl: 'Kosten die volgens een vast ritme worden geïncasseerd — huur of hypotheek, energie, verzekering, telefoon, en alles wat in de meeste maanden automatisch wordt afgeschreven. Een sportabonnement telt mee, ook al valt het onder sport, omdat je het deze maand niet kunt overslaan.',
  },
  'info.flexible': {
    en: 'Everything you decide on each time: groceries, eating out, travel, shopping. This is the part you can actually change month to month.',
    nl: 'Alles waar je elke keer opnieuw over beslist: boodschappen, uit eten, reizen, winkelen. Dit is het deel dat je maand op maand echt kunt bijsturen.',
  },
  'info.projection': {
    en: 'The year at the pace set so far. Totals are scaled by the days your import covers, not by months, so a statement ending mid-month does not drag the forecast down. The dashed part has not happened.',
    nl: 'Het jaar in het tempo tot nu toe. Totalen worden geschaald op de dagen die je import beslaat, niet op maanden, zodat een afschrift dat midden in de maand eindigt de prognose niet omlaag trekt. Het gestippelde deel is nog niet gebeurd.',
  },
  'info.incoming': {
    en: 'Money that arrived, grouped by who sent it. Anything transferred from your own accounts is listed greyed out and left out of the total — it arrived, but you did not earn it twice.',
    nl: 'Geld dat binnenkwam, gegroepeerd per afzender. Overboekingen van je eigen rekeningen staan grijs weergegeven en tellen niet mee — het kwam binnen, maar je hebt het niet twee keer verdiend.',
  },
  'info.breakdown': {
    en: 'Spending by category, longest bar first. Blue is a fixed commitment, green is spending you choose. Click any bar to see the transactions behind it.',
    nl: 'Uitgaven per categorie, langste balk eerst. Blauw is een vaste last, groen is wat je zelf kiest. Klik op een balk om de onderliggende transacties te zien.',
  },
  'info.tidy': {
    en: 'Merchants no rule recognised — usually local shops. Assign one and every transaction from it is filed, now and on future imports.',
    nl: 'Winkeliers die geen regel herkende — meestal lokale zaken. Wijs er één toe en al zijn transacties worden gerubriceerd, nu en bij toekomstige imports.',
  },
  'info.import': {
    en: 'A CSV export from your bank. It is read here in your browser and never uploaded. Re-importing the same period updates rows instead of duplicating them, and never overwrites a category you set by hand.',
    nl: 'Een CSV-export van je bank. Die wordt hier in je browser gelezen en nooit geüpload. Dezelfde periode opnieuw importeren werkt rijen bij in plaats van ze te verdubbelen, en overschrijft nooit een categorie die je zelf hebt ingesteld.',
  },

  'fin.incoming': { en: 'Where the money comes from', nl: 'Waar het geld vandaan komt' },
  'fin.incomingHint': {
    en: 'Money in, by payer. Transfers between your own accounts are left out.',
    nl: 'Inkomsten per betaler. Overboekingen tussen eigen rekeningen tellen niet mee.',
  },
  'fin.noIncome': { en: 'No income recorded for this year.', nl: 'Geen inkomsten voor dit jaar.' },
  'fin.showAll': { en: 'Show all {count}', nl: 'Toon alle {count}' },
  'fin.showFewer': { en: 'Show fewer', nl: 'Toon minder' },
  'fin.recurringNote': {
    en: 'Anything collected by direct debit in most months counts as fixed, whatever its category — a gym membership is a commitment even though it sits under sports.',
    nl: 'Alles wat via automatische incasso in de meeste maanden wordt geïnd telt als vast, ongeacht de categorie — een sportabonnement is een vaste last, ook al valt het onder sport.',
  },
  'fin.deleteOne': { en: 'Delete this transaction', nl: 'Deze transactie verwijderen' },
  'fin.deleteGroup': { en: 'Delete these transactions', nl: 'Deze transacties verwijderen' },
  'fin.deleteConfirm': {
    en: 'Delete {count} transaction(s) from {name}? This cannot be undone.',
    nl: '{count} transactie(s) van {name} verwijderen? Dit kan niet ongedaan worden gemaakt.',
  },
  'fin.deleteOneConfirm': {
    en: 'Delete this transaction? This cannot be undone.',
    nl: 'Deze transactie verwijderen? Dit kan niet ongedaan worden gemaakt.',
  },
  'fin.dontAskAgain': { en: 'Do not ask me again', nl: 'Vraag dit niet meer' },
  'fin.cancel': { en: 'Cancel', nl: 'Annuleren' },
  'fin.delete': { en: 'Delete', nl: 'Verwijderen' },
  'fin.allAccounts': { en: 'All {count} accounts', nl: 'Alle {count} rekeningen' },
  'fin.selected': { en: '{count} selected', nl: '{count} geselecteerd' },
  'fin.applyTo': { en: 'Apply to selected', nl: 'Toepassen op selectie' },
  'fin.selectAllUnknown': { en: 'Select all shown', nl: 'Alles hieronder selecteren' },
  'fin.clearSelection': { en: 'Clear selection', nl: 'Selectie wissen' },
  'fin.chooseCategory': { en: 'Choose a category', nl: 'Kies een categorie' },
  'fin.assign': { en: 'Assign', nl: 'Toewijzen' },
  'fin.transactions': { en: 'transaction(s)', nl: 'transactie(s)' },
  'fin.clearAll': { en: 'Delete all transactions', nl: 'Alle transacties verwijderen' },
  'fin.clearConfirm': {
    en: 'Delete every imported transaction from this browser? Your invoices and expenses are not affected.',
    nl: 'Alle geïmporteerde transacties uit deze browser verwijderen? Je facturen en uitgaven blijven ongemoeid.',
  },

  'cat.housing': { en: 'Housing', nl: 'Wonen' },
  'cat.utilities': { en: 'Utilities', nl: 'Energie & water' },
  'cat.telecom': { en: 'Phone & internet', nl: 'Telefoon & internet' },
  'cat.insurance': { en: 'Insurance', nl: 'Verzekeringen' },
  'cat.groceries': { en: 'Groceries', nl: 'Boodschappen' },
  'cat.eating-out': { en: 'Eating & drinking out', nl: 'Uit eten & drinken' },
  'cat.transport': { en: 'Transport & fuel', nl: 'Vervoer & brandstof' },
  'cat.online-retail': { en: 'Shopping', nl: 'Winkelen' },
  'cat.subscriptions': { en: 'Subscriptions', nl: 'Abonnementen' },
  'cat.health': { en: 'Health & care', nl: 'Zorg' },
  'cat.sports-hobbies': { en: 'Sports & hobbies', nl: 'Sport & hobby' },
  'cat.government': { en: 'Tax & government', nl: 'Belasting & overheid' },
  'cat.cash': { en: 'Cash withdrawals', nl: 'Contant opgenomen' },
  'cat.investments': { en: 'Investments', nl: 'Beleggingen' },
  'cat.transfers': { en: 'Transfers', nl: 'Overboekingen' },
  'cat.income': { en: 'Income', nl: 'Inkomsten' },
  'cat.unknown': { en: 'Unknown', nl: 'Onbekend' },

  'nf.title': { en: 'No financial data found', nl: 'Geen financiële gegevens gevonden' },
  'nf.body': {
    en: 'This page is not in the books. Nothing was lost — it never existed in the first place.',
    nl: 'Deze pagina staat niet in de boeken. Er is niets kwijt — hij heeft nooit bestaan.',
  },
  'nf.home': { en: 'Back to Home', nl: 'Terug naar Home' },
  'nf.joke': {
    en: 'Balance: € 0,00 · VAT owed on nothing: also € 0,00',
    nl: 'Saldo: € 0,00 · BTW over niets: ook € 0,00',
  },
  'home.eyebrow': { en: 'Bookkeeping Admin', nl: 'Bookkeeping Admin' },
  'home.headline': {
    en: 'Keep your invoices, receipts and quarterly BTW under control.',
    nl: 'Houd je facturen, bonnen en kwartaal-BTW onder controle.',
  },
  'home.intro': {
    en: 'A simple admin tool for independent professionals to track billing profiles, invoices, expenses, receipts and VAT without spreadsheet chaos.',
    nl: 'Een eenvoudige tool voor zelfstandigen om profielen, facturen, uitgaven, bonnen en BTW bij te houden zonder spreadsheet-chaos.',
  },
  'home.createInvoice': { en: 'Create invoice', nl: 'Factuur maken' },
  'home.addExpense': { en: 'Add expense', nl: 'Uitgave toevoegen' },
  'home.seeTaxYear': { en: 'See the tax year', nl: 'Bekijk het belastingjaar' },
  'home.cardInvoices': { en: 'Create invoices and calculate VAT totals instantly.', nl: 'Maak facturen en bereken direct de BTW-totalen.' },
  'home.cardProfiles': { en: 'Save your business details and reusable client invoice data.', nl: 'Bewaar je bedrijfsgegevens en herbruikbare klantgegevens.' },
  'home.cardExpenses': { en: 'Log receipts, VAT rates and business costs.', nl: 'Leg bonnen, BTW-tarieven en zakelijke kosten vast.' },
  'home.cardVat': { en: 'Net VAT per quarter, and what is still to pay.', nl: 'Netto BTW per kwartaal, en wat er nog te betalen is.' },
  'home.cardBelasting': { en: 'The tax year in full: receivables, VAT, and income tax to year end.', nl: 'Het hele belastingjaar: openstaand, BTW en inkomstenbelasting tot jaareinde.' },

  'home.cardFinance': {
    en: 'Import your bank statement and see where your money actually goes.',
    nl: 'Importeer je bankafschrift en zie waar je geld werkelijk heen gaat.',
  },
  'backup.title': { en: 'Backup & restore', nl: 'Back-up & herstel' },
  'backup.intro': {
    en: 'Everything is stored only in this browser. Clearing site data, switching browsers or using a different profile loses it. Export a backup regularly.',
    nl: 'Alles staat alleen in deze browser. Sitegegevens wissen, van browser wisselen of een ander profiel gebruiken wist het. Maak regelmatig een back-up.',
  },
  'backup.download': { en: 'Download backup', nl: 'Back-up downloaden' },
  'backup.restoreFrom': { en: 'Restore from a backup file', nl: 'Herstellen uit een back-upbestand' },
  'backup.merge': { en: 'Merge (safe)', nl: 'Samenvoegen (veilig)' },
  'backup.mergeHint': {
    en: 'Adds entries from the backup that are not already here. Nothing you currently have is changed or removed.',
    nl: 'Voegt items toe die er nog niet zijn. Niets van wat je nu hebt wordt gewijzigd of verwijderd.',
  },
  'backup.replace': { en: 'Replace everything', nl: 'Alles vervangen' },
  'backup.replaceHint': {
    en: 'Discards what is stored here and uses the backup instead. A safety backup is downloaded first.',
    nl: 'Gooit weg wat hier staat en gebruikt de back-up. Er wordt eerst een veiligheidsback-up gedownload.',
  },
  'backup.mergeBtn': { en: 'Merge backup', nl: 'Back-up samenvoegen' },
  'backup.replaceBtn': { en: 'Replace with backup', nl: 'Vervangen door back-up' },
  'backup.cancel': { en: 'Cancel', nl: 'Annuleren' },
  'backup.stored': { en: 'Currently stored:', nl: 'Nu opgeslagen:' },

  'ai.title': { en: 'Import with AI', nl: 'Importeren met AI' },
  'ai.intro': {
    en: 'Drop in invoices, receipts or a bank export and have them turned into records, instead of hand-matching a JSON file. Preview — the provider call is not connected yet.',
    nl: 'Sleep facturen, bonnen of een bankafschrift erin en laat ze omzetten naar records, in plaats van handmatig een JSON-bestand te matchen. Preview — de provider-aanroep is nog niet aangesloten.',
  },
  'ai.preview': { en: 'Preview', nl: 'Preview' },
  'ai.provider': { en: 'Provider', nl: 'Provider' },
  'ai.notConfigured': { en: 'Not configured', nl: 'Niet geconfigureerd' },
  'ai.model': { en: 'Model', nl: 'Model' },
  'ai.apiKey': { en: 'API key', nl: 'API-sleutel' },
  'ai.show': { en: 'Show', nl: 'Tonen' },
  'ai.hide': { en: 'Hide', nl: 'Verbergen' },
  'ai.keyWarning': {
    en: 'A key typed here is kept in this browser only. That is fine on your own machine and not fine once this is hosted — before launch, extraction has to move behind a server route so the key never reaches the browser.',
    nl: 'Een sleutel die je hier invoert blijft alleen in deze browser. Dat is prima op je eigen machine en niet oké zodra dit gehost wordt — vóór lancering moet extractie achter een server-route zodat de sleutel nooit in de browser komt.',
  },
  'ai.notAcceptingFiles': {
    en: 'Not accepting files yet. To restore a backup, use Backup & restore above.',
    nl: 'Accepteert nog geen bestanden. Gebruik hierboven Back-up & herstel om een back-up terug te zetten.',
  },
  'ai.extract': { en: 'Extract records', nl: 'Records extraheren' },
  'ai.clearFiles': { en: 'Clear {count} file(s)', nl: '{count} bestand(en) wissen' },


  'bd.quarterHint': {
    en: 'VAT charged minus VAT deductible. Bars below the line are quarters you reclaim.',
    nl: 'Afgedragen BTW minus aftrekbare BTW. Balken onder de lijn zijn kwartalen die je terugvraagt.',
  },
  'bd.colMonth': { en: 'Month', nl: 'Maand' },
  'bd.colCumRevenue': { en: 'Cumulative revenue', nl: 'Cumulatieve omzet' },
  'bd.colCumExpenses': { en: 'Cumulative expenses', nl: 'Cumulatieve kosten' },
  'bd.colNetProfit': { en: 'Net profit', nl: 'Nettowinst' },
  'bd.colSource': { en: 'Source', nl: 'Bron' },
  'bd.actual': { en: 'Actual', nl: 'Werkelijk' },
  'bd.projected': { en: 'Projected', nl: 'Prognose' },

  'chart.nothingYear': { en: 'Nothing to show yet for this year.', nl: 'Nog niets te tonen voor dit jaar.' },
  'chart.noQuarters': { en: 'No quarters yet.', nl: 'Nog geen kwartalen.' },

  'cl.intro': {
    en: 'Save your own invoice details once, create reusable client profiles, and use them on the invoice page.',
    nl: 'Sla je eigen factuurgegevens één keer op, maak herbruikbare klantprofielen en gebruik ze op de facturenpagina.',
  },
  'cl.businessHint': { en: 'Save multiple sender profiles and reuse them on invoices.', nl: 'Bewaar meerdere afzenderprofielen en hergebruik ze op facturen.' },
  'cl.clientHint': { en: 'Reuse client invoice details without typing them every time.', nl: 'Hergebruik klantgegevens zonder ze elke keer te typen.' },
  'cl.clientHint2': { en: 'Save reusable invoice details for each client so the To block is prefilled.', nl: 'Bewaar herbruikbare gegevens per klant zodat het Aan-blok vooraf is ingevuld.' },
  'cl.noClientsYet': { en: 'No client profiles yet.', nl: 'Nog geen klantprofielen.' },
  'cl.emptyFields': { en: 'Empty fields', nl: 'Lege velden' },

  'exp.editingNotice': { en: 'Editing an existing expense. Saving overwrites it.', nl: 'Je bewerkt een bestaande uitgave. Opslaan overschrijft deze.' },
  'exp.downloadReceipt': { en: 'Download receipt', nl: 'Bon downloaden' },

  'inv.selectBoth': { en: 'Select a saved business profile and a saved client profile.', nl: 'Kies een opgeslagen bedrijfsprofiel en een opgeslagen klantprofiel.' },
  'inv.editProfiles': { en: 'Edit profiles', nl: 'Profielen bewerken' },
  'inv.businessProfile': { en: 'Business profile', nl: 'Bedrijfsprofiel' },
  'inv.dateHint': { en: 'This is the date printed on the invoice document.', nl: 'Dit is de datum die op het factuurdocument staat.' },
  'inv.dueHint': { en: 'Due date will be calculated automatically.', nl: 'De vervaldatum wordt automatisch berekend.' },
  'inv.customVat': { en: 'Custom VAT %', nl: 'Aangepast BTW-%' },
  'inv.fillClient': { en: 'Select a saved client profile to fill this section.', nl: 'Kies een opgeslagen klantprofiel om dit deel in te vullen.' },
  'inv.profileIncomplete': {
    en: 'Your business profile is not complete yet. Add your invoice details on the Profiles page before saving an invoice.',
    nl: 'Je bedrijfsprofiel is nog niet compleet. Vul je factuurgegevens aan op de Profielen-pagina voordat je een factuur opslaat.',
  },
  'inv.noClientProfiles': {
    en: 'No client profiles saved yet. Add one on the Profiles page so the invoice To section can be filled automatically.',
    nl: 'Nog geen klantprofielen opgeslagen. Voeg er een toe op de Profielen-pagina zodat het Aan-blok automatisch wordt ingevuld.',
  },

  'inv.selectAll': { en: 'Select all invoices', nl: 'Alle facturen selecteren' },
  'inv.selectRow': { en: 'Select invoice', nl: 'Factuur selecteren' },
  'inv.downloadSelected': { en: 'Download {count} PDF', nl: '{count} PDF downloaden' },
  'inv.downloadSelectedPlural': { en: 'Download {count} PDFs', nl: '{count} PDF\'s downloaden' },
  'inv.downloadNone': { en: 'Select invoices to download', nl: 'Selecteer facturen om te downloaden' },
  'inv.selectedCount': { en: '{count} selected', nl: '{count} geselecteerd' },
  'total.label': { en: 'Total', nl: 'Totaal' },

  'exp.monthlyAverage': { en: 'Monthly average (ex VAT)', nl: 'Maandgemiddelde (excl. BTW)' },
  'exp.acrossMonths': { en: 'across {count} month(s) with expenses', nl: 'over {count} maand(en) met uitgaven' },
  'exp.dateRange': { en: 'Allowed date range: {min} to {max}', nl: 'Toegestane datumreeks: {min} tot {max}' },
  'exp.addExpense': { en: 'Add Expense', nl: 'Uitgave toevoegen' },
  'exp.saveChanges': { en: 'Save changes', nl: 'Wijzigingen opslaan' },
  'exp.cancelEdit': { en: 'Cancel edit', nl: 'Bewerken annuleren' },
  'exp.supplier': { en: 'Supplier', nl: 'Leverancier' },
  'exp.category': { en: 'Category', nl: 'Categorie' },
  'exp.amountExVat': { en: 'Amount ex VAT', nl: 'Bedrag excl. BTW' },
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
