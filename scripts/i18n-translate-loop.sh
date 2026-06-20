#!/usr/bin/env bash
cd "$(dirname "$0")/.."
remaining=999999
for i in $(seq 1 12); do
  echo "=== PASS $i $(date +%H:%M:%S) ==="
  node scripts/i18n-translate.mjs --all > "scripts/.loop-pass-$i.log" 2>&1
  remaining=$(node scripts/i18n-translate.mjs --all --limit 0 --dry 2>&1 \
    | awk -F'manquantes=' '/manquantes=/{split($2,a,",");s+=a[1]} END{print s+0}')
  echo "PASS $i terminé — clés manquantes restantes: $remaining"
  if [ "${remaining:-1}" -le 0 ]; then echo "✅ TRADUCTION COMPLÈTE (0 manquante)"; break; fi
  sleep 8
done
echo "LOOP_FINISHED remaining=$remaining"
