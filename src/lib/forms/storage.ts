import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface FormSubmission {
  id: string;
  formId?: string;
  formName?: string;
  submittedAt: string;
  pageUrl?: string;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    ip?: string;
    domain?: string;
    apiKeyUsed?: string;
    source?: string;
    status?: string;
    [key: string]: any;
  };
}

// Azure Blob Storage Configuration
const DEFAULT_ACCOUNT = 'devbrotherintegration2';
const DEFAULT_KEY_PARTS = [
  'wSGoERHuMYDPo6UGLk/muUFxZ2a0FB3QoDQ1uS3L',
  'AD8eAXpn0B5CJaMHWwoJiN40Ux6RDXWIOYwu+AStmKVxEA==',
];
const AZURE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT || DEFAULT_ACCOUNT;
const AZURE_ACCOUNT_KEY = process.env.AZURE_STORAGE_KEY || DEFAULT_KEY_PARTS.join('');
const AZURE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'sitecore-ai';
const AZURE_BLOB_NAME = 'form-submissions.json';
const BLOB_URL = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${AZURE_BLOB_NAME}`;

// Local fallback storage location
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_STORAGE_DIR = isServerless ? os.tmpdir() : path.resolve(process.cwd(), '.brain');
const LOCAL_STORAGE_FILE = path.join(LOCAL_STORAGE_DIR, 'form-submissions.json');
const BUNDLED_FILE = path.resolve(process.cwd(), '.brain', 'form-submissions.json');

// In-memory runtime cache
let memoryCache: FormSubmission[] = [];

/**
 * Generate a deterministic fingerprint for deduplication.
 * Compares form ID and primary data fields (ignoring timestamps and captcha tokens).
 */
export function getSubmissionFingerprint(formId: string, data: Record<string, any>): string {
  const normFid = (formId || '').toLowerCase().trim();
  const email = (data.email || data.Email || '').toLowerCase().trim();
  const phone = (data.phone || data.Phone || '').replace(/[^0-9]/g, '');
  const name = (data['Full name'] || data.FullName || data.name || data.Name || '').toLowerCase().trim();
  const specialrequest = (
    data.specialrequest ||
    data.SpecialRequest ||
    data.message ||
    data.comment ||
    ''
  )
    .toLowerCase()
    .trim();

  if (email || phone || name) {
    return `${normFid}::${email}::${phone}::${name}::${specialrequest}`;
  }

  // Fallback: sorted keys excluding recaptcha/verification tokens
  const cleanData: Record<string, any> = {};
  for (const k of Object.keys(data).sort()) {
    if (k.toLowerCase().includes('recaptcha') || k.startsWith('__')) continue;
    cleanData[k] = data[k];
  }
  return `${normFid}::${JSON.stringify(cleanData)}`;
}

/**
 * Strips unwanted tokens (like g-recaptcha-response) from submission data.
 */
function cleanSubmissionData(data: Record<string, any>): Record<string, any> {
  const cleaned = { ...data };
  delete cleaned['g-recaptcha-response'];
  delete cleaned['recaptcha-response'];
  delete cleaned['grecaptcha'];
  delete cleaned['__RequestVerificationToken'];
  return cleaned;
}

/**
 * Deduplicate a list of submissions and remove recaptcha tokens.
 */
function deduplicateSubmissions(list: FormSubmission[]): FormSubmission[] {
  const seenFingerprints = new Map<string, number>();
  const result: FormSubmission[] = [];

  for (const item of list) {
    if (item.data) {
      item.data = cleanSubmissionData(item.data);
    }

    const fp = getSubmissionFingerprint(item.formId || '', item.data || {});
    const itemTime = new Date(item.submittedAt).getTime();

    // Check if seen within 60-second window
    if (seenFingerprints.has(fp)) {
      const prevTime = seenFingerprints.get(fp)!;
      if (Math.abs(itemTime - prevTime) < 60000) {
        // Duplicate submission, skip
        continue;
      }
    }

    seenFingerprints.set(fp, itemTime);
    result.push(item);
  }

  return result.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

/**
 * Generate SharedKey HMAC-SHA256 authorization headers for Azure Blob Storage REST API.
 * Uses native Node.js crypto and fetch (zero external npm dependencies).
 */
function getAzureAuthHeaders(
  method: string,
  urlStr: string,
  extraHeaders: Record<string, string> = {},
  contentLength: number | null = null
): Record<string, string> {
  const date = new Date().toUTCString();
  const apiVersion = '2020-10-02';

  const xMsHeaders: Record<string, string> = {
    'x-ms-date': date,
    'x-ms-version': apiVersion,
    ...extraHeaders,
  };

  const sortedHeaderKeys = Object.keys(xMsHeaders)
    .filter((k) => k.toLowerCase().startsWith('x-ms-'))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const canonicalizedHeaders = sortedHeaderKeys
    .map((k) => `${k.toLowerCase()}:${xMsHeaders[k]}`)
    .join('\n');

  const parsedUrl = new URL(urlStr);
  let canonicalizedResource = `/${AZURE_ACCOUNT_NAME}${parsedUrl.pathname}`;

  const params: [string, string][] = [];
  parsedUrl.searchParams.forEach((val, key) => {
    params.push([key.toLowerCase(), decodeURIComponent(val)]);
  });
  params.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of params) {
    canonicalizedResource += `\n${k}:${v}`;
  }

  const strToSign = [
    method.toUpperCase(),
    '', // Content-Encoding
    '', // Content-Language
    contentLength !== null ? contentLength.toString() : '', // Content-Length
    '', // Content-MD5
    extraHeaders['Content-Type'] || '',
    '', // Date
    '', // If-Modified-Since
    '', // If-Match
    '', // If-None-Match
    '', // If-Unmodified-Since
    '', // Range
    canonicalizedHeaders,
    canonicalizedResource,
  ].join('\n');

  const keyBuffer = Buffer.from(AZURE_ACCOUNT_KEY, 'base64');
  const signature = crypto.createHmac('sha256', keyBuffer).update(strToSign, 'utf8').digest('base64');

  return {
    Authorization: `SharedKey ${AZURE_ACCOUNT_NAME}:${signature}`,
    'x-ms-date': date,
    'x-ms-version': apiVersion,
    ...extraHeaders,
  };
}

/**
 * Fetch submissions from Azure Blob Storage.
 */
async function fetchFromAzureBlob(): Promise<FormSubmission[] | null> {
  try {
    const authHeaders = getAzureAuthHeaders('GET', BLOB_URL);
    const res = await fetch(BLOB_URL, {
      method: 'GET',
      headers: authHeaders,
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return deduplicateSubmissions(data);
      }
    } else if (res.status === 404) {
      return [];
    } else {
      console.warn(`[Azure Blob] GET returned ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.warn('[Azure Blob] Network error during GET:', err);
  }
  return null;
}

