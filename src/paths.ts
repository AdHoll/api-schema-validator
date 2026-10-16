/**
 * Résolution des chemins compatible avec :
 *  - exécution normale (ts-node / node dist)  → chemins relatifs au projet ;
 *  - exécution packagée en EXE via `pkg`       → assets embarqués dans le snapshot
 *    (lecture seule) et données runtime écrites À CÔTÉ de l'exe.
 *
 * Deux familles de chemins :
 *  - ASSETS (lecture seule) : public/, spec-library/ → embarqués dans l'exe.
 *  - DONNÉES RUNTIME (écriture) : logs/, uploads/, api-targets.json → à côté de l'exe.
 */
import path from "path";
import fs from "fs";

// true lorsque l'application tourne depuis un binaire généré par `pkg`.
const isPkg = (process as any).pkg !== undefined;

/**
 * Racine des ASSETS embarqués (lecture seule).
 *  - pkg  : le snapshot est monté ; __dirname pointe dans le snapshot (dist/) → la racine
 *           projet est un niveau au-dessus de dist/.
 *  - node : dist/ (ou src/ via ts-node) → racine projet un niveau au-dessus.
 */
const assetsRoot = path.join(__dirname, "..");

/**
 * Racine des DONNÉES RUNTIME (écriture).
 *  - pkg  : dossier contenant l'exe (process.execPath) → logs/uploads/api-targets.json
 *           sont créés/lus à côté de l'exe, visibles et modifiables par l'utilisateur.
 *  - node : cwd du processus (comportement historique).
 */
const runtimeRoot = isPkg ? path.dirname(process.execPath) : process.cwd();

export const paths = {
  isPkg,
  // Assets embarqués (lecture seule)
  publicDir: path.join(assetsRoot, "public"),
  specLibraryDir: path.join(assetsRoot, "spec-library"),
  // Données runtime (écriture) — à côté de l'exe en mode packagé
  logsDir: path.join(runtimeRoot, "logs"),
  uploadsDir: path.join(runtimeRoot, "uploads"),
  targetsFile: path.join(runtimeRoot, "api-targets.json"),
};

/** Crée un répertoire s'il n'existe pas (pour les dossiers runtime en écriture). */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
