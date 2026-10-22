import fs from 'fs';
import path from 'path';

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

const STORAGE_DIR = path.resolve(process.cwd(), '.brain');
const STORAGE_FILE = path.join(STORAGE_DIR, 'form-submissions.json');

// In-memory seed data
let memorySubmissions: FormSubmission[] = [
  {
    id: 'sub-sitecore-001',
    formId: '32b14b7d4d8e4672950b11176f3e1a90-jpe',
    formName: 'Contact Us - Thanh',
    submittedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    pageUrl: 'https://app.sitecorecloud.io',
    data: {
      'Full name': 'NGUYEN NGOC DUY THANH',
      phone: '+84964668135',
      email: 'nndt126@gmail.com',
      specialrequest: 'Consultation request for Sitecore AI Marketplace ecosystem',
      domain: 'app.sitecorecloud.io',
    },
    metadata: {
      domain: 'app.sitecorecloud.io',
      source: 'Sitecore AI Cloud Webhook (API Key Validated)',
      status: 'new',
    },
  },
];

function ensureStorageDir(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(memorySubmissions, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('Storage directory warning:', err);
  }
}

export function getAllSubmissions(): FormSubmission[] {
  try {
    ensureStorageDir();
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read from file storage, falling back to memory:', err);
  }
  return memorySubmissions;
}

export function saveSubmission(submission: FormSubmission): FormSubmission {
  try {
    ensureStorageDir();
    const current = getAllSubmissions();
    const updated = [submission, ...current];
    memorySubmissions = updated;

    fs.writeFileSync(STORAGE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return submission;
  } catch (err) {
    console.warn('Could not write to file storage, saving in memory:', err);
    memorySubmissions = [submission, ...memorySubmissions];
    return submission;
  }
}

export function deleteSubmission(id: string): boolean {
  try {
    ensureStorageDir();
    const current = getAllSubmissions();
    const updated = current.filter((item) => item.id !== id);
    memorySubmissions = updated;
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return true;
  } catch (err) {
    memorySubmissions = memorySubmissions.filter((item) => item.id !== id);
    return true;
  }
}
