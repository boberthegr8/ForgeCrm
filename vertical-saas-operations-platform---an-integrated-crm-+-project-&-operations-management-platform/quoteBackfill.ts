// Six-month J&K quote-history backfill from the shared Google Drive folder.
// This module is intentionally idempotent: quote numbers are the primary de-dupe key,
// and customers are matched by J&K customer number first, then normalized name.

const BACKFILL_CUSTOMERS = [
  { id: 'jk-cust-29786', externalCustomerNumber: '29786', firstName: 'Justin', lastName: 'Hoover', company: '', emails: [], phones: ['289-808-5736'], address: 'Dunnville, ON', lastContactDate: '2026-08-24' },
  { id: 'jk-cust-28912', externalCustomerNumber: '28912', firstName: '', lastName: '', company: 'MDK Carpentry', emails: [], phones: ['905-981-9064'], address: 'Smithville, ON', lastContactDate: '2026-08-24' },
  { id: 'jk-cust-29811', externalCustomerNumber: '29811', firstName: 'David', lastName: 'Theoret', company: '', emails: [], phones: ['905-979-9068'], address: '2779 Lakeshore Road, Dunnville, ON', lastContactDate: '2026-08-24' },
  { id: 'jk-cust-29807', externalCustomerNumber: '29807', firstName: 'Julia', lastName: 'Johnson', company: '', emails: [], phones: ['705-349-3920'], address: 'Brantford, ON', lastContactDate: '2026-08-23' },
  { id: 'jk-cust-29420', externalCustomerNumber: '29420', firstName: 'Doug', lastName: 'Vroom', company: '', emails: [], phones: ['705-938-5002'], address: 'Parry Sound, ON', lastContactDate: '2026-08-18' },
  { id: 'jk-cust-29679', externalCustomerNumber: '29679', firstName: 'Len', lastName: 'Reibot', company: '', emails: [], phones: ['905-359-3347'], address: 'Dunnville, ON', lastContactDate: '2026-08-18' },
  { id: 'jk-cust-29188', externalCustomerNumber: '29188', firstName: '', lastName: '', company: 'Allandale Home Hardware Building Centre', emails: [], phones: ['705-721-5111'], address: '200 Minets Point Rd, Barrie, ON L4N 4C3', lastContactDate: '2026-08-18' },
  { id: 'jk-cust-29795', externalCustomerNumber: '29795', firstName: '', lastName: '', company: 'Jackman Construction', emails: [], phones: ['519-896-9009'], address: '205 Shirley Drive Unit 107, Kitchener, ON', lastContactDate: '2026-08-17' },
  { id: 'jk-cust-29067', externalCustomerNumber: '29067', firstName: 'Gareth', lastName: 'Stock', company: '', emails: [], phones: ['289-795-7662'], address: '493 Harvest Rd, Dundas, ON', lastContactDate: '2026-08-17' },
  { id: 'jk-cust-898', externalCustomerNumber: '898', firstName: '', lastName: '', company: 'A A Cash', emails: [], phones: ['519-111-1111'], address: 'Brantford, ON', lastContactDate: '2026-08-17' },
  { id: 'jk-cust-29837', externalCustomerNumber: '29837', firstName: '', lastName: '', company: 'MGB Construction', emails: [], phones: ['437-494-5897'], address: '870 Eastern Ave, Toronto, ON', lastContactDate: '2026-08-13' },
  { id: 'jk-cust-29863', externalCustomerNumber: '29863', firstName: 'Travis', lastName: 'Ryder', company: '', emails: [], phones: ['519-535-3584'], address: '349 Nelson Street, Brantford, ON', lastContactDate: '2026-08-11' },
  { id: 'jk-cust-18196', externalCustomerNumber: '18196', firstName: '', lastName: '', company: 'Paulsan Construction Inc', emails: [], phones: ['519-304-7555'], address: '408 Henry Street Unit #1, Brantford, ON N3S 7W1', lastContactDate: '2026-08-11' },
  { id: 'jk-cust-29412', externalCustomerNumber: '29412', firstName: '', lastName: '', company: 'San-Diego Homes', emails: [], phones: ['705-896-1453'], address: 'Innisfil, ON', lastContactDate: '2026-08-11' },
  { id: 'jk-cust-29760', externalCustomerNumber: '29760', firstName: 'Rob', lastName: 'Manness', company: '', emails: [], phones: ['905-774-0514'], address: 'Dunnville / Selkirk, ON', lastContactDate: '2026-08-07' },
  { id: 'jk-cust-28922', externalCustomerNumber: '28922', firstName: 'John', lastName: 'Scipione', company: '', emails: [], phones: ['905-317-1500'], address: '1585 Woodburn Road, Hamilton, ON L0R 1C0', lastContactDate: '2026-07-22' }
];

