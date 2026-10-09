import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

// verbose:true expose la valeur fautive dans err.data (nécessaire pour détecter les null)
const ajv = new Ajv({ allErrors: true, strict: false, verbose: true });
addFormats(ajv);

// Cache des schémas AJV compilés : clé = `METHOD:path:statusCode`
const schemaCache = new Map<string, ValidateFunction>();

export interface RouteParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: { type?: string; example?: any; default?: any };
  example?: any;
}

export interface RouteEndpoint {
  path: string;
  method: string;
  tag?: string;              // premier tag OpenAPI déclaré sur la route
  summary?: string;          // résumé court de la route (optionnel)
  parameters?: RouteParameter[];
  hasBody?: boolean;         // true si la route a un requestBody JSON
  bodySchemaName?: string;   // nom du schéma du body (ex: "CheckCartReq")
  bodyTemplate?: string;     // squelette JSON pré-généré avec placeholders {{champ}}
}

export interface ParseRoutesResult {
  routes: RouteEndpoint[];
  tagOrder: string[];   // ordre des tags tel que défini dans apiSpec.tags[]
}

export interface ValidationResult {
  path: string;
  method: string;
  statusCode?: number;
  valid: boolean;
  errors?: string[];         // violations sur champs REQUIS (bloquant)
  warnings?: string[];       // violations sur champs OPTIONNELS (non bloquant)
  nullables?: string[];      // champ null alors qu'un type est attendu (non bloquant)
  undocumented?: string[];   // champ présent dans la réponse mais absent du schéma YAML (non bloquant)
  notImplemented?: string[]; // champ optionnel du YAML absent de la réponse (non bloquant)
  responseBody?: any;
  expectedSchema?: any;
  statusDeclaredInYaml?: boolean;
  isUnhandled?: boolean;
  requestUrl?: string;   // URL réellement appelée (path résolu + query params)
}

/**
 * Génère récursivement un squelette JSON à partir d'un schéma OpenAPI (déréférencé).
 * - Ne conserve que les champs `required` des objets (pour un body minimal).
 * - Les valeurs scalaires deviennent un placeholder {{nomDuChamp}} ou l'example du YAML.
 * - Protège contre la récursion infinie (schémas cycliques) via un compteur de profondeur.
 */
function generateBodySkeleton(schema: any, keyName = '', depth = 0): any {
  if (!schema || depth > 6) return null;

  // Type objet : on ne garde que les champs requis
  if (schema.type === 'object' || schema.properties) {
    const required: string[] = schema.required || [];
    const props = schema.properties || {};
    const obj: Record<string, any> = {};

    // Si aucun champ requis explicite, on prend tous les champs de premier niveau (utile pour éditer)
    const keys = required.length > 0 ? required : Object.keys(props);

    for (const key of keys) {
      if (props[key]) {
        obj[key] = generateBodySkeleton(props[key], key, depth + 1);
      } else {
        obj[key] = `{{${key}}}`;
      }
    }
    return obj;
  }

  // Type array : on met un seul élément d'exemple
  if (schema.type === 'array') {
    const item = generateBodySkeleton(schema.items, keyName, depth + 1);
    return [item];
  }

  // Valeur scalaire : example du YAML sinon placeholder {{champ}}
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  // Placeholder nommé (résolu côté serveur au moment de l'appel)
  return `{{${keyName || 'value'}}}`;
}

/**
 * Extrait toutes les routes et leurs méthodes HTTP du fichier YAML,
 * ainsi que leurs paramètres path/query et le tag de section.
 * Retourne aussi l'ordre des tags défini dans apiSpec.tags[].
 */
