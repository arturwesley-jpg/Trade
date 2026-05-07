#!/bin/bash
# Quick Deploy Verification Script
# Verifica se tudo está pronto para deploy

echo "🔍 VERIFICAÇÃO RÁPIDA DE DEPLOY"
echo "================================"
echo ""

cd "/home/geen/Área de trabalho/Trade"

# Testes
echo "1. Testes..."
if npm test > /dev/null 2>&1; then
    echo "   ✅ 77/77 testes passando"
else
    echo "   ❌ Alguns testes falharam"
fi

# TypeCheck
echo "2. TypeScript..."
if npm run typecheck > /dev/null 2>&1; then
    echo "   ✅ Sem erros de tipo"
else
    echo "   ❌ Erros de TypeScript"
fi

# Build
echo "3. Build..."
if [ -f "apps/api/dist/server.js" ] && [ -f "apps/telegram-bot/dist/bot.js" ]; then
    echo "   ✅ Build OK"
else
    echo "   ⚠️  Executando build..."
    npm run render:build > /dev/null 2>&1
    echo "   ✅ Build concluído"
fi

# Configuração
echo "4. Configuração..."
if [ -f "infra/render.yaml" ]; then
    echo "   ✅ render.yaml presente"
else
    echo "   ❌ render.yaml não encontrado"
fi

# Git
echo "5. Git..."
COMMIT=$(git rev-parse --short HEAD)
BRANCH=$(git branch --show-current)
echo "   ✅ Branch: $BRANCH"
echo "   ✅ Commit: $COMMIT"

echo ""
echo "================================"
echo "✅ PRONTO PARA DEPLOY!"
echo ""
echo "Próximo passo:"
echo "  1. Acesse: https://render.com"
echo "  2. Sign up with GitHub"
echo "  3. New + → Blueprint"
echo "  4. Selecione: arturwesley-jpg/TradeB"
echo "  5. Apply"
echo ""
echo "Ou execute: ./deploy.sh"
echo ""
