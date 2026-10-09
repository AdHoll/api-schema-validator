# VivAPI Unified Validator

OpenAPI/YAML schema validator with OAuth2 authentication (**B2B**/**B2C** scope).

*Read this in [French](./README.md).*

The tool lets you load an OpenAPI specification, select routes, call a live API using OAuth2
authentication (`client_credentials`), then **compare the responses against the expected schema**
to detect discrepancies (missing required fields, undocumented fields, unimplemented optional
fields, unexpected `null` values, etc.).

An "API Status" page also lets you quickly test the OAuth2 token endpoint of several
environments, retrieving credentials from **Bitwarden** (via the `bw` CLI).

## Features

- **OpenAPI spec parsing**: extracts routes, methods, `path`/`query` parameters, JSON request
  body, and auto-generates a body skeleton.
- **Batch validation**: OAuth2 authentication then calls the selected routes, classifying
  discrepancies:
  - `errors` — missing or invalid **required** field (blocking)
  - `warnings` — invalid optional field (non-blocking)
  - `nullables` — `null` value where a type is expected (non-blocking)
  - `undocumented` — field present in the response but absent from the YAML (non-blocking)
  - `notImplemented` — optional YAML field absent from the response (non-blocking)
- **Embedded spec library** (`spec-library/`), sorted by (semantic) version.
- **API Status page**: tests the OAuth2 token endpoint per target, with credentials resolved
  from Bitwarden (organization + collection + item name).
- **Call logging** in `logs/`, with automatic secret masking (`client_secret`, `password`,
  `token`, `access_token`, `authorization`).

## Requirements

- **Node.js** ≥ 18 (developed and tested with Node 24, npm 11).
- For the "API Status" page: the **Bitwarden CLI** (`bw`) installed and available on the `PATH`.
  ```bash
  npm install -g @bitwarden/cli
  ```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file at the project root (not versioned):

```env
# Environment: development | production
NODE_ENV=development

# Server port
PORT=3001
```

> In `production`, SSL certificates are verified. In `development`, they are ignored to make
> testing against internal environments easier.

### Status page targets (`api-targets.json`)

The `api-targets.json` file lists the APIs testable from the Status page. It contains
**no secrets** — only references to Bitwarden items:

```json
{
  "targets": [
    {
      "id": "api-123",
      "label": "My API",
      "owner": "MyOrganization",
      "collection": "MyCollection",
      "bwItemName": "Exact name of the Bitwarden item",
      "scope": "b2c",
      "tags": ["Dev"]
    }
  ]
}
```

Credentials (url / username / password) are fetched on the fly from Bitwarden and are never
stored on disk.

## Getting started

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

The server is then available at `http://localhost:3001` (or the configured `PORT`).

## Project structure

```
src/
  index.ts                 # Express entry point (static files + routers)
  routes/
    validator.ts           # Spec parsing + batch validation (OAuth2 + schema comparison)
    apiStatus.ts           # Status page: Bitwarden vault + token testing
  services/
    yamlParser.ts          # Route extraction + AJV validation + response/schema diff
    bitwarden.ts           # bw CLI access (unlock/lock, org/collection/item resolution)
public/                    # Static front end (index.html, status.html, etc.)
spec-library/              # Embedded, versioned OpenAPI specs
api-targets.json           # Status page targets (no secrets)
logs/                      # Call logs (generated, not versioned)
uploads/                   # Temporary upload files (generated, not versioned)
```

## Main API endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/spec-versions` | Lists the embedded spec versions |
| `GET`  | `/api/spec/:filename` | Raw content of an embedded spec |
| `POST` | `/api/parse-routes` | Extracts routes from an uploaded YAML (field `spec`) |
| `POST` | `/api/validate-batch` | Authenticates via OAuth2 and validates selected routes |
| `GET`  | `/api/status/vault-status` | Bitwarden vault state |
| `POST` | `/api/status/unlock` | Unlocks the vault (master password) |
| `POST` | `/api/status/lock` | Locks the vault |
| `GET`  | `/api/status/targets` | Lists the configured targets |
| `POST` | `/api/status/targets` | Updates the targets |
| `POST` | `/api/status/test` | Tests the targets' OAuth2 token (by `ids` or `tags`) |

## Security

- The Bitwarden **master password** is passed via STDIN, never as a command-line argument, and
  is neither stored nor logged.
- Only the Bitwarden session (`BW_SESSION`) is kept **in memory** with a short expiration
  (15 min), never written to disk.
- Secrets are **masked** in the call logs.
- Reading embedded specs is protected against directory traversal.

## Notes

- `node_modules/`, `dist/`, `.env`, `logs/` and `uploads/` are intentionally excluded from the
  repository (see `.gitignore`).
