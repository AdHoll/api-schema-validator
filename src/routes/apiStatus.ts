import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import * as bw from '../services/bitwarden';

const router = Router();

// En production on vérifie les certificats SSL ; en dev on les ignore (envs de test).
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production',
});

// Fichier de config partageable : liste des APIs à tester (AUCUN secret dedans)
const targetsFile = path.join(process.cwd(), 'api-targets.json');

export interface ApiTarget {
  id: string;              // identifiant interne (généré)
  label: string;          // libellé affiché
  owner?: string;         // nom de l'organisation Bitwarden (propriétaire)
  collection?: string;    // nom de la collection Bitwarden
  bwItemName: string;     // nom exact de l'entrée Bitwarden
  scope: 'b2b' | 'b2c';
  tags: string[];         // ex: ["Prod"], ["QA"]
}

function readTargets(): ApiTarget[] {
  try {
    if (!fs.existsSync(targetsFile)) return [];
    const raw = fs.readFileSync(targetsFile, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.targets) ? data.targets : [];
  } catch {
    return [];
  }
}

function writeTargets(targets: ApiTarget[]): void {
  fs.writeFileSync(targetsFile, JSON.stringify({ targets }, null, 2), 'utf-8');
}

// ── État du coffre ────────────────────────────────────────────────────
router.get('/vault-status', (_req: Request, res: Response) => {
  res.json({ unlocked: bw.isUnlocked(), remainingMs: bw.sessionRemainingMs() });
});

// ── Déverrouillage (master password transmis en mémoire, jamais logué) ──
router.post('/unlock', async (req: Request, res: Response) => {
  const masterPassword = req.body?.masterPassword;
  if (!masterPassword) {
    return res.status(400).json({ error: 'Le mot de passe maître est requis.' });
  }
  try {
    await bw.unlock(masterPassword);
    return res.json({ unlocked: true, remainingMs: bw.sessionRemainingMs() });
  } catch (e: any) {
    return res.status(401).json({ error: 'Déverrouillage échoué : ' + e.message });
  } finally {
    // On n'a aucune raison de garder le mot de passe en mémoire
    req.body.masterPassword = undefined;
  }
});

router.post('/lock', async (_req: Request, res: Response) => {
  try {
    await bw.lock();
  } catch { /* ignore */ }
  return res.json({ unlocked: false });
});

// ── Gestion des cibles (config partageable) ─────────────────────────────
router.get('/targets', (_req: Request, res: Response) => {
  res.json({ targets: readTargets() });
});

router.post('/targets', (req: Request, res: Response) => {
  const targets = req.body?.targets;
  if (!Array.isArray(targets)) {
    return res.status(400).json({ error: 'targets doit être un tableau.' });
  }
  try {
    writeTargets(targets);
    return res.json({ targets });
  } catch (e: any) {
    return res.status(500).json({ error: 'Impossible d\'écrire la config : ' + e.message });
  }
});

/**
 * Teste la route token OAuth2 d'une cible.
 * Récupère les identifiants depuis Bitwarden, appelle /api/v1/security/token,
 * et renvoie le statut SANS exposer les secrets.
 */
async function testTarget(t: ApiTarget) {
  const started = Date.now();
  try {
    const creds = await bw.getLoginItem({
      itemName: t.bwItemName,
      owner: t.owner,
      collection: t.collection,
    });

    if (!creds.url || !creds.username || !creds.password) {
      return {
        id: t.id, ok: false, statusCode: null, durationMs: Date.now() - started,
        error: 'Identifiants incomplets dans Bitwarden (url/username/password).',
      };
    }

    const baseUrl = creds.url.replace(/\/$/, '');
    const tokenUrl = `${baseUrl}/api/v1/security/token`;
    const response = await axios.post(tokenUrl, null, {
      params: {
        client_id: creds.username,
        client_secret: creds.password,
        scope: t.scope,
        grant_type: 'client_credentials',
      },
      headers: { Accept: 'application/json' },
      httpsAgent,
      validateStatus: () => true,
      timeout: 15000,
    });

    const token =
      response.data?.access_token || response.data?.token || response.data?.data?.access_token;
    const ok = response.status >= 200 && response.status < 300 && !!token;

    return {
      id: t.id,
      ok,
      statusCode: response.status,
      durationMs: Date.now() - started,
      // Réponse brute renvoyée par l'API (pour l'inspection au clic côté UI)
      responseBody: response.data,
      error: ok ? null : 'Pas de token ou code HTTP non 2xx.',
    };
  } catch (e: any) {
    return {
      id: t.id, ok: false, statusCode: e.response?.status ?? null,
      durationMs: Date.now() - started,
      responseBody: e.response?.data,
      error: e.message,
    };
  }
}

// ── Test : par liste d'ids ou par tags ──────────────────────────────────
router.post('/test', async (req: Request, res: Response) => {
  if (!bw.isUnlocked()) {
    return res.status(401).json({ error: 'Coffre verrouillé. Déverrouillez d\'abord.' });
  }
  bw.touchSession();

  const allTargets = readTargets();
  const { ids, tags } = req.body || {};

  let selected = allTargets;
  if (Array.isArray(ids) && ids.length) {
    selected = allTargets.filter((t) => ids.includes(t.id));
  } else if (Array.isArray(tags) && tags.length) {
    selected = allTargets.filter((t) => (t.tags || []).some((tag) => tags.includes(tag)));
  }

  // Exécution séquentielle pour ne pas saturer le coffre / les cibles
  const results = [];
  for (const t of selected) {
    results.push(await testTarget(t));
  }

  return res.json({ results });
});

/**
 * Ouvre une vraie fenêtre PowerShell préparée pour configurer le serveur Bitwarden EU
 * puis lancer `bw login` (interactif, gère le 2FA). Fonctionne car le serveur tourne en local.
 */
router.post('/open-login-terminal', (_req: Request, res: Response) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Disponible uniquement sur Windows.' });
  }
  try {
    // -NoExit garde la fenêtre ouverte après les commandes pour l'interaction (2FA, mdp)
    const psCommand =
      'Write-Host \'Configuration du serveur Bitwarden EU...\' -ForegroundColor Cyan; ' +
      'bw logout; ' +
      'bw config server https://vault.bitwarden.eu; ' +
      'Write-Host \'Connexion a Bitwarden (suivez les invites)...\' -ForegroundColor Cyan; ' +
      'bw login';

    // cmd /c start ouvre une nouvelle fenêtre détachée
    const child = spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', psCommand], {
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true,
    });
    child.unref();

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Impossible d\'ouvrir le terminal : ' + e.message });
  }
});

export default router;
