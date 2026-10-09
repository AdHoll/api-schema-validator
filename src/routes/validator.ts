import { Router, Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';
import SwaggerParser from '@apidevtools/swagger-parser';
import { extractRoutesFromYaml, validateResponseWithSpec, RouteEndpoint, ValidationResult } from '../services/yamlParser';

const router = Router();

// En production, on vérifie les certificats SSL. En dev, on les ignore pour les envs de test.
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production'
});

// Création automatique du répertoire d'uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Création automatique du répertoire de logs
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Bibliothèque de specs YAML embarquées dans le projet
const specLibraryDir = path.join(process.cwd(), 'spec-library');
if (!fs.existsSync(specLibraryDir)) {
  fs.mkdirSync(specLibraryDir, { recursive: true });
}

/**
 * Extrait un numéro de version comparable depuis un nom de fichier "[V1.11.14]...".
 * Retourne un tableau de nombres pour un tri sémantique (ex: [1, 11, 14]).
 */
function parseVersionKey(filename: string): number[] {
  const match = filename.match(/\[?V?(\d+(?:\.\d+)*)\]?/i);
  if (!match) return [0];
  return match[1].split('.').map((n) => parseInt(n, 10) || 0);
}

function compareVersionsDesc(a: string, b: string): number {
  const va = parseVersionKey(a);
  const vb = parseVersionKey(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const diff = (vb[i] || 0) - (va[i] || 0);
    if (diff !== 0) return diff;
  }
  return b.localeCompare(a);
}

/**
 * Remplace les valeurs sensibles par '***' dans un objet avant de le logger.
 * Les clés ciblées : client_secret, password, token, access_token, authorization.
 */
function sanitizeForLog(obj: Record<string, any>): Record<string, any> {
  const SENSITIVE_KEYS = new Set([
    'client_secret', 'password', 'token', 'access_token', 'authorization'
  ]);
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) =>
      SENSITIVE_KEYS.has(key.toLowerCase()) ? [key, '***'] : [key, value]
    )
  );
}

/**
 * Fonction utilitaire pour écrire un log d'appel API dans le dossier /logs
 */
function writeLog(entry: {
  type: 'OAUTH_TOKEN' | 'API_REQUEST';
  url: string;
  method: string;
  requestHeaders?: Record<string, any>;
  requestBody?: Record<string, any>;
  responseStatus?: number;
  responseData?: any;
  error?: any;
}) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
  const logFilePath = path.join(logDir, `api-calls-${dateStr}.log`);

  const logContent = `
================================================================================
[${now.toISOString()}] [${entry.type}]
METHOD: ${entry.method}
URL: ${entry.url}
REQUEST HEADERS: ${JSON.stringify(sanitizeForLog(entry.requestHeaders || {}), null, 2)}
REQUEST BODY/PARAMS: ${JSON.stringify(sanitizeForLog(entry.requestBody || {}), null, 2)}
RESPONSE STATUS: ${entry.responseStatus || 'N/A'}
RESPONSE DATA: ${JSON.stringify(entry.responseData || entry.error || {}, null, 2)}
================================================================================
`;

  fs.appendFileSync(logFilePath, logContent, 'utf-8');
}

/**
 * Résout les path parameters d'une route OpenAPI.
 * Priorité : valeur saisie par l'utilisateur > example YAML > default YAML > fallback typé.
 */
function resolvePathParameters(
  routePath: string,
  pathSpec: any,
  method: string,
  userParams: Record<string, string> = {}
): string {
  const endpoint = pathSpec?.[method.toLowerCase()];
  const parameters: any[] = [
    ...(pathSpec?.parameters || []),
    ...(endpoint?.parameters || [])
  ];

  return routePath.replace(/\{([^}]+)\}/g, (_match, paramName) => {
    // 1. Valeur saisie par l'utilisateur dans l'UI
    if (userParams[paramName] !== undefined && userParams[paramName] !== '') {
      return encodeURIComponent(userParams[paramName]);
    }

    const paramSpec = parameters.find(
      (p: any) => p.in === 'path' && p.name === paramName
    );

    if (!paramSpec) return '1';

    const schema = paramSpec.schema || {};

    // 2. Example ou default définis dans le YAML
    if (paramSpec.example !== undefined) return encodeURIComponent(String(paramSpec.example));
    if (schema.example !== undefined) return encodeURIComponent(String(schema.example));
    if (schema.default !== undefined) return encodeURIComponent(String(schema.default));

    // 3. Fallback basé sur le type
    switch (schema.type) {
      case 'integer':
      case 'number': return '1';
      case 'boolean': return 'true';
      default: return encodeURIComponent(paramName);
    }
  });
}

/**
 * Construit les query parameters à ajouter à l'URL.
 * Utilise les valeurs saisies par l'utilisateur, avec fallback sur example/default du YAML.
 * Ignore les paramètres déjà intégrés dans le path.
 */