export async function extractRoutesFromYaml(
  yamlFilePath: string,
): Promise<ParseRoutesResult> {
  const apiSpec = await SwaggerParser.dereference(yamlFilePath);
  const paths = (apiSpec as any).paths || {};
  const routes: RouteEndpoint[] = [];

  // Ordre des tags déclaré au niveau racine du YAML (apiSpec.tags[])
  const tagOrder: string[] = ((apiSpec as any).tags || []).map((t: any) => t.name as string);

  const validMethods = ["get", "post", "put", "delete", "patch"];

  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    const pathLevelParams: any[] = pathItem.parameters || [];

    for (const methodKey of Object.keys(pathItem)) {
      if (validMethods.includes(methodKey.toLowerCase())) {
        const methodItem = pathItem[methodKey];
        const methodLevelParams: any[] = methodItem?.parameters || [];

        // Fusion path-level + method-level, dédoublonnage par nom (method a priorité)
        const mergedParamsMap = new Map<string, any>();
        for (const p of pathLevelParams) mergedParamsMap.set(p.name, p);
        for (const p of methodLevelParams) mergedParamsMap.set(p.name, p);

        const parameters: RouteParameter[] = Array.from(mergedParamsMap.values())
          .filter((p: any) => p.in === 'path' || p.in === 'query')
          .map((p: any) => ({
            name: p.name,
            in: p.in as 'path' | 'query',
            required: p.required ?? (p.in === 'path' ? true : false),
            description: p.description,
            schema: p.schema
              ? { type: p.schema.type, example: p.schema.example, default: p.schema.default }
              : undefined,
            example: p.example,
          }));

        // Premier tag déclaré sur la route (convention OpenAPI : une route = un tag principal)
        const tag: string | undefined = methodItem?.tags?.[0];

        // Extraction du requestBody JSON (schéma + squelette pré-généré)
        let hasBody = false;
        let bodySchemaName: string | undefined;
        let bodyTemplate: string | undefined;

        const bodySchema = methodItem?.requestBody?.content?.['application/json']?.schema;
        if (bodySchema) {
          hasBody = true;
          // Nom du schéma : title si présent, sinon on laisse vide (le $ref est déjà déréférencé)
          bodySchemaName = bodySchema.title || methodItem.requestBody['x-schema-name'];
          try {
            const skeleton = generateBodySkeleton(bodySchema);
            bodyTemplate = JSON.stringify(skeleton, null, 2);
          } catch {
            bodyTemplate = '{}';
          }
        }

        routes.push({
          path: pathKey,
          method: methodKey.toUpperCase(),
          tag,
          summary: methodItem?.summary,
          parameters,
          hasBody,
          bodySchemaName,
          bodyTemplate,
        });
      }
    }
  }

  return { routes, tagOrder };
}

/**
 * Détermine si le champ fautif d'une erreur AJV est RÉELLEMENT bloquant (requis).
 *
 * Principe : un champ n'est bloquant que si TOUS les maillons du chemin qui y mène
 * sont eux-mêmes requis. Si un conteneur intermédiaire est optionnel (ex: `seatConfigs`
 * non requis dans `offers[]`), alors une contrainte interne à ce conteneur ne doit PAS
 * bloquer — c'est un simple avertissement, puisque le conteneur peut être absent.
 *
 * Gère :
 *  - err.keyword === 'required' : le champ manquant est `err.params.missingProperty`,
 *    exigé par le conteneur pointé par instancePath.
 *  - autres (type, format…) : le champ fautif est la dernière clé de instancePath.
 */