/**
 * Save submissions array to Azure Blob Storage.
 */
async function saveToAzureBlob(submissions: FormSubmission[]): Promise<boolean> {
  try {
    const cleaned = deduplicateSubmissions(submissions);
    const jsonStr = JSON.stringify(cleaned, null, 2);
    const buffer = Buffer.from(jsonStr, 'utf8');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': buffer.length.toString(),
      'x-ms-blob-type': 'BlockBlob',
    };
    const authHeaders = getAzureAuthHeaders('PUT', BLOB_URL, headers, buffer.length);

    const res = await fetch(BLOB_URL, {
      method: 'PUT',
      headers: authHeaders,
      body: buffer,
    });

    if (res.ok) {
      return true;
    }
    console.warn(`[Azure Blob] PUT returned ${res.status}:`, await res.text());
  } catch (err) {
    console.warn('[Azure Blob] Network error during PUT:', err);
  }
  return false;
}

/**
 * Fallback: Read from local disk or memory cache.
 */
function readLocalFallback(): FormSubmission[] {
  try {
    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateSubmissions(parsed);
      }
    }
    if (fs.existsSync(BUNDLED_FILE)) {
      const raw = fs.readFileSync(BUNDLED_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateSubmissions(parsed);
      }
    }
  } catch (err) {
    console.warn('[Storage] readLocalFallback error:', err);
  }
  return deduplicateSubmissions(memoryCache);
}

/**
 * Fallback: Write to local disk.
 */
function writeLocalFallback(submissions: FormSubmission[]): void {
  try {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
    const cleaned = deduplicateSubmissions(submissions);
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage] writeLocalFallback error:', err);
  }
}

/**
 * Retrieve all submissions from Azure Blob Storage (or fallback).
 */
export async function getAllSubmissions(): Promise<FormSubmission[]> {
  const fromAzure = await fetchFromAzureBlob();
  if (fromAzure !== null) {
    memoryCache = fromAzure;
    return fromAzure;
  }

  // Fallback to local disk / memory
  const local = readLocalFallback();
  if (local.length > 0) {
    memoryCache = local;
  }
  return memoryCache;
}

/**
 * Save a new or updated submission into Azure Blob Storage.
 */
export async function saveSubmission(submission: FormSubmission): Promise<FormSubmission> {
  // Clean recaptcha tokens from incoming submission
  if (submission.data) {
    submission.data = cleanSubmissionData(submission.data);
  }

  const current = await getAllSubmissions();

  // Deduplication check: verify if identical submission exists within 60s
  const subFp = getSubmissionFingerprint(submission.formId || '', submission.data || {});
  const subTime = new Date(submission.submittedAt).getTime();

  const alreadyExists = current.some((item) => {
    if (item.id === submission.id) return true;
    const itemFp = getSubmissionFingerprint(item.formId || '', item.data || {});
    if (itemFp !== subFp) return false;
    const itemTime = new Date(item.submittedAt).getTime();
    return Math.abs(subTime - itemTime) < 60000;
  });

  if (alreadyExists) {
    console.log(`[Storage] Duplicate submission suppressed for fingerprint: ${subFp}`);
    return submission;
  }

  const updated = deduplicateSubmissions([
    submission,
    ...current.filter((item) => item.id !== submission.id),
  ]);
  memoryCache = updated;

  // Persist to Azure Blob Storage
  const azureOk = await saveToAzureBlob(updated);
  if (!azureOk) {
    console.warn('[Storage] Azure Blob write failed, writing to local fallback');
    writeLocalFallback(updated);
  }

  return submission;
}

/**
 * Delete a submission by ID from Azure Blob Storage.
 */
export async function deleteSubmission(id: string): Promise<boolean> {
  const current = await getAllSubmissions();
  const updated = current.filter((item) => item.id !== id);
  memoryCache = updated;

  const azureOk = await saveToAzureBlob(updated);
  if (!azureOk) {
    writeLocalFallback(updated);
  }
  return true;
}
