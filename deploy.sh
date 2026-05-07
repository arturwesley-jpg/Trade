#!/bin/bash
# Deploy Script - Crypto Trading Bot
# Automatiza o processo de deploy no Render.com

set -e

echo "🚀 Crypto Trading Bot - Deploy Script"
echo "======================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar pré-requisitos
echo "📋 Verificando pré-requisitos..."
echo ""

# Git
if command_exists git; then
    echo -e "${GREEN}✓${NC} Git instalado"
else
    echo -e "${RED}✗${NC} Git não encontrado"
    exit 1
fi

# Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js não encontrado"
    exit 1
fi

# npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm não encontrado"
    exit 1
fi

echo ""
echo "🔍 Verificando status do projeto..."
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗${NC} package.json não encontrado"
    echo "Execute este script no diretório raiz do projeto"
    exit 1
fi

echo -e "${GREEN}✓${NC} Diretório correto"

# Verificar se render.yaml existe
if [ ! -f "infra/render.yaml" ]; then
    echo -e "${RED}✗${NC} infra/render.yaml não encontrado"
    exit 1
fi

echo -e "${GREEN}✓${NC} render.yaml encontrado"

# Verificar git status
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠${NC} Há mudanças não commitadas"
    echo ""
    git status --short
    echo ""
    read -p "Deseja continuar mesmo assim? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Git limpo"
fi

# Verificar branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${GREEN}✓${NC} Branch: $CURRENT_BRANCH"

# Verificar remote
REMOTE_URL=$(git config --get remote.origin.url)
echo -e "${GREEN}✓${NC} Remote: $REMOTE_URL"

echo ""
echo "🧪 Executando testes..."
echo ""

# Rodar testes
if npm test > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Todos os testes passaram"
else
    echo -e "${RED}✗${NC} Alguns testes falharam"
    read -p "Deseja continuar mesmo assim? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔨 Verificando build..."
echo ""

# Verificar typecheck
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} TypeScript OK"
else
    echo -e "${RED}✗${NC} Erros de TypeScript"
    # exit 1
fi

echo ""
echo "📦 Verificando Render CLI..."
echo ""

# Verificar se Render CLI está instalado
if command_exists render; then
    RENDER_VERSION=$(render --version 2>&1 | head -1)
    echo -e "${GREEN}✓${NC} Render CLI instalado: $RENDER_VERSION"

    echo ""
    echo "🚀 Pronto para deploy!"
    echo ""
    echo "Escolha o método de deploy:"
    echo ""
    echo "1) Deploy via Render CLI (rápido)"
    echo "2) Abrir dashboard do Render no navegador"
    echo "3) Apenas verificar (não fazer deploy)"
    echo ""
    read -p "Escolha uma opção (1-3): " -n 1 -r
    echo ""

    case $REPLY in
        1)
            echo ""
            echo "🚀 Iniciando deploy via CLI..."
            echo ""
            render blueprint launch infra/render.yaml
            ;;
        2)
            echo ""
            echo "🌐 Abrindo dashboard do Render..."
            echo ""
            if command_exists xdg-open; then
                xdg-open "https://dashboard.render.com/blueprints"
            elif command_exists open; then
                open "https://dashboard.render.com/blueprints"
            else
                echo "Acesse: https://dashboard.render.com/blueprints"
            fi
            ;;
        3)
            echo ""
            echo -e "${GREEN}✓${NC} Verificação completa!"
            echo ""
            echo "Para fazer deploy:"
            echo "  - Via CLI: render blueprint launch infra/render.yaml"
            echo "  - Via Dashboard: https://dashboard.render.com/blueprints"
            ;;
        *)
            echo ""
            echo "Opção inválida"
            exit 1
            ;;
    esac
else
    echo -e "${YELLOW}⚠${NC} Render CLI não instalado"
    echo ""
    echo "Você pode:"
    echo ""
    echo "1) Instalar Render CLI:"
    echo "   npm install -g @render/cli"
    echo ""
    echo "2) Fazer deploy via Dashboard:"
    echo "   https://dashboard.render.com/blueprints"
    echo ""
    echo "Recomendação: Use o Dashboard (mais fácil para primeira vez)"
    echo ""
    read -p "Deseja abrir o dashboard agora? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command_exists xdg-open; then
            xdg-open "https://dashboard.render.com/blueprints"
        elif command_exists open; then
            open "https://dashboard.render.com/blueprints"
        else
            echo "Acesse: https://dashboard.render.com/blueprints"
        fi
    fi
fi

echo ""
echo "📚 Documentação disponível:"
echo "  - DEPLOY_AGORA.md - Guia rápido (5 min)"
echo "  - GUIA_DEPLOY_RENDER.md - Guia completo"
echo "  - STATUS_DEPLOY.md - Status atual"
echo ""
echo "✅ Script concluído!"
