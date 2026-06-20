import fs from 'fs';
const KEYS = 'scripts/.i18n-new-keys.json';
const keys = JSON.parse(fs.readFileSync(KEYS, 'utf8'));
const files = [
  'AIReviewResponseCard','POSSystem','ProductBarcodeDisplay','ReviewsManagement',
  'settings/VendorKYCSettings','shipment/ShipmentForm','suppliers/PurchaseEditor',
  'SupportTickets','VendorDisputeDialog'
].map(n => 'src/components/vendor/' + n + '.tsx');

// motif cassé: t('KEY')<leftover sans quote>'   (leftover = le reste après l'apostrophe d'origine)
const re = /t\('([A-Za-z0-9_.]+)'\)([^'"\n)][^'\n]*?)'/g;
let fixedTotal = 0;
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  let n = 0;
  src = src.replace(re, (full, key, leftover) => {
    if (!keys[key]) return full;            // clé inconnue, ne pas toucher
    const fullFr = keys[key][0] + "'" + leftover; // recompose la chaîne FR d'origine
    keys[key] = [fullFr, fullFr];
    n++;
    return `t('${key}')`;
  });
  if (n) { fs.writeFileSync(f, src); fixedTotal += n; console.log(`  ✓ ${f} (${n})`); }
  else console.log(`  (rien) ${f}`);
}
fs.writeFileSync(KEYS, JSON.stringify(keys, null, 2));
console.log('Total réparations:', fixedTotal);