function resolveQueryParameters(
  pathSpec: any,
  method: string,
  userParams: Record<string, string>
): Record<string, string> {
  const endpoint = pathSpec?.[method.toLowerCase()];
  const parameters: any[] = [
    ...(pathSpec?.parameters || []),
    ...(endpoint?.parameters || [])
  ];

  const queryParams: Record<string, string> = {};

  for (const p of parameters) {
    if (p.in !== 'query') continue;

    const schema = p.schema || {};
    const userValue = userParams[p.name];

    // 1. Valeur saisie par l'utilisateur : toujours prioritaire
    if (userValue !== undefined && userValue !== '') {
      queryParams[p.name] = userValue;
      continue;
    }

    // 2. Sans valeur utilisateur : on n'utilise example/default QUE pour les paramètres
    //    obligatoires. Un paramètre OPTIONNEL non renseigné est simplement omis.
    if (p.required === true) {
      if (p.example !== undefined) {
        queryParams[p.name] = String(p.example);
      } else if (schema.example !== undefined) {
        queryParams[p.name] = String(schema.example);
      } else if (schema.default !== undefined) {
        queryParams[p.name] = String(schema.default);
      }
    }
    // Paramètre optionnel sans valeur utilisateur → non ajouté
  }

  return queryParams;
}

/**
 * Remplace les placeholders {{variable}} dans une chaîne (body JSON) par les valeurs
 * fournies dans userParams. Les placeholders non résolus sont laissés tels quels
 * (ils seront visibles dans la requête, ce qui aide au débogage).
 */
function resolveTemplate(template: string, userParams: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, varName) => {
    const value = userParams[varName];
    return (value !== undefined && value !== '') ? value : match;
  });
}

const upload = multer({ dest: uploadDir });

// Route : liste les versions de specs YAML disponibles dans spec-library/
// Ne garde que les fichiers "unified-backoffice-api", triés de la plus récente à la plus ancienne.
router.get('/spec-versions', (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(specLibraryDir)
      .filter((f) => f.toLowerCase().endsWith('.yaml') && f.includes('unified-backoffice-api'))
      .sort(compareVersionsDesc);

    const versions = files.map((filename) => {
      const versionMatch = filename.match(/\[?V?(\d+(?:\.\d+)*)\]?/i);
      return {
        filename,
        label: versionMatch ? `v${versionMatch[1]}` : filename,
      };
    });

    return res.json({ versions });
  } catch (error: any) {
    return res.status(500).json({ error: 'Impossible de lister les versions : ' + error.message });
  }
});

// Route : renvoie le contenu brut d'une spec YAML embarquée
router.get('/spec/:filename', (req: Request, res: Response) => {
  try {
    // Sécurité : on n'autorise que le nom de base (empêche la traversée de répertoire)
    const requested = path.basename(req.params.filename);
    const filePath = path.join(specLibraryDir, requested);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Version introuvable.' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/yaml').send(content);
  } catch (error: any) {
    return res.status(500).json({ error: 'Impossible de lire la spec : ' + error.message });
  }
});

// Route 1 : Analyse le YAML et extrait la liste des endpoints
router.post('/parse-routes', upload.single('spec'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Le fichier YAML (champ "spec") est requis.' });
    }

    const { routes, tagOrder } = await extractRoutesFromYaml(req.file.path);

    // Nettoyage du fichier temporaire
    fs.unlink(req.file.path, () => {});

    return res.json({ routes, tagOrder });
  } catch (error: any) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(400).json({ error: 'Erreur lors de la lecture du fichier YAML : ' + error.message });
  }
});

