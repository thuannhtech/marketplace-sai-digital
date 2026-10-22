import fs from 'fs';
import path from 'path';
import os from 'os';

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

// Bundled static file in the repository (read-only on Vercel)
const BUNDLED_FILE = path.resolve(process.cwd(), '.brain', 'form-submissions.json');

// Writable storage location: os.tmpdir() on Vercel / serverless, or local .brain
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const STORAGE_DIR = isServerless ? os.tmpdir() : path.resolve(process.cwd(), '.brain');
const STORAGE_FILE = path.join(STORAGE_DIR, 'form-submissions.json');

// In-memory runtime cache to share across same-instance calls
let memorySubmissions: FormSubmission[] = [];

function loadSeedData(): FormSubmission[] {
  try {
    if (fs.existsSync(BUNDLED_FILE)) {
      const raw = fs.readFileSync(BUNDLED_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not read bundled seed file:', err);
  }
  return [];
}

function ensureStorageDir(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORAGE_FILE)) {
      const seed = loadSeedData();
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      memorySubmissions = seed;
    }
  } catch (err) {
    console.warn('[Storage] ensureStorageDir error:', err);
  }
}

export function getAllSubmissions(): FormSubmission[] {
  try {
    ensureStorageDir();
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Merge with any in-memory submissions that may not have hit disk
        const map = new Map<string, FormSubmission>();
        parsed.forEach((item) => map.set(item.id, item));
        memorySubmissions.forEach((item) => {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        });
        const combined = Array.from(map.values()).sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
        memorySubmissions = combined;
        return combined;
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not read from STORAGE_FILE, falling back to memory/seed:', err);
  }

  if (memorySubmissions.length === 0) {
    memorySubmissions = loadSeedData();
  }
  return memorySubmissions;
}

export function saveSubmission(submission: FormSubmission): FormSubmission {
  try {
    ensureStorageDir();
    const current = getAllSubmissions();
    const updated = [submission, ...current.filter((item) => item.id !== submission.id)];
    memorySubmissions = updated;

    fs.writeFileSync(STORAGE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return submission;
  } catch (err) {
    console.warn('[Storage] Could not write to STORAGE_FILE, saving in memory:', err);
    memorySubmissions = [submission, ...memorySubmissions.filter((item) => item.id !== submission.id)];
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
    console.warn('[Storage] deleteSubmission error:', err);
    memorySubmissions = memorySubmissions.filter((item) => item.id !== id);
    return false;
  }
}