function isFieldRequired(err: any, rootSchema: any): boolean {
  const instancePath: string = err.instancePath || '';

  // Construit la liste des clés de propriété menant au champ fautif (indices de tableau exclus)
  const pathParts = instancePath.split('/').filter(Boolean);

  // Pour une erreur "required", le champ concerné est la propriété manquante
  // rattachée au conteneur = instancePath. On l'ajoute au chemin.
  const missing = err.keyword === 'required' ? err.params?.missingProperty : undefined;
  const fullParts = missing ? [...pathParts, missing] : pathParts;

  if (fullParts.length === 0) return false;

  // Remonte le schéma maillon par maillon. À chaque niveau objet, on vérifie que
  // la clé enfant figure dans le `required` du parent. Dès qu'un maillon est optionnel,
  // tout ce qui est en dessous est optionnel → non bloquant (warning).
  let schema = rootSchema;
  for (const part of fullParts) {
    if (!schema) return false;

    // Traverser les tableaux : l'index ne porte pas de contrainte "required"
    if (/^\d+$/.test(part)) {
      schema = schema.items;
      continue;
    }

    // Au niveau objet : la propriété "part" doit être requise dans le parent
    const requiredList: string[] = schema.required || [];
    if (!requiredList.includes(part)) {
      return false; // un maillon optionnel → non bloquant
    }

    // Descendre dans la propriété
    schema = schema.properties?.[part];
    if (schema?.$ref) return false; // schéma non déréférencé : on ne peut pas trancher → warning
  }

  // Tous les maillons sont requis → champ réellement bloquant
  return true;
}

/**
 * Compare récursivement une valeur de réponse à son schéma pour détecter :
 *  - undocumented : propriétés présentes dans la réponse mais absentes du schéma
 *  - notImplemented : propriétés OPTIONNELLES du schéma absentes de la réponse
 *
 * Règles :
 *  - Si un objet entier est absent de la réponse, on le signale une seule fois (notImplemented)
 *    sans descendre dans ses sous-champs.
 *  - Les chemins utilisent la notation "/parent/enfant" (les tableaux via "/parent/0/...").
 */
function diffResponseVsSchema(
  data: any,
  schema: any,
  path: string,
  out: { undocumented: string[]; notImplemented: string[] },
  depth = 0,
): void {
  if (!schema || depth > 8) return;

  // Objet : comparer les propriétés
  if (schema.type === 'object' || schema.properties) {
    const props = schema.properties || {};
    const required: string[] = schema.required || [];

    // Si la réponse n'est pas un objet exploitable, on ne descend pas
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return;

    // 1) undocumented : clés de la réponse absentes du schéma
    //    (seulement si le schéma ne restreint pas déjà additionalProperties à false)
    for (const key of Object.keys(data)) {
      if (!props[key]) {
        out.undocumented.push(`Champ '${path}/${key}' présent dans la réponse mais absent du YAML`);
      }
    }

    // 2) parcourir les propriétés déclarées
    for (const key of Object.keys(props)) {
      const childPath = `${path}/${key}`;
      const present = Object.prototype.hasOwnProperty.call(data, key);

      if (!present) {
        // Champ optionnel absent → notImplemented (on ne descend pas dans ses sous-champs)
        if (!required.includes(key)) {
          out.notImplemented.push(`Champ '${childPath}' défini dans le YAML mais absent de la réponse`);
        }
        // Champ requis absent : c'est AJV qui le signale en error, on ne double pas ici
        continue;
      }

      // Présent → on descend récursivement
      diffResponseVsSchema(data[key], props[key], childPath, out, depth + 1);
    }
    return;
  }

  // Tableau : comparer chaque élément au schéma des items
  if (schema.type === 'array' || schema.items) {
    if (!Array.isArray(data)) return;
    data.forEach((item, i) => {
      diffResponseVsSchema(item, schema.items, `${path}/${i}`, out, depth + 1);
    });
    return;
  }
  // Types scalaires : rien à comparer en structure
}

/**
 * Valide le corps de la réponse JSON par rapport au schéma attendu dans l'API Spec.
 * Les schémas AJV compilés sont mis en cache pour éviter de recompiler à chaque appel.
 * Les violations sont classées : `errors` (champs requis, bloquant) vs `warnings` (champs optionnels).
 */