// Route 2 : Authentification OAuth2 (b2b / b2c) + Validation en batch des routes
router.post('/validate-batch', upload.single('spec'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Le fichier YAML (champ "spec") est requis.' });
    }

    const { targetUrl, clientId, clientSecret, scope, selectedRoutes } = req.body;

    if (!targetUrl || !clientId || !clientSecret || !scope) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Les paramètres d\'authentification sont incomplets.' });
    }

    if (scope !== 'b2b' && scope !== 'b2c') {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Le scope doit être obligatoirement "b2b" ou "b2c".' });
    }

    const routesToTest: RouteEndpoint[] = JSON.parse(selectedRoutes || '[]');
    const userParams: Record<string, string> = JSON.parse(req.body.userParams || '{}');
    // Corps JSON par route, indexés par clé "METHOD path" (ex: "POST /api/v1/cart/checkCart")
    const requestBodies: Record<string, string> = JSON.parse(req.body.requestBodies || '{}');
    const baseUrl = targetUrl.replace(/\/$/, '');

    // 1. Obtention du token OAuth2 avec Query Parameters dans la requête POST
    const tokenUrl = `${baseUrl}/api/v1/security/token`;
    let token = '';

    const queryParams = {
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope,
      grant_type: 'client_credentials'
    };

    const tokenHeaders = {
      'Accept': 'application/json'
    };

    try {
      const tokenResponse = await axios.post(tokenUrl, null, {
        params: queryParams,
        headers: tokenHeaders,
        httpsAgent
      });

      token = tokenResponse.data?.access_token || tokenResponse.data?.token || tokenResponse.data?.data?.access_token;

      // Log de l'obtention réussie du Token (secrets masqués)
      writeLog({
        type: 'OAUTH_TOKEN',
        url: tokenUrl,
        method: 'POST',
        requestHeaders: tokenHeaders,
        requestBody: queryParams,
        responseStatus: tokenResponse.status,
        responseData: tokenResponse.data
      });

    } catch (authErr: any) {
      fs.unlink(req.file.path, () => {});

      let errorDetail = authErr.message;
      if (authErr.response) {
        errorDetail = `[HTTP ${authErr.response.status}] ${JSON.stringify(authErr.response.data)}`;
      } else if (authErr.request) {
        errorDetail = `Pas de réponse du serveur (${authErr.code || 'Timeout / Réseau / VPN / SSL'})`;
      }

      // Log de l'échec de récupération du token (secrets masqués)
      writeLog({
        type: 'OAUTH_TOKEN',
        url: tokenUrl,
        method: 'POST',
        requestHeaders: tokenHeaders,
        requestBody: queryParams,
        responseStatus: authErr.response?.status,
        error: errorDetail
      });

      return res.status(401).json({
        error: `Échec de l'authentification sur '${tokenUrl}'`,
        details: errorDetail
      });
    }

    if (!token) {
      fs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: 'Aucun jeton (access_token) retourné par le serveur de sécurité.' });
    }

    // 2. Résolution du schéma YAML
    const apiSpec = await SwaggerParser.dereference(req.file.path);
    const results: ValidationResult[] = [];

    // 3. Exécution des tests par route
    for (const route of routesToTest) {
      // Résolution des path parameters avec priorité aux valeurs saisies par l'utilisateur
      const resolvedPath = resolvePathParameters(
        route.path,
        apiSpec.paths?.[route.path],
        route.method,
        userParams
      );

      // Résolution des query parameters
      const queryParams = resolveQueryParameters(
        apiSpec.paths?.[route.path],
        route.method,
        userParams
      );

      const fullUrl = `${baseUrl}${resolvedPath}`;
      // URL réellement appelée (path résolu + query params) pour les logs et la console
      const fullUrlWithQuery = Object.keys(queryParams).length > 0
        ? `${fullUrl}?${new URLSearchParams(queryParams).toString()}`
        : fullUrl;

      const requestHeaders: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      };

      // Résolution du corps JSON pour les méthodes qui en portent un
      let requestData: any = undefined;
      let bodyParseError: string | null = null;
      const methodUpper = route.method.toUpperCase();
      const bodyKey = `${methodUpper} ${route.path}`;
      const rawBody = requestBodies[bodyKey];

      if (rawBody && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper)) {
        const resolvedBody = resolveTemplate(rawBody, userParams);
        try {
          requestData = JSON.parse(resolvedBody);
          requestHeaders['Content-Type'] = 'application/json';
        } catch (e: any) {
          bodyParseError = `Corps JSON invalide après résolution des variables : ${e.message}`;
        }
      }

      // Si le body est invalide, on ne tente pas l'appel — on remonte l'erreur directement
      if (bodyParseError) {
        writeLog({
          type: 'API_REQUEST',
          url: fullUrl,
          method: route.method,
          requestHeaders,
          error: bodyParseError
        });
        results.push({
          path: route.path,
          method: route.method,
          valid: false,
          errors: [bodyParseError]
        });
        continue;
      }

      try {
        const response = await axios({
          url: fullUrl,
          method: route.method,
          headers: requestHeaders,
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
          data: requestData,
          httpsAgent,
          validateStatus: () => true
        });

        // Log de l'appel HTTP effectué (token masqué)
        writeLog({
          type: 'API_REQUEST',
          url: fullUrlWithQuery,
          method: route.method,
          requestHeaders,
          requestBody: requestData,
          responseStatus: response.status,
          responseData: response.data
        });

        const valResult = validateResponseWithSpec(
          apiSpec,
          route.path,
          route.method,
          response.status,
          response.data
        );

        valResult.requestUrl = fullUrlWithQuery; // URL réellement appelée
        results.push(valResult);
      } catch (err: any) {
        // Log de l'erreur réseau / HTTP (token masqué)
        writeLog({
          type: 'API_REQUEST',
          url: fullUrlWithQuery,
          method: route.method,
          requestHeaders,
          error: err.message
        });

        results.push({
          path: route.path,
          method: route.method,
          valid: false,
          errors: [`Erreur lors de l'appel HTTP : ${err.message}`],
          requestUrl: fullUrlWithQuery
        });
      }
    }

    // Nettoyage du fichier temporaire
    fs.unlink(req.file.path, () => {});

    return res.json({
      tokenObtained: token,
      results
    });

  } catch (error: any) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({
      error: 'Erreur serveur lors de la validation du batch.',
      details: error.message
    });
  }
});

export default router;
