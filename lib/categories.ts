/**
 * Spending categories and the rules that assign them.
 *
 * Rules are deliberately dumb: a case-insensitive substring of the transaction
 * description wins the category. That is enough for the recurring merchants that
 * make up most of a statement, and everything it cannot place lands in `unknown`
 * rather than being guessed at. A wrong category is worse than an honest gap,
 * because it quietly changes the totals people budget against.
 */

export type CategoryId =
  | 'housing'
  | 'utilities'
  | 'telecom'
  | 'insurance'
  | 'groceries'
  | 'eating-out'
  | 'transport'
  | 'online-retail'
  | 'subscriptions'
  | 'health'
  | 'sports-hobbies'
  | 'government'
  | 'cash'
  | 'investments'
  | 'transfers'
  | 'income'
  | 'unknown';

export type Category = {
  id: CategoryId;
  /** Rough monthly commitment vs discretionary — drives "what to keep an eye on". */
  fixed: boolean;
};

export const CATEGORIES: Category[] = [
  { id: 'housing', fixed: true },
  { id: 'utilities', fixed: true },
  { id: 'telecom', fixed: true },
  { id: 'insurance', fixed: true },
  { id: 'groceries', fixed: false },
  { id: 'eating-out', fixed: false },
  { id: 'transport', fixed: false },
  { id: 'online-retail', fixed: false },
  { id: 'subscriptions', fixed: true },
  { id: 'health', fixed: false },
  { id: 'sports-hobbies', fixed: false },
  { id: 'government', fixed: true },
  { id: 'cash', fixed: false },
  { id: 'investments', fixed: false },
  { id: 'transfers', fixed: false },
  { id: 'income', fixed: false },
  { id: 'unknown', fixed: false },
];

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

