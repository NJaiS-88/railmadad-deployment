#!/usr/bin/env node
/**
 * Unified Build Script for RailMadad Frontends on Vercel
 * Builds Passenger (/), Officer (/officer/), and Staff (/staff/) into a single dist/ folder.
 * Uses direct Node.js execution of Vite to prevent Linux permission/EACCES (status 126) errors.
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

function buildFrontend(dir, base, label, destSubdir = '') {
  console.log(`\n📦 Building ${label} (base: "${base}")...`);
  
  // 1. Install dependencies
  execSync('npm install --include=dev --prefer-offline --no-audit --no-fund', {
    cwd: dir,
    stdio: 'inherit',
    env: baseEnv
  });

  // 2. Ensure executable permissions on node_modules/.bin on Linux
  try {
    const binDir = path.join(dir, 'node_modules', '.bin');
    if (fs.existsSync(binDir) && process.platform !== 'win32') {
      execSync(`chmod -R 755 "${binDir}"`, { stdio: 'ignore' });
    }
  } catch (_) {}

  // 3. Execute Vite build directly via Node.js process to bypass EACCES / status 126
  const env = { ...baseEnv, VITE_BASE: base };
  const viteJs = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js');

  if (fs.existsSync(viteJs)) {
    console.log(`   Running: node vite/bin/vite.js build`);
    execSync(`"${process.execPath}" "${viteJs}" build`, {
      cwd: dir,
      stdio: 'inherit',
      env
    });
  } else {
    console.log(`   Running: npm run build`);
    execSync('npm run build', {
      cwd: dir,
      stdio: 'inherit',
      env
    });
  }

  // 4. Copy build output
  const builtDist = path.join(dir, 'dist');
  const targetDist = destSubdir ? path.join(OUTPUT_DIST, destSubdir) : OUTPUT_DIST;
  copyDirRecursive(builtDist, targetDist);
  console.log(`✅ ${label} built and copied to ${destSubdir || '/'}`);
}

// Build all 3 frontends
buildFrontend(PASSENGER_DIR, '/', 'Passenger Portal [1/3]');
buildFrontend(OFFICER_DIR, '/officer/', 'Officer Dashboard [2/3]', 'officer');
buildFrontend(STAFF_DIR, '/staff/', 'Staff Field App [3/3]', 'staff');

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