export function validateResponseWithSpec(
  apiSpec: any,
  path: string,
  method: string,
  statusCode: number,
  responseData: any,
): ValidationResult {
  const lowerMethod = method.toLowerCase();
  const paths = apiSpec.paths;

  if (!paths || !paths[path] || !paths[path][lowerMethod]) {
    return {
      path,
      method,
      valid: false,
      errors: [`La route '${method} ${path}' est absente du fichier YAML.`],
    };
  }

  const endpoint = paths[path][lowerMethod];
  const responseSpec =
    endpoint.responses?.[statusCode] || endpoint.responses?.["default"];

  const statusDeclaredInYaml = !!endpoint.responses?.[statusCode];

  if (!responseSpec) {
    return {
      path,
      method,
      statusCode,
      valid: false,
      statusDeclaredInYaml: false,
      errors: [
        `Aucun schéma de réponse défini dans le YAML pour le code HTTP ${statusCode}.`,
      ],
    };
  }

  const schema =
    responseSpec.content?.["application/json"]?.schema || responseSpec.schema;

  if (!schema) {
    // Pas de schéma de corps défini (ex: 204 No Content) — considéré valide
    return {
      path,
      method,
      statusCode,
      valid: true,
      statusDeclaredInYaml,
      responseBody: responseData,
    };
  }

  // Clé de cache unique par route + méthode + code HTTP
  const cacheKey = `${method.toUpperCase()}:${path}:${statusCode}`;

  let validate = schemaCache.get(cacheKey);
  if (!validate) {
    validate = ajv.compile(schema);
    schemaCache.set(cacheKey, validate);
  }

  const passed = validate(responseData);

  if (!passed) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nullables: string[] = [];

    for (const err of validate.errors || []) {
      const msg = `Champ '${err.instancePath || '/'}': ${err.message}`;

      // Cas dédié : la valeur reçue est `null` alors qu'un type précis est attendu
      // (ex: "must be string" sur une valeur nulle). Catégorie séparée, non bloquante.
      // 1) via err.data (dispo grâce à verbose:true) ; 2) fallback en résolvant instancePath.
      let receivedIsNull = err.keyword === 'type' && (err as any).data === null;
      if (err.keyword === 'type' && !receivedIsNull && err.instancePath) {
        const parts = err.instancePath.split('/').filter(Boolean);
        let cur: any = responseData;
        for (const p of parts) {
          if (cur == null) break;
          cur = cur[/^\d+$/.test(p) ? Number(p) : p];
        }
        receivedIsNull = cur === null;
      }
      if (receivedIsNull) {
        nullables.push(msg);
        continue;
      }

      if (isFieldRequired(err, schema)) {
        errors.push(msg);      // champ requis → bloquant
      } else {
        warnings.push(msg);    // champ optionnel → warning non bloquant
      }
    }

    // valid = true s'il n'y a QUE des warnings/nullables (aucune violation sur un champ requis)
    const valid = errors.length === 0;

    // Diff structurel : champs en trop (undocumented) et optionnels absents (notImplemented)
    const diff = { undocumented: [] as string[], notImplemented: [] as string[] };
    diffResponseVsSchema(responseData, schema, '', diff);

    return {
      path,
      method,
      statusCode,
      valid,
      statusDeclaredInYaml,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      nullables: nullables.length > 0 ? nullables : undefined,
      undocumented: diff.undocumented.length > 0 ? diff.undocumented : undefined,
      notImplemented: diff.notImplemented.length > 0 ? diff.notImplemented : undefined,
      responseBody: responseData,
      expectedSchema: schema,
    };
  }

  // AJV a réussi : on fait quand même le diff structurel (non bloquant)
  const diff = { undocumented: [] as string[], notImplemented: [] as string[] };
  diffResponseVsSchema(responseData, schema, '', diff);

  return {
    path,
    method,
    statusCode,
    valid: true,
    statusDeclaredInYaml,
    undocumented: diff.undocumented.length > 0 ? diff.undocumented : undefined,
    notImplemented: diff.notImplemented.length > 0 ? diff.notImplemented : undefined,
    responseBody: responseData,
    expectedSchema: schema,
  };
}
