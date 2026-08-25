export interface QuoteIntakeDraft {
  fileName: string;
  quoteNumber: string;
  quoteDate: string;
  customerNumber: string;
  customerName: string;
  phone: string;
  address: string;
  projectName: string;
  subtotal: number;
  rawText: string;
  warnings: string[];
}

const STORAGE_KEY = 'forge_crm_data_v2';

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();
const normalize = (value = '') => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

const money = (value = '') => {
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value = '') => {
  const v = clean(value);
  if (!v) return '';
  const iso = v.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const mdy = v.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})\b/);
  if (mdy) return `${mdy[3]}-${String(mdy[1]).padStart(2, '0')}-${String(mdy[2]).padStart(2, '0')}`;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const pick = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
};

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import(/* @vite-ignore */ 'https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs');
  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
    const page = await document.getPage(pageNo);
    const content = await page.getTextContent();
    const line = content.items.map((item: any) => item?.str || '').filter(Boolean).join(' ');
    pages.push(line);
  }
  return pages.join('\n');
}

export function parseQuoteText(rawText: string, fileName = ''): QuoteIntakeDraft {
  const text = rawText.replace(/\u00a0/g, ' ');
  const warnings: string[] = [];

  const filenameQuote = fileName.match(/\b(\d{2}-\d{6})\b/)?.[1] || '';
  const quoteNumber = pick(text, [
    /(?:quote|quotation)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(\d{2}-\d{6})/i,
    /\b(\d{2}-\d{6})\b/
  ]) || filenameQuote;

  const quoteDateRaw = pick(text, [
    /(?:quote\s*date|quotation\s*date)\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+20\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}|20\d{2}[\/-]\d{1,2}[\/-]\d{1,2})/i,
    /\bdate\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+20\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}|20\d{2}[\/-]\d{1,2}[\/-]\d{1,2})/i
  ]);

  const customerNumber = pick(text, [
    /(?:customer|cust(?:omer)?|account)\s*(?:no\.?|number|#)\s*[:#-]?\s*(\d{2,10})/i,
    /(?:customer|account)\s*[:#-]\s*(\d{2,10})\b/i
  ]);

  const customerName = pick(text, [
    /(?:customer\s*name|sold\s*to|bill\s*to)\s*[:#-]?\s*([^\n]{2,80}?)(?=\s{2,}|\s(?:phone|tel|address|customer|account|quote|date)\b|$)/i,
    /(?:customer|client)\s*[:#-]\s*([A-Za-z0-9&.' -]{3,80})/i
  ]);

  const phone = pick(text, [
    /(?:phone|tel(?:ephone)?|mobile|cell)\s*[:#-]?\s*(\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})/i,
    /(\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})/
  ]);

  const address = pick(text, [
    /(?:project\s*address|job\s*address|address)\s*[:#-]?\s*([^\n]{5,120}?)(?=\s{2,}|\s(?:phone|tel|quote|date|project|job)\b|$)/i
  ]);

  const projectName = pick(text, [
    /(?:project\s*name|job\s*name|job\s*description|project|job|reference|re:)\s*[:#-]\s*([^\n]{2,100}?)(?=\s{2,}|\s(?:item|qty|quantity|description|quote|date|customer)\b|$)/i
  ]);

  const subtotalRaw = pick(text, [
    /item\s*total\s*[:$]?\s*([$]?[\d,]+(?:\.\d{2})?)/i,
    /sub\s*total\s*[:$]?\s*([$]?[\d,]+(?:\.\d{2})?)/i,
    /subtotal\s*[:$]?\s*([$]?[\d,]+(?:\.\d{2})?)/i
  ]);

  const subtotal = money(subtotalRaw);
  if (!quoteNumber) warnings.push('Quote number was not found.');
  if (!customerName && !customerNumber) warnings.push('Customer could not be identified confidently.');
  if (!subtotal) warnings.push('Pre-tax Item Total / Subtotal was not found.');
  if (!projectName) warnings.push('Project / job name was not found.');

  return {
    fileName,
    quoteNumber,
    quoteDate: toIsoDate(quoteDateRaw) || new Date().toISOString().slice(0, 10),
    customerNumber,
    customerName,
    phone,
    address,
    projectName,
    subtotal,
    rawText,
    warnings
  };
}

const companyWords = /\b(construction|contracting|homes?|carpentry|builders?|building|hardware|lumber|inc\.?|ltd\.?|limited|corp\.?|corporation|group|developments?)\b/i;

function splitCustomerName(name: string) {
  const cleaned = clean(name);
  if (!cleaned) return { firstName: '', lastName: '', company: '' };
  if (companyWords.test(cleaned)) return { firstName: '', lastName: '', company: cleaned };
  const parts = cleaned.split(' ');
  return { firstName: parts.shift() || '', lastName: parts.join(' '), company: '' };
}

const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11)}`;

export interface QuoteImportResult {
  customerId: string;
  quoteId: string;
  quoteNumber: string;
  createdCustomer: boolean;
  createdQuote: boolean;
  updatedExistingQuote: boolean;
}

export function findExistingQuote(quoteNumber: string) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return (data.quotes || []).find((quote: any) => clean(quote.quoteNumber) === clean(quoteNumber));
  } catch {
    return undefined;
  }
}

export function importQuoteDraft(draft: QuoteIntakeDraft): QuoteImportResult {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data.customers = Array.isArray(data.customers) ? data.customers : [];
  data.quotes = Array.isArray(data.quotes) ? data.quotes : [];
  data.dailyTasks = Array.isArray(data.dailyTasks) ? data.dailyTasks : [];

  const identity = splitCustomerName(draft.customerName);
  const incomingDisplay = normalize(identity.company || `${identity.firstName} ${identity.lastName}`);
  let customer = data.customers.find((c: any) => {
    const externalMatch = draft.customerNumber && c.externalCustomerNumber && String(c.externalCustomerNumber) === String(draft.customerNumber);
    const display = normalize(c.company || `${c.firstName || ''} ${c.lastName || ''}`);
    return Boolean(externalMatch || (incomingDisplay && display === incomingDisplay));
  });

  let createdCustomer = false;
  if (!customer) {
    customer = {
      id: id('customer'),
      externalCustomerNumber: draft.customerNumber || undefined,
      ...identity,
      emails: [],
      phones: draft.phone ? [draft.phone] : [],
      address: draft.address || '',
      lastContactDate: draft.quoteDate,
      lastContactNotes: `Quote ${draft.quoteNumber || draft.fileName} imported from desktop PDF.`,
      childrenNames: [],
      spouseName: '',
      importantDates: [],
      tags: ['PDF Quote Intake'],
      status: 'quoted',
      notes: 'Created automatically from a reviewed PDF quote import.',
      activityLog: []
    };
    data.customers.push(customer);
    createdCustomer = true;
  } else {
    customer.externalCustomerNumber = customer.externalCustomerNumber || draft.customerNumber || undefined;
    customer.address = customer.address || draft.address || '';
    if (draft.phone && !(customer.phones || []).includes(draft.phone)) customer.phones = [...(customer.phones || []), draft.phone];
    customer.status = customer.status === 'lead' || customer.status === 'dormant' ? 'quoted' : customer.status;
    customer.lastContactDate = draft.quoteDate;
  }

  customer.activityLog = Array.isArray(customer.activityLog) ? customer.activityLog : [];
  const activityContent = `Quote ${draft.quoteNumber || draft.fileName} imported from PDF — ${draft.projectName || 'No project name'} — $${draft.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before tax.`;
  if (!customer.activityLog.some((entry: any) => entry.content === activityContent)) {
    customer.activityLog.unshift({ id: id('activity'), date: draft.quoteDate, type: 'note', content: activityContent });
  }

  const existingQuote = data.quotes.find((q: any) => clean(q.quoteNumber) === clean(draft.quoteNumber));
  let quote: any;
  let createdQuote = false;
  let updatedExistingQuote = false;

  if (existingQuote) {
    Object.assign(existingQuote, {
      customerId: customer.id,
      dateCreated: draft.quoteDate || existingQuote.dateCreated,
      scopeSummary: draft.projectName || existingQuote.scopeSummary,
      projectName: draft.projectName || existingQuote.projectName,
      totalValue: draft.subtotal || existingQuote.totalValue,
      sourceFileName: draft.fileName,
      importSource: 'Desktop PDF Quote Intake',
      intakeUpdatedAt: new Date().toISOString()
    });
    quote = existingQuote;
    updatedExistingQuote = true;
  } else {
    quote = {
      id: id('quote'),
      quoteNumber: draft.quoteNumber || `IMPORT-${Date.now()}`,
      customerId: customer.id,
      version: 1,
      dateCreated: draft.quoteDate,
      scopeSummary: draft.projectName || draft.fileName.replace(/\.pdf$/i, ''),
      projectName: draft.projectName || '',
      lineItems: [],
      totalValue: draft.subtotal,
      margin: 0,
      probability: 50,
      status: 'sent',
      sourceFileName: draft.fileName,
      importSource: 'Desktop PDF Quote Intake',
      importedAt: new Date().toISOString(),
      workflowStage: 'quoted'
    };
    data.quotes.push(quote);
    createdQuote = true;
  }

  if (createdQuote) {
    const followUpDate = new Date(`${draft.quoteDate || new Date().toISOString().slice(0, 10)}T12:00:00`);
    followUpDate.setDate(followUpDate.getDate() + 7);
    const title = `Follow up — ${draft.customerName || draft.customerNumber || 'quote'} — ${quote.quoteNumber}`;
    if (!data.dailyTasks.some((task: any) => task.title === title)) {
      data.dailyTasks.push({ id: id('task'), title, category: 'Quote', dueDate: followUpDate.toISOString().slice(0, 10), completed: false, priority: 'medium' });
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('forge:crm-data-updated', { detail: { source: 'quote-intake', quoteId: quote.id } }));
  return { customerId: customer.id, quoteId: quote.id, quoteNumber: quote.quoteNumber, createdCustomer, createdQuote, updatedExistingQuote };
}
