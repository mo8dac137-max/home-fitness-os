import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_ASSETS = path.resolve('dist/assets');
const BUDGET_KB = 300;

if (!fs.existsSync(DIST_ASSETS)) {
  console.error(`Error: Assets directory not found at ${DIST_ASSETS}. Run "npm run build" first.`);
  process.exit(1);
}

const files = fs.readdirSync(DIST_ASSETS);
const jsFiles = files.filter((f) => f.endsWith('.js'));

if (jsFiles.length === 0) {
  console.error(`Error: No JS files found in ${DIST_ASSETS}.`);
  process.exit(1);
}

let totalGzipBytes = 0;
console.log('--- Performance Budget Check (JS gzipped < 300 KB) ---');

for (const jsFile of jsFiles) {
  const filePath = path.join(DIST_ASSETS, jsFile);
  const content = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(content);
  const sizeKb = (gzipped.length / 1024).toFixed(2);
  console.log(`- ${jsFile}: ${sizeKb} KB (gzipped)`);
  totalGzipBytes += gzipped.length;
}

const totalGzipKb = totalGzipBytes / 1024;
console.log(`Total gzipped JS: ${totalGzipKb.toFixed(2)} KB (budget: ${BUDGET_KB} KB)`);

if (totalGzipKb > BUDGET_KB) {
  console.error(`❌ FAILED: Total JS size ${totalGzipKb.toFixed(2)} KB exceeds budget of ${BUDGET_KB} KB!`);
  process.exit(1);
} else {
  console.log(`✅ PASSED: Within performance budget.`);
}
