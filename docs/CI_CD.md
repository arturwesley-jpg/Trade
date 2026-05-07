# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for continuous integration and deployment. The CI/CD pipeline ensures code quality, runs tests, and automates deployments to staging and production environments.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**

- **Lint**: Runs code linting to ensure code style consistency
- **TypeScript Type Check**: Validates TypeScript types across all workspaces
- **Unit Tests**: Runs unit tests with PostgreSQL and Redis services
- **Integration Tests**: Runs E2E tests with full environment setup
- **Build**: Builds all workspaces (API, Web, Worker, Telegram Bot)
- **Docker**: Builds Docker images for all services
- **Security**: Runs npm audit and Snyk security scanning

**Features:**
- Dependency caching for faster builds
- Parallel job execution where possible
- Code coverage reporting to Codecov
- Build artifact uploads
- Docker layer caching

### 2. Deploy Staging Workflow (`.github/workflows/deploy-staging.yml`)

Deploys to staging environment on push to `main` branch.

**Jobs:**

- **Deploy to Staging**: Builds and deploys to staging environment
- **Post-Deployment Tests**: Runs smoke tests and health checks

**Features:**
- Automated deployment to Render/Railway
- Smoke tests after deployment
- Health checks and performance baselines
- Slack notifications on success/failure

### 3. Deploy Production Workflow (`.github/workflows/deploy.yml`)

Deploys to production on version tags (`v*`).

**Features:**
- Manual approval required (GitHub environment protection)
- Backup creation before deployment
- Rollback capability
- Comprehensive post-deployment validation

## Scripts

### Deployment Scripts

Located in `scripts/` directory:

#### `deploy-staging.sh`
```bash
./scripts/deploy-staging.sh [platform]
```
Deploys to staging environment. Supports: render, railway, fly

#### `deploy-production.sh`
```bash
./scripts/deploy-production.sh [platform]
```
Deploys to production with safety checks and confirmation prompts.

#### `rollback.sh`
```bash
./scripts/rollback.sh [platform] [backup-tag]
```
Rolls back to a previous deployment using backup tags.

### Testing Scripts

#### `smoke-tests.sh`
```bash
./scripts/smoke-tests.sh [environment]
```
Runs smoke tests against deployed environment:
- Health check
- API responsiveness
- Metrics endpoint
- Database connectivity
- Redis connectivity
- Authentication endpoint
- CORS headers

#### `pre-deploy-checks.sh`
```bash
./scripts/pre-deploy-checks.sh
```
Runs pre-deployment validation:
- Git status check
- Dependencies verification
- TypeScript compilation
- Unit tests
- Build verification
- Environment variables check
- Security audit

#### `health-check.sh`
```bash
./scripts/health-check.sh [url]
```
Quick health check for API endpoint.

## Environment Setup

### Required Secrets

Configure these secrets in GitHub repository settings:

**Staging:**
- `RENDER_DEPLOY_HOOK_STAGING` - Render deploy hook URL
- `STAGING_API_URL` - Staging API URL
- `STAGING_WS_URL` - Staging WebSocket URL

**Production:**
- `RENDER_DEPLOY_HOOK_PRODUCTION` - Render deploy hook URL
- `PRODUCTION_API_URL` - Production API URL
- `PRODUCTION_WS_URL` - Production WebSocket URL

**Optional:**
- `SLACK_WEBHOOK` - Slack webhook for notifications
- `SNYK_TOKEN` - Snyk security scanning token
- `CODECOV_TOKEN` - Codecov upload token

### Environment Variables

Each environment needs:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (staging/production)

## Deployment Process

### Staging Deployment

1. Push to `main` branch
2. CI workflow runs automatically
3. If CI passes, staging deployment triggers
4. Application builds and deploys to Render
5. Smoke tests run automatically
6. Slack notification sent

### Production Deployment

1. Create version tag: `git tag v1.0.0`
2. Push tag: `git push origin v1.0.0`
3. Production workflow triggers
4. Manual approval required (GitHub environment)
5. Backup created automatically
6. Application deploys to production
7. Comprehensive validation runs
8. Rollback available if needed

## Monitoring

### Build Status

Check workflow status:
- GitHub Actions tab in repository
- Status badges in README

### Deployment Status

Monitor deployments:
- Render/Railway dashboard
- Application logs
- Metrics endpoint: `/metrics`
- Health endpoint: `/health`

### Rollback Procedure

If deployment fails:

```bash
# Automatic rollback (uses latest backup)
./scripts/rollback.sh render

# Manual rollback to specific version
./scripts/rollback.sh render backup-2026-05-03-12-00
```

## Local Testing

Test CI pipeline locally:

```bash
# Run all checks
npm run typecheck
npm test
npm run test:e2e:ci
npm run build

# Run pre-deployment checks
./scripts/pre-deploy-checks.sh

# Run smoke tests against local
./scripts/smoke-tests.sh http://localhost:3000
```

## Caching Strategy

The CI pipeline uses multiple caching layers:

1. **npm dependencies**: Cached by `package-lock.json` hash
2. **Docker layers**: Cached using GitHub Actions cache
3. **Build artifacts**: Uploaded for reuse in deployment jobs

## Security

Security measures in CI/CD:

- npm audit on every build (moderate+ severity)
- Snyk security scanning (high+ severity)
- No secrets in logs or artifacts
- Environment-specific access controls
- Manual approval for production

## Troubleshooting

### CI Failures

**TypeScript errors:**
```bash
npm run typecheck
```

**Test failures:**
```bash
npm test
npm run test:e2e
```

**Build failures:**
```bash
npm run build
```

### Deployment Failures

**Check logs:**
- GitHub Actions logs
- Render/Railway deployment logs

**Verify environment:**
```bash
./scripts/health-check.sh https://staging.trading-bot.example.com
```

**Rollback if needed:**
```bash
./scripts/rollback.sh render
```

## Best Practices

1. **Always run tests locally** before pushing
2. **Use feature branches** for development
3. **Create PRs** for code review before merging to main
4. **Tag releases** with semantic versioning (v1.0.0)
5. **Monitor deployments** and check logs
6. **Test in staging** before production deployment
7. **Keep dependencies updated** and audit regularly

## Continuous Improvement

The CI/CD pipeline is continuously improved based on:
- Build time optimization
- Test coverage requirements
- Security scanning updates
- Deployment reliability
- Developer feedback
