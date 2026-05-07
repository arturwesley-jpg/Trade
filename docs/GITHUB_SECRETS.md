# GitHub Secrets Configuration

This document lists all required secrets for GitHub Actions CI/CD workflows.

## Required Secrets

Configure these in: Repository Settings → Secrets and variables → Actions → New repository secret

### Deployment Secrets

#### Render.com
```
RENDER_DEPLOY_HOOK_STAGING
RENDER_DEPLOY_HOOK_PRODUCTION
```

Get these from:
1. Render Dashboard → Service → Settings → Deploy Hook
2. Create separate hooks for staging and production services

#### Railway.app
```
RAILWAY_TOKEN
```

Get this from:
```bash
railway login
railway whoami --token
```

#### Fly.io
```
FLY_API_TOKEN
```

Get this from:
```bash
flyctl auth token
```

### Application Secrets

```
ADMIN_API_TOKEN
TELEGRAM_BOT_TOKEN
```

Generate ADMIN_API_TOKEN:
```bash
openssl rand -hex 32
```

Get TELEGRAM_BOT_TOKEN from @BotFather on Telegram.

### Optional Secrets

#### Monitoring & Notifications
```
SLACK_WEBHOOK          # For deployment notifications
CODECOV_TOKEN          # For code coverage reports
SNYK_TOKEN            # For security scanning
```

#### Exchange API Keys (for production)
```
BINANCE_API_KEY
BINANCE_API_SECRET
BYBIT_API_KEY
BYBIT_API_SECRET
```

## Repository Variables

Configure these in: Repository Settings → Secrets and variables → Actions → Variables

```
DEPLOY_PLATFORM=render              # or railway, fly
STAGING_API_URL=https://...
PRODUCTION_API_URL=https://...
```

## Verification

After configuring secrets, verify by:

1. Go to Actions tab
2. Run "CI" workflow manually
3. Check that all steps pass
4. Verify no "secret not found" errors

## Security Notes

- Never commit secrets to repository
- Rotate secrets regularly
- Use different secrets for staging/production
- Limit secret access to necessary workflows only
- Review secret usage in audit logs

## Troubleshooting

**Secret not found error**:
- Verify secret name matches exactly (case-sensitive)
- Check secret is set at repository level, not organization
- Ensure workflow has permission to access secrets

**Deploy hook not working**:
- Test hook manually with curl
- Verify URL is complete and correct
- Check platform service is active