const BACKFILL_QUOTES = [
  { id: 'jk-quote-28-964921', quoteNumber: '28-964921', customerImportId: 'jk-cust-29786', dateCreated: '2026-08-24', scopeSummary: '118A Lock Street', totalValue: 675.00, sourceFileName: '28-964921-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1k6Nhx1dUhhamM-lMEC1N-ZjBJZygkhvg/view?usp=drivesdk' },
  { id: 'jk-quote-28-964920', quoteNumber: '28-964920', customerImportId: 'jk-cust-28912', dateCreated: '2026-08-24', scopeSummary: '307 East 21st Street', totalValue: 3479.52, sourceFileName: '28-964920-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1Oe7EGdo6k3kxVGpXVtWaWuqfPNFX0Wdg/view?usp=drivesdk' },
  { id: 'jk-quote-28-964917', quoteNumber: '28-964917', customerImportId: 'jk-cust-29811', dateCreated: '2026-08-24', scopeSummary: 'New Awesome Deck', totalValue: 4770.41, sourceFileName: '28-964917-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1Z5CaW7V0bHWf4tkPstVLuvzPsFsclitR/view?usp=drivesdk' },
  { id: 'jk-quote-28-964916', quoteNumber: '28-964916', customerImportId: 'jk-cust-29807', dateCreated: '2026-08-23', scopeSummary: 'Cedar - Urbanix Soffit / Fascia', totalValue: 4806.96, sourceFileName: '28-964916-1.pdf', sourceUrl: 'https://drive.google.com/file/d/12rGch1l8OpupV0H5LUnmeB6V9co6bcpx/view?usp=drivesdk' },
  { id: 'jk-quote-28-964828', quoteNumber: '28-964828', customerImportId: 'jk-cust-29420', dateCreated: '2026-08-18', scopeSummary: 'Still Left to Ship', totalValue: 12832.20, sourceFileName: '28-964828-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1f5OSwF_bog5gkhLOlzdKknphjF-dBXAa/view?usp=drivesdk' },
  { id: 'jk-quote-28-964830', quoteNumber: '28-964830', customerImportId: 'jk-cust-29420', dateCreated: '2026-08-18', scopeSummary: 'Left to Ship', totalValue: 749.53, sourceFileName: '28-964830-2.pdf', sourceUrl: 'https://drive.google.com/file/d/1uZk9SxMmiglzm0jZTwEaU4G-A81x76Uw/view?usp=drivesdk' },
  { id: 'jk-quote-28-964906', quoteNumber: '28-964906', customerImportId: 'jk-cust-29679', dateCreated: '2026-08-18', scopeSummary: 'Stevensville', totalValue: 6080.84, sourceFileName: '28-964906-1.pdf', sourceUrl: 'https://drive.google.com/file/d/16lcIIgJ6nFhAjKjmL8FFwSrK9Ai90h1u/view?usp=drivesdk' },
  { id: 'jk-quote-28-964897', quoteNumber: '28-964897', customerImportId: 'jk-cust-29188', dateCreated: '2026-08-18', scopeSummary: 'MacDougall', totalValue: 1488.52, sourceFileName: '28-964897-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1PJYnXB1ZUry7HJNXZTbtmLLiUbXrL9Zu/view?usp=drivesdk' },
  { id: 'jk-quote-28-964902', quoteNumber: '28-964902', customerImportId: 'jk-cust-29795', dateCreated: '2026-08-17', scopeSummary: 'Eastridge Road Apartments', totalValue: 633704.53, sourceFileName: '28-964902-1.pdf', sourceUrl: 'https://drive.google.com/file/d/15pMCb7HDz-up1oRZOJH8AV9jn5RZh4eu/view?usp=drivesdk' },
  { id: 'jk-quote-28-964899', quoteNumber: '28-964899', customerImportId: 'jk-cust-29067', dateCreated: '2026-08-17', scopeSummary: 'Trim', totalValue: 547.04, sourceFileName: '28-964899-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1iuKGRTu_Lv23KJZ6aJaogNnfGuCdjuOh/view?usp=drivesdk' },
  { id: 'jk-quote-28-964896', quoteNumber: '28-964896', customerImportId: 'jk-cust-898', dateCreated: '2026-08-17', scopeSummary: 'Strathroy', totalValue: 8598.28, sourceFileName: '28-964896-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1ryWdP91EJ2TK8wwV_UXkU0aZMajCsobq/view?usp=drivesdk' },
  { id: 'jk-quote-28-964891', quoteNumber: '28-964891', customerImportId: 'jk-cust-29837', dateCreated: '2026-08-13', scopeSummary: '291 Bain', totalValue: 1050.68, sourceFileName: '28-964891-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1vHXahwwHl17sybz2lRCkl1mtCUhc91V0/view?usp=drivesdk' },
  { id: 'jk-quote-28-964883', quoteNumber: '28-964883', customerImportId: 'jk-cust-29863', dateCreated: '2026-08-11', scopeSummary: '20x24', totalValue: 14183.47, sourceFileName: '28-964883-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1UhWxKx5t_0FfUXgTDIE0IORJBO9pAzyP/view?usp=drivesdk' },
  { id: 'jk-quote-28-964866', quoteNumber: '28-964866', customerImportId: 'jk-cust-18196', dateCreated: '2026-08-11', scopeSummary: '309 Cambell Street', totalValue: 157632.16, sourceFileName: '28-964866-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1uKcwdV2-d4GWIqwAeV8Sc0wOCdEQ6n3T/view?usp=drivesdk' },
  { id: 'jk-quote-28-964880', quoteNumber: '28-964880', customerImportId: 'jk-cust-29412', dateCreated: '2026-08-11', scopeSummary: 'San Diego Homes', totalValue: 38632.08, sourceFileName: '28-964880-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1vwKNNvvEOgQA7tQ-bQD_PaS_SN7uByEw/view?usp=drivesdk' },
  { id: 'jk-quote-28-964879', quoteNumber: '28-964879', customerImportId: 'jk-cust-18196', dateCreated: '2026-08-11', scopeSummary: 'Brantford Native Housing August 2026', totalValue: 44198.90, sourceFileName: '28-964879-1.pdf', sourceUrl: 'https://drive.google.com/file/d/18GCXpFjfJS_KTwpIjimUF6vRNe3O4M5Z/view?usp=drivesdk' },
  { id: 'jk-quote-28-964709', quoteNumber: '28-964709', customerImportId: 'jk-cust-18196', dateCreated: '2026-08-11', scopeSummary: 'Brantford Native Housing June 2026', totalValue: 228308.17, sourceFileName: '28-964709-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1JUlC9Lp80TfzndR6FGJ150nH89vDLo-W/view?usp=drivesdk' },
  { id: 'jk-quote-28-964870', quoteNumber: '28-964870', customerImportId: 'jk-cust-29760', dateCreated: '2026-08-07', scopeSummary: 'Smithville', totalValue: 1805.02, sourceFileName: '28-964870-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1HGLw-RmZVVH8sQl3JeGAxV3JnrzwPG9A/view?usp=drivesdk' },
  { id: 'jk-quote-28-964836', quoteNumber: '28-964836', customerImportId: 'jk-cust-29837', dateCreated: '2026-07-29', scopeSummary: '9 Edenbridge Drive', totalValue: 11156.26, sourceFileName: '28-964836-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1rYoyxfh_tZdviTVc66AYqBtzJX31cqg1/view?usp=drivesdk' },
  { id: 'jk-quote-28-964835', quoteNumber: '28-964835', customerImportId: 'jk-cust-29837', dateCreated: '2026-07-28', scopeSummary: '2727 Young Street', totalValue: 2829.83, sourceFileName: '28-964835-1.pdf', sourceUrl: 'https://drive.google.com/file/d/14nq7s-LCx9Wc3zZf7DTO5SjXZWCj4NfX/view?usp=drivesdk' },
  { id: 'jk-quote-28-964741', quoteNumber: '28-964741', customerImportId: 'jk-cust-29807', dateCreated: '2026-07-22', scopeSummary: 'Julia Johnson', totalValue: 19327.26, sourceFileName: '28-964741-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1u88HhITXxW4Agv2_MHw2VijnZO7vSwHX/view?usp=drivesdk' },
  { id: 'jk-quote-28-964714', quoteNumber: '28-964714', customerImportId: 'jk-cust-28922', dateCreated: '2026-07-22', scopeSummary: 'New Cottage Premium 2026', totalValue: 34133.44, sourceFileName: '28-964714-1.pdf', sourceUrl: 'https://drive.google.com/file/d/1PW2VG6IrFPtjJgXgbkqNJ4pFcy8vQIzC/view?usp=drivesdk' }
];

