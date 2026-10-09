import { spawn } from 'child_process';

/**
 * Service d'accès à Bitwarden via la CLI `bw`.
 *
 * Sécurité :
 *  - Le master password n'est jamais passé en argument de ligne de commande
 *    (visible dans la liste des process) : il est transmis via STDIN.
 *  - Il n'est jamais stocké ni logué ; il est utilisé le temps du `unlock` puis oublié.
 *  - Seule la BW_SESSION est gardée EN MÉMOIRE (jamais sur disque, jamais loguée),
 *    avec une expiration courte.
 */

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

let sessionKey: string | null = null;
let sessionExpiresAt = 0;

/** Exécute une commande `bw` et retourne stdout. Le mot de passe éventuel passe par stdin. */
// Sur Windows, l'exécutable installé via npm est `bw.cmd`. Node (spawn sans shell)
// ne résout pas automatiquement l'extension → on détecte le binaire à utiliser.
const BW_BIN = process.platform === 'win32' ? 'bw.cmd' : 'bw';

function runBw(
  args: string[],
  opts: { stdin?: string; env?: Record<string, string> } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(BW_BIN, args, {
      env: { ...process.env, ...(opts.env || {}) },
      // shell:true sur Windows pour résoudre le .cmd ; le mot de passe passe par stdin,
      // jamais par la ligne de commande, donc pas de risque d'injection via les args.
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => reject(new Error(`Impossible d'exécuter bw : ${err.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `bw a échoué (code ${code})`));
    });

    if (opts.stdin !== undefined) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
  });
}

/** Indique si une session est active et non expirée. */
export function isUnlocked(): boolean {
  return !!sessionKey && Date.now() < sessionExpiresAt;
}

/** Temps restant (ms) avant expiration de la session, 0 si verrouillé. */
export function sessionRemainingMs(): number {
  if (!isUnlocked()) return 0;
  return sessionExpiresAt - Date.now();
}

/**
 * Déverrouille le coffre avec le master password (transmis via stdin).
 * Mémorise la BW_SESSION en mémoire avec expiration. Ne retourne jamais la clé.
 */
export async function unlock(masterPassword: string): Promise<void> {
  // --raw renvoie uniquement la clé de session sur stdout
  // Le mot de passe est fourni par stdin via --passwordenv n'est pas utilisé ;
  // on utilise l'option `unlock` qui lit le mot de passe depuis stdin avec --raw.
  const key = await runBw(['unlock', '--raw'], { stdin: masterPassword + '\n' });
  if (!key) throw new Error('Déverrouillage échoué : aucune session retournée.');
  sessionKey = key;
  sessionExpiresAt = Date.now() + SESSION_TTL_MS;
  orgCache = null;
  collectionCache = null;
}

/** Verrouille le coffre et purge la session mémoire. */
export async function lock(): Promise<void> {
  try {
    await runBw(['lock']);
  } finally {
    sessionKey = null;
    sessionExpiresAt = 0;
    orgCache = null;
    collectionCache = null;
  }
}

export interface BwLoginItem {
  url?: string;
  username?: string;
  password?: string;
}

export interface BwItemRef {
  itemName: string;        // nom exact de l'entrée
  owner?: string;          // nom de l'organisation (propriétaire). Vide = coffre personnel
  collection?: string;     // nom de la collection
}

function bwEnv() {
  return { BW_SESSION: sessionKey as string };
}

// Caches de résolution nom → id (vidés à chaque unlock)
let orgCache: Array<{ id: string; name: string }> | null = null;
let collectionCache: Array<{ id: string; name: string; organizationId: string }> | null = null;

async function listOrganizations() {
  if (orgCache) return orgCache;
  const raw = await runBw(['list', 'organizations'], { env: bwEnv() });
  orgCache = JSON.parse(raw || '[]').map((o: any) => ({ id: o.id, name: o.name }));
  return orgCache!;
}

async function listCollections() {
  if (collectionCache) return collectionCache;
  const raw = await runBw(['list', 'collections'], { env: bwEnv() });
  collectionCache = JSON.parse(raw || '[]').map((c: any) => ({
    id: c.id, name: c.name, organizationId: c.organizationId,
  }));
  return collectionCache!;
}

/**
 * Récupère un item de login en le résolvant par propriétaire + collection + nom.
 * - owner (organisation) et collection sont fournis par NOM, résolus en id en interne.
 * - Si owner/collection sont absents, on cherche par nom dans tout le coffre.
 */
export async function getLoginItem(ref: BwItemRef): Promise<BwLoginItem> {
  if (!isUnlocked()) throw new Error('Coffre verrouillé. Déverrouillez d\'abord.');

  const args = ['list', 'items', '--search', ref.itemName];

  // Résoudre l'organisation (propriétaire) par nom → id
  if (ref.owner) {
    const orgs = await listOrganizations();
    const org = orgs.find((o) => o.name === ref.owner);
    if (!org) throw new Error(`Organisation "${ref.owner}" introuvable.`);
    args.push('--organizationid', org.id);

    // Résoudre la collection par nom (dans cette organisation) → id
    if (ref.collection) {
      const cols = await listCollections();
      const col = cols.find((c) => c.name === ref.collection && c.organizationId === org.id);
      if (!col) throw new Error(`Collection "${ref.collection}" introuvable dans "${ref.owner}".`);
      args.push('--collectionid', col.id);
    }
  }

  const raw = await runBw(args, { env: bwEnv() });
  let items: any[];
  try {
    items = JSON.parse(raw || '[]');
  } catch {
    throw new Error(`Réponse inattendue de bw pour "${ref.itemName}".`);
  }

  // --search est "fuzzy" : on retient la correspondance EXACTE du nom
  const item = items.find((it) => it.name === ref.itemName) || items[0];
  if (!item) throw new Error(`Entrée "${ref.itemName}" introuvable.`);

  const login = item.login || {};
  const url = Array.isArray(login.uris) && login.uris[0]?.uri ? login.uris[0].uri : undefined;
  return { url, username: login.username, password: login.password };
}

/** Rafraîchit l'expiration de la session (appelé lors d'une activité). */
export function touchSession(): void {
  if (isUnlocked()) sessionExpiresAt = Date.now() + SESSION_TTL_MS;
}
