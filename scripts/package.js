#!/usr/bin/env node
/*
 * scripts/package.js — Génère l'exécutable packagé (pkg) en incluant le numéro de version
 * dans le nom du livrable, ex: release/VivAPI-Validator-1.2.6.exe
 *
 * Usage :
 *   node scripts/package.js            → cible Windows uniquement
 *   node scripts/package.js --all      → Windows + macOS + Linux
 *
 * Le build TypeScript (tsc) doit avoir été exécuté avant (fait par les scripts npm).
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const pkg = require('../package.json');

const version = pkg.version;
const all = process.argv.includes('--all');

// Nom de base du livrable, versionné.
const baseName = `VivAPI-Validator-${version}`;

// Construit les arguments pkg. Sur Windows, on fixe le nom complet du .exe via --output ;
// pour le multi-plateforme, pkg ajoute lui-même le suffixe d'OS à partir de --output.
const targets = all
  ? 'node18-win-x64,node18-macos-x64,node18-linux-x64'
  : 'node18-win-x64';

// Chemin RELATIF (au cwd = racine du projet) pour éviter les espaces du chemin absolu,
// qui cassent le parsing de pkg (le dossier contient « Documents Adrien », etc.).
const output = all
  ? `release/${baseName}`              // pkg suffixe -win.exe / -macos / -linux
  : `release/${baseName}.exe`;         // Windows : nom exact

// On exécute pkg directement via son binaire local (pas de shell → pas de problème de quoting).
const pkgBin = path.join(__dirname, '..', 'node_modules', 'pkg', 'lib-es5', 'bin.js');
const args = [pkgBin, '.', '--targets', targets, '--output', output];

console.log(`[package] version ${version} → ${output}${all ? ' (+ suffixes OS)' : ''}`);

const res = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
process.exit(res.status === null ? 1 : res.status);
