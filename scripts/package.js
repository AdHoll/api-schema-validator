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
const releaseDir = path.join(__dirname, '..', 'release');

// Nom de base du livrable, versionné.
const baseName = `VivAPI-Validator-${version}`;

// Construit les arguments pkg. Sur Windows, on fixe le nom complet du .exe via --output ;
// pour le multi-plateforme, pkg ajoute lui-même le suffixe d'OS à partir de --output.
const targets = all
  ? 'node18-win-x64,node18-macos-x64,node18-linux-x64'
  : 'node18-win-x64';

const output = all
  ? path.join(releaseDir, baseName)             // pkg suffixe -win.exe / -macos / -linux
  : path.join(releaseDir, `${baseName}.exe`);   // Windows : nom exact

const args = ['pkg', '.', '--targets', targets, '--output', output];

console.log(`[package] version ${version} → ${output}${all ? ' (+ suffixes OS)' : ''}`);

// npx pkg ... (npx est résolu via le PATH ; sous Windows le shell:true permet de lancer npx.cmd)
const res = spawnSync('npx', args, { stdio: 'inherit', shell: true });
process.exit(res.status === null ? 1 : res.status);
