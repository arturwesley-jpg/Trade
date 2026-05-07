#!/bin/bash

# Vercel Deployment Script
# This script automates the Vercel deployment process

set -e

echo "🚀 Trade Platform - Vercel Deployment Script"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found${NC}"
    echo "Installing Vercel CLI..."
    npm install -g vercel@latest
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Vercel${NC}"
    echo "Please login:"
    vercel login
fi

# Function to check if project is linked
check_linked() {
    if [ ! -d ".vercel" ]; then
        echo -e "${YELLOW}⚠️  Project not linked to Vercel${NC}"
        echo "Linking project..."
        vercel link
    else
        echo -e "${GREEN}✓ Project already linked${NC}"
    fi
}

# Function to setup environment variables
setup_env_vars() {
    echo ""
    echo "📝 Setting up environment variables..."
    echo ""

    read -p "Enter your Render API URL (e.g., https://trade-api.onrender.com): " API_URL
    read -p "Enter your Render WebSocket URL (e.g., wss://trade-api.onrender.com): " WS_URL

    echo ""
    echo "Setting production environment variables..."

    echo "$API_URL" | vercel env add VITE_API_URL production
    echo "$WS_URL" | vercel env add VITE_WS_URL production
    echo "$API_URL" | vercel env add VITE_API_BASE_URL production
    echo "production" | vercel env add VITE_APP_ENV production
    echo "production" | vercel env add VITE_NODE_ENV production
    echo "true" | vercel env add VITE_FEATURE_SENTIMENT_ANALYSIS production
    echo "true" | vercel env add VITE_FEATURE_ADVANCED_CHARTS production
    echo "false" | vercel env add VITE_FEATURE_SOCIAL_TRADING production

    echo ""
    echo "Setting preview environment variables..."

    echo "$API_URL" | vercel env add VITE_API_URL preview
    echo "$WS_URL" | vercel env add VITE_WS_URL preview
    echo "$API_URL" | vercel env add VITE_API_BASE_URL preview
    echo "preview" | vercel env add VITE_APP_ENV preview
    echo "preview" | vercel env add VITE_NODE_ENV preview
    echo "true" | vercel env add VITE_FEATURE_SENTIMENT_ANALYSIS preview
    echo "true" | vercel env add VITE_FEATURE_ADVANCED_CHARTS preview
    echo "false" | vercel env add VITE_FEATURE_SOCIAL_TRADING preview

    echo ""
    echo "Setting development environment variables..."

    echo "http://localhost:4000" | vercel env add VITE_API_URL development
    echo "ws://localhost:4000" | vercel env add VITE_WS_URL development
    echo "http://localhost:4000" | vercel env add VITE_API_BASE_URL development
    echo "development" | vercel env add VITE_APP_ENV development
    echo "development" | vercel env add VITE_NODE_ENV development
    echo "true" | vercel env add VITE_FEATURE_SENTIMENT_ANALYSIS development
    echo "true" | vercel env add VITE_FEATURE_ADVANCED_CHARTS development
    echo "true" | vercel env add VITE_FEATURE_SOCIAL_TRADING development

    echo -e "${GREEN}✓ Environment variables configured${NC}"
}

# Function to test local build
test_build() {
    echo ""
    echo "🔨 Testing local build..."
    echo ""

    npm run build -w apps/web

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Local build successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Local build failed${NC}"
        echo "Please fix build errors before deploying"
        return 1
    fi
}

# Function to deploy
deploy() {
    local env=$1

    echo ""
    if [ "$env" == "production" ]; then
        echo "🚀 Deploying to PRODUCTION..."
        vercel --prod
    else
        echo "🚀 Deploying to PREVIEW..."
        vercel
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Deployment successful${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
}

# Main menu
main() {
    echo ""
    echo "What would you like to do?"
    echo "1) Initial setup (link project + setup env vars)"
    echo "2) Test local build"
    echo "3) Deploy to preview"
    echo "4) Deploy to production"
    echo "5) Setup environment variables only"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice [1-6]: " choice

    case $choice in
        1)
            check_linked
            setup_env_vars
            echo ""
            read -p "Would you like to test the build now? (y/n): " test_choice
            if [ "$test_choice" == "y" ]; then
                test_build
            fi
            ;;
        2)
            test_build
            ;;
        3)
            check_linked
            echo ""
            read -p "Test build before deploying? (y/n): " test_choice
            if [ "$test_choice" == "y" ]; then
                if test_build; then
                    deploy "preview"
                fi
            else
                deploy "preview"
            fi
            ;;
        4)
            check_linked
            echo ""
            echo -e "${YELLOW}⚠️  WARNING: This will deploy to PRODUCTION${NC}"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" == "yes" ]; then
                read -p "Test build before deploying? (y/n): " test_choice
                if [ "$test_choice" == "y" ]; then
                    if test_build; then
                        deploy "production"
                    fi
                else
                    deploy "production"
                fi
            else
                echo "Deployment cancelled"
            fi
            ;;
        5)
            check_linked
            setup_env_vars
            ;;
        6)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac

    echo ""
    echo -e "${GREEN}✓ Done!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check your deployment at https://vercel.com/dashboard"
    echo "2. Update backend CORS to include your Vercel domain"
    echo "3. Test the deployed application"
    echo ""
}

# Run main menu
main