const normalize = (value: string = '') => value
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]/g, '');

const displayKey = (customer: any) => normalize(
  customer.company || [customer.firstName, customer.lastName].filter(Boolean).join(' ')
);

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function mergeQuoteBackfill(base: any) {
  const next = {
    ...base,
    customers: Array.isArray(base?.customers) ? [...base.customers] : [],
    quotes: Array.isArray(base?.quotes) ? [...base.quotes] : []
  };

  const customerIdMap = new Map<string, string>();

  for (const imported of BACKFILL_CUSTOMERS) {
    const importedKey = displayKey(imported);
    const existing = next.customers.find((customer: any) => {
      const sameExternalNumber = customer.externalCustomerNumber &&
        String(customer.externalCustomerNumber) === imported.externalCustomerNumber;
      return sameExternalNumber || displayKey(customer) === importedKey;
    });

    if (existing) {
      customerIdMap.set(imported.id, existing.id);
      existing.externalCustomerNumber = existing.externalCustomerNumber || imported.externalCustomerNumber;
      existing.phones = uniqueStrings([...(existing.phones || []), ...imported.phones]);
      existing.emails = uniqueStrings(existing.emails || []);
      existing.address = existing.address || imported.address;
      existing.company = existing.company || imported.company;
      existing.firstName = existing.firstName || imported.firstName;
      existing.lastName = existing.lastName || imported.lastName;
      existing.lastContactDate = existing.lastContactDate || imported.lastContactDate;
      continue;
    }

    const newCustomer = {
      ...imported,
      childrenNames: [],
      spouseName: '',
      importantDates: [],
      tags: ['J&K Quote History'],
      status: 'quoted',
      notes: 'Imported from J&K quote history.',
      lastContactNotes: 'Quote history imported from Google Drive.',
      activityLog: []
    };
    next.customers.push(newCustomer);
    customerIdMap.set(imported.id, newCustomer.id);
  }

  const existingQuoteNumbers = new Set(next.quotes.map((quote: any) => String(quote.quoteNumber || '').trim()));

  for (const imported of BACKFILL_QUOTES) {
    if (existingQuoteNumbers.has(imported.quoteNumber)) continue;
    const customerId = customerIdMap.get(imported.customerImportId);
    if (!customerId) continue;

    next.quotes.push({
      id: imported.id,
      quoteNumber: imported.quoteNumber,
      customerId,
      version: 1,
      dateCreated: imported.dateCreated,
      scopeSummary: imported.scopeSummary,
      lineItems: [],
      totalValue: imported.totalValue,
      margin: 0,
      probability: 50,
      status: 'sent',
      sourceFileName: imported.sourceFileName,
      sourceUrl: imported.sourceUrl,
      importSource: 'J&K Google Drive backfill'
    });
    existingQuoteNumbers.add(imported.quoteNumber);
  }

  return next;
}