/** Ordered: the first match wins, so put specific patterns above general ones. */
const RULES: { match: string[]; category: CategoryId }[] = [
  {
    category: 'housing',
    match: ['OBVION', 'HYPOTHEEK', 'MUNT HYPOTHEKEN', 'VVE ', 'HUUR', 'WOONSTAD', 'YMERE'],
  },
  {
    category: 'utilities',
    match: ['OXXIO', 'ESSENT', 'VATTENFALL', 'ENECO', 'GREENCHOICE', 'VITENS', 'WATERNET', 'BUDGET ENERGIE'],
  },
  {
    category: 'telecom',
    match: ['YOUFONE', 'ZIGGO', 'KPN', 'VODAFONE', 'T-MOBILE', 'ODIDO', 'TELE2', 'SIMYO', 'LEBARA',
            'SIMPEL', 'HOLLANDSNIEUWE', 'BEN '],
  },
  {
    category: 'insurance',
    match: ['FBTO', 'ACHMEA', 'CENTRAAL BEHEER', 'AEGON', 'NATIONALE NEDERLANDEN', 'INTERPOLIS',
            'UNIVE', 'ZILVEREN KRUIS', 'MENZIS', 'VGZ', 'CZ ', 'DITZO', 'ANWB VERZEKER'],
  },
  {
    category: 'groceries',
    // A merchant that calls itself a supermarket is one, whatever its name — that
    // generic word places far more shops than any list of chains can.
    match: ['SUPERMARKT', 'SUPERMARKET', 'MINIMARKT', 'MINI MARKT', 'AVONDWINKEL', 'BUURTWINKEL',
            'ALBERT HEIJN', 'ALBERTHEIJN', ' AH ', 'AH TO GO', 'JUMBO', 'LIDL', 'ALDI', 'DIRK',
            'PLUS ', 'SPAR ', 'EKOPLAZA', 'VOMAR', 'COOP ', 'MARQT', 'DEEN', 'PICNIC', 'CROP',
            'NETTORAMA', 'HOOGVLIET', 'POIESZ', 'JAN LINDERS', 'AMAZING ORIENTAL', 'TOKO ',
            'SLAGERIJ', 'BAKKERIJ', 'GROENTE', 'VISHANDEL', 'KAASHANDEL', 'NOTENBAR'],
  },
  {
    category: 'eating-out',
    match: [
      // What the place calls itself, which covers the long tail of independents.
      'RESTAURANT', 'CAFE', 'CAFÉ', 'EETCAFE', 'BAR ', 'BISTRO', 'BRASSERIE', 'LUNCHROOM',
      'SNACKBAR', 'CAFETARIA', 'FRITUUR', 'GRILLROOM', 'SHOARMA', 'KEBAB', 'PIZZERIA',
      'SUSHI', 'RAMEN', 'POKE', 'TAPAS', 'IJSSALON', 'KOFFIE', 'COFFEE', 'ESPRESSO',
      'BROODJE', 'BAKKER', 'PATISSERIE', 'PANNENKOEK', 'PUB ', 'BREWER', 'BROUWERIJ',
      // Chains, including abroad — a burger in Paris is still eating out.
      'THUISBEZORGD', 'UBER EATS', 'UBEREATS', 'DELIVEROO', 'STARBUCKS', 'MCDONALD',
      'BURGER KING', 'KFC', 'FEBO', 'SUBWAY', 'DOMINO', 'NEW YORK PIZZA', 'POPEYES',
      'FIVE GUYS', 'TACO BELL', 'DUNKIN', 'LA PLACE', 'JULIA', 'VAPIANO', 'HAPPY ITALY',
      'LOETJE', 'BAGELS', 'COSTA COFFEE', 'PRET A MANGER', 'PAUL ',
      // Drink shops sit here rather than groceries: it is discretionary spending.
      'GALL & GALL', 'SLIJTERIJ', 'MITRA ',
    ],
  },
  {
    category: 'transport',
    match: ['SHELL', 'ESSO', 'BP ', 'TOTAL', 'TANKSTATION', 'TINQ', 'NS ', 'NS-', 'GVB', 'RET ',
            'HTM', 'ARRIVA', 'CONNEXXION', 'OV-CHIPKAART', 'OVPAY', 'GREENWHEELS', 'UBER',
            'BOLT.EU', 'Q-PARK', 'PARKEER', 'PARKING', 'YELLOWBRICK', 'EASYPARK', 'KLM',
            'TRANSAVIA', 'SCOOTER', 'GARAGE', 'ANWB WEGENWACHT'],
  },
  {
    category: 'online-retail',
    match: ['AMAZON', 'BOL.COM', 'BOL ', 'TEMU', 'ALIEXPRESS', 'COOLBLUE', 'ZALANDO', 'WEHKAMP',
            'MEDIAMARKT', 'ACTION', 'HEMA', 'IKEA', 'BOLCOM', 'SHEIN', 'DECATHLON', 'PRAXIS',
            'GAMMA', 'KRUIDVAT', 'ETOS', 'DOUGLAS', 'PRIMARK', 'H&M', 'ZARA'],
  },
  {
    category: 'subscriptions',
    match: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'APPLE.COM/BILL', 'ICLOUD', 'GOOGLE ', 'YOUTUBE',
            'ADOBE', 'MICROSOFT', 'DROPBOX', 'PATREON', 'AUDIBLE', 'HBO', 'VIAPLAY', 'STRAVA',
            'LINKEDIN', 'OPENAI', 'ANTHROPIC', 'NRC', 'VOLKSKRANT', 'PAROOL'],
  },
  {
    category: 'health',
    match: ['APOTHEEK', 'HUISARTS', 'TANDARTS', 'FYSIO', 'ZIEKENHUIS', 'ZORG', 'OPTIEK',
            'HANS ANDERS', 'SPECSAVERS', 'PEARLE', 'DIERENKLINIEK', 'DIERENARTS', 'KAPPER',
            'BARBER'],
  },
  {
    category: 'sports-hobbies',
    match: ['SPORTCITY', 'BASIC FIT', 'BASIC-FIT', 'FIT FOR FREE', 'GYM', 'ZWEMBAD', 'TENNIS',
            'VOETBAL', 'BIOSCOOP', 'PATHE', 'KINEPOLIS', 'MUSEUM', 'TICKETMASTER', 'EVENTIM',
            'SLOEPDELEN', 'BOOT'],
  },
  {
    category: 'government',
    match: ['BELASTINGDIENST', 'GEMEENTE', 'CJIB', 'WATERSCHAP', 'RDW', 'DUO', 'CBR', 'SVB'],
  },
  { category: 'cash', match: ['GELDMAAT', 'ATM', 'CASH'] },
  {
    // A credit-card settlement is last month's spending being repaid, not new
    // spending. Counting it again would double what the month actually cost.
    category: 'transfers',
    match: ['INCASSO ING CREDITCARD', 'CREDITCARD INCASSO', 'AMERICAN EXPRESS', 'TIKKIE'],
  },
  {
    category: 'investments',
    match: ['FLATEX', 'DEGIRO', 'BINCK', 'MEESMAN', 'BRAND NEW DAY', 'COINBASE', 'KRAKEN',
            'BITVAVO', 'REVOLUT'],
  },
];

/**
 * ING transaction codes that describe *how* a payment moved rather than what it
 * bought. They only decide a category when no merchant rule matched.
 */
const CODE_FALLBACK: Record<string, CategoryId> = {
  GM: 'cash', // cash machine
  OV: 'transfers', // manual transfer, usually person to person
  VZ: 'transfers', // batch payment
  GT: 'transfers', // online banking transfer — a person, not a merchant
  IC: 'subscriptions', // recurring direct debit that matched no known biller
};

export function categorise(description: string, code: string, isCredit: boolean): CategoryId {
  const haystack = ` ${description.toUpperCase()} `;

  for (const rule of RULES) {
    if (rule.match.some((needle) => haystack.includes(needle.toUpperCase()))) {
      return rule.category;
    }
  }

  // Money in that matched no merchant is treated as income, not as an unknown cost.
  if (isCredit) {
    return 'income';
  }

  return CODE_FALLBACK[code] ?? 'unknown';
}
