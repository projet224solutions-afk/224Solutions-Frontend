#!/bin/bash
# Script de déploiement des Edge Functions Supabase
# 224Solutions - Janvier 2026

echo "🚀 Déploiement des Edge Functions Supabase..."
echo "=============================================="

# Fonction client-ai-assistant (correction syntaxe ilike)
echo ""
echo "📦 Déploiement de client-ai-assistant..."
supabase functions deploy client-ai-assistant --no-verify-jwt

# Vérification
if [ $? -eq 0 ]; then
    echo "✅ client-ai-assistant déployé avec succès"
else
    echo "❌ Erreur lors du déploiement de client-ai-assistant"
fi

echo ""
echo "=============================================="
echo "✅ Déploiement terminé!"
echo ""
echo "📱 Pour tester sur mobile:"
echo "   1. Ouvrez: https://votre-domaine.com/mobile-diagnostic.html"
echo "   2. Vérifiez les tests de connexion"
echo "   3. Si erreur, videz le cache et rechargez"
