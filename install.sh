#!/bin/bash

echo "========================================"
echo "INSTALLATION VISTA FLOWS - 224SOLUTIONS"
echo "========================================"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installé!"
    echo "Téléchargez-le sur: https://nodejs.org"
    exit 1
fi

echo "[OK] Node.js détecté"
node --version
echo ""

# Installer les dépendances
echo "Installation des dépendances..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERREUR] Installation échouée"
    exit 1
fi

echo ""
echo "========================================"
echo "INSTALLATION TERMINÉE AVEC SUCCÈS!"
echo "========================================"
echo ""
echo "Prochaines étapes:"
echo "1. Créer un fichier .env avec vos clés Supabase"
echo "2. Exécuter: npm run dev"
echo "3. Ouvrir: http://localhost:8080"
echo ""
echo "Consultez INSTALLATION_CLIENT.md pour plus de détails"
echo ""
