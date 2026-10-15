#!/usr/bin/env node
/**
 * Unified Build Script for RailMadad Frontends on Vercel
 * Builds Passenger (/), Officer (/officer/), and Staff (/staff/) into a single dist/ folder.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PASSENGER_DIR = path.join(ROOT_DIR, 'frontend-passenger');
const OFFICER_DIR = path.join(ROOT_DIR, 'frontend-officer');
const STAFF_DIR = path.join(ROOT_DIR, 'frontend-staff');
const OUTPUT_DIST = path.join(ROOT_DIR, 'dist');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🚀 Starting unified RailMadad frontend build for Vercel...');

// Clean existing dist
if (fs.existsSync(OUTPUT_DIST)) {
  fs.rmSync(OUTPUT_DIST, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIST, { recursive: true });

// Forward environment variables
const baseEnv = {
  ...process.env,
  VITE_API_URL: process.env.VITE_API_URL || '',
  VITE_ML_URL: process.env.VITE_ML_URL || '',
  VITE_ML_SERVICE_URL: process.env.VITE_ML_SERVICE_URL || process.env.VITE_ML_URL || ''
};

// 1. Build Passenger Frontend (Root /)
console.log('\n📦 [1/3] Building Passenger Portal (Root /)...');
execSync('npm install --include=dev', { cwd: PASSENGER_DIR, stdio: 'inherit', env: baseEnv });
execSync('npm run build', { cwd: PASSENGER_DIR, stdio: 'inherit', env: { ...baseEnv, VITE_BASE: '/' } });
copyDirRecursive(path.join(PASSENGER_DIR, 'dist'), OUTPUT_DIST);
console.log('✅ Passenger Portal built successfully.');

// 2. Build Officer Frontend (/officer/)
console.log('\n📦 [2/3] Building Officer Dashboard (/officer/)...');
execSync('npm install --include=dev', { cwd: OFFICER_DIR, stdio: 'inherit', env: baseEnv });
execSync('npm run build', { cwd: OFFICER_DIR, stdio: 'inherit', env: { ...baseEnv, VITE_BASE: '/officer/' } });
copyDirRecursive(path.join(OFFICER_DIR, 'dist'), path.join(OUTPUT_DIST, 'officer'));
console.log('✅ Officer Dashboard built successfully.');

// 3. Build Staff Frontend (/staff/)
console.log('\n📦 [3/3] Building Staff Portal (/staff/)...');
execSync('npm install --include=dev', { cwd: STAFF_DIR, stdio: 'inherit', env: baseEnv });
execSync('npm run build', { cwd: STAFF_DIR, stdio: 'inherit', env: { ...baseEnv, VITE_BASE: '/staff/' } });
copyDirRecursive(path.join(STAFF_DIR, 'dist'), path.join(OUTPUT_DIST, 'staff'));
console.log('✅ Staff Portal built successfully.');

// 4. Generate vercel.json in dist for single-app SPA rewrites
const vercelConfig = {
  rewrites: [
    { source: '/officer/:match*', destination: '/officer/index.html' },
    { source: '/officer', destination: '/officer/index.html' },
    { source: '/staff/:match*', destination: '/staff/index.html' },
    { source: '/staff', destination: '/staff/index.html' },
    { source: '/(.*)', destination: '/index.html' }
  ]
};

fs.writeFileSync(path.join(OUTPUT_DIST, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));
fs.writeFileSync(path.join(ROOT_DIR, 'vercel.json'), JSON.stringify({
  buildCommand: "node build-all.js",
  outputDirectory: "dist",
  ...vercelConfig
}, null, 2));

console.log('\n🎉 ALL 3 FRONTENDS BUILT AND COMBINED SUCCESSFULLY!');
console.log('📂 Output directory:', OUTPUT_DIST);
console.log('   ├── /        -> Passenger Portal');
console.log('   ├── /officer -> Officer Dashboard');
console.log('   └── /staff   -> Staff Field App\n');
