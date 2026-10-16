import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import validatorRouter from "./routes/validator";
import apiStatusRouter from "./routes/apiStatus";
import { paths } from "./paths";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Version de l'application, lue depuis package.json (embarqué dans l'exe via pkg).
let APP_VERSION = "0.0.0";
try { APP_VERSION = (require("../package.json") as { version: string }).version || APP_VERSION; } catch { /* ignore */ }

// Endpoint de version (affiché dans l'UI pour la traçabilité).
app.get("/api/version", (_req, res) => res.json({ version: APP_VERSION }));

// Préfixe '/api' pour le routeur (déclaré AVANT le statique pour que les routes API priment).
app.use("/api", validatorRouter);
// Routeur de la page "Statut des APIs" (Bitwarden + test token)
app.use("/api/status", apiStatusRouter);

// ── Service des fichiers statiques (public/) ──────────────────────────────
// On n'utilise PAS express.static : son moteur (send) ne lit pas de façon fiable depuis le
// système de fichiers virtuel d'un exécutable `pkg`. On lit donc les fichiers via fs.readFileSync,
// ce qui fonctionne aussi bien en mode node qu'en mode exe (assets embarqués).
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

app.get("*", (req, res, next) => {
  if (req.method !== "GET") return next();
  // Normalise le chemin demandé ("/" → index.html) et empêche la traversée de répertoire.
  let rel = decodeURIComponent(req.path.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const safeRel = path.normalize(rel).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const filePath = path.join(paths.publicDir, safeRel);
  if (!filePath.startsWith(paths.publicDir)) return res.status(403).end();
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.send(fs.readFileSync(filePath));
  } catch {
    next();
  }
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`✅ Serveur prêt et disponible sur : ${url}`);

  // En mode packagé (exe) ou si OPEN_BROWSER=1, on ouvre automatiquement le navigateur par
  // défaut sur l'URL de l'application, pour un usage "double-clic" sans manipulation.
  // Désactivable avec OPEN_BROWSER=0 (utile en dev).
  const shouldOpen = paths.isPkg
    ? process.env.OPEN_BROWSER !== "0"
    : process.env.OPEN_BROWSER === "1";
  if (shouldOpen) openBrowser(url);
});

/** Ouvre l'URL dans le navigateur par défaut, selon l'OS. Échec silencieux. */
function openBrowser(url: string): void {
  try {
    // require local pour éviter tout impact si indisponible
    const { spawn } = require("child_process") as typeof import("child_process");
    const platform = process.platform;
    if (platform === "win32") {
      // 'start' est une commande interne de cmd ; le 1er argument "" est le titre de fenêtre.
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    /* ouverture best-effort : si elle échoue, l'URL reste affichée dans la console */
  }
}
