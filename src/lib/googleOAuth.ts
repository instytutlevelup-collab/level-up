import { google } from 'googleapis';
import { Credentials } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const TOKENS_PATH = path.join(process.cwd(), 'src/lib/credentials/tokens.json');

function ensureEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Brak zmiennej środowiskowej ${name}`);
  return v;
}

export function getOAuthClient() {
  const clientId = ensureEnv('GOOGLE_CLIENT_ID');
  const clientSecret = ensureEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = ensureEnv('GOOGLE_REDIRECT_URI');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function saveTokens(tokens: Credentials) {
  const dir = path.dirname(TOKENS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

export function loadTokens(): Credentials | null {
  try {
    const raw = fs.readFileSync(TOKENS_PATH, 'utf-8');
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function getAuthedClientOrNull() {
  const oauth2Client = getOAuthClient();
  const tokens = loadTokens();
  if (!tokens) return null;
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}