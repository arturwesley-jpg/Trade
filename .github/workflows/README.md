# CI/CD Pipeline Documentation

## Overview

This repository uses GitHub Actions for continuous integration and deployment. The pipeline includes automated testing, security scanning, Docker image building, and multi-environment deployments.

## Workflows

### 1. CI Pipeline (`ci-parallel.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Features:**
- Parallel execution for faster builds
- Quick checks (linting, type checking, formatting)
- Unit tests by workspace
- Integration tests with database
- Build verification
- Docker image builds
- Security scanning
- Code coverage checks (80% threshold)

**Quality Gates:**
- All lints must pass
- TypeScript strict mode
- All tests passing
- Code coverage > 80%
- No critical security vulnerabilities

**Duration:** ~10-15 minutes

---

### 2. Security Scan (`security-scan.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests
- Daily at 2 AM UTC (scheduled)
- Manual dispatch

**Scans:**
- **NPM Audit:** Dependency vulnerability scanning
- **Snyk:** Advanced security analysis
- **CodeQL:** Static code analysis
- **Trivy:** Docker image vulnerability scanning
- **Gitleaks:** Secret detection
- **TruffleHog:** Secret scanning
- **ESLint Security:** SAST analysis
- **License Check:** License compliance

**Notifications:**
- Slack alerts on critical issues
- PR comments with security summary
- Artifact uploads for all scan results

**Duration:** ~20-30 minutes

---

### 3. Staging Deployment (`deploy-staging.yml`)

**Triggers:**
- Push to `main` branch (automatic)
- Manual dispatch

**Pipeline:**
1. **Pre-deployment checks**
   - Type checking
   - Linting
   - Build verification
   - Pre-deploy script execution

2. **Docker image build**
   - Build all service images (api, web, worker, telegram-bot)
   - Push to GitHub Container Registry
   - Tag with `staging-latest` and `staging-{sha}`

3. **Deployment**
   - Deploy to Kubernetes (if configured)
   - Fallback to Render deployment
   - Health checks with retries

4. **Smoke tests**
   - Basic functionality verification
   - API endpoint checks
   - Service availability tests

5. **Notifications**
   - Slack notifications (success/failure)
   - Email alerts on failure
   - Automatic rollback on failure

**Environment:** `staging`
**URL:** https://staging.trading-bot.example.com
**Duration:** ~15-20 minutes

---

### 4. Production Deployment (`deploy-production.yml`)

**Triggers:**
- Push tags matching `v*` (e.g., `v1.2.3`)
- Manual dispatch with version input

**Pipeline:**
1. **Pre-deployment validation**
   - Full test suite
   - Security audit
   - Version format validation
   - Build verification

2. **Docker image build**
   - Multi-platform builds (amd64, arm64)
   - Vulnerability scanning with Trivy
   - Semantic versioning tags
   - Push to GitHub Container Registry

3. **Manual approval gate**
   - Requires manual approval in GitHub
   - Environment: `production-approval`

4. **Deployment**
   - Backup current deployment state
   - Deploy to Kubernetes/Render
   - Rolling update with health checks
   - 10-minute timeout per service

5. **Smoke tests**
   - Production-specific tests
   - Critical path verification
   - Performance checks

6. **Post-deployment monitoring**
   - 5-minute monitoring window
   - Error rate checks
   - Performance metrics

7. **Notifications**
   - Slack notifications
   - Email alerts (success/failure)
   - Deployment summary artifacts

8. **Automatic rollback**
   - Triggered on deployment or test failure
   - Restores previous deployment state
   - Immediate notifications

**Environment:** `production`
**URL:** https://trading-bot.example.com
**Duration:** ~30-45 minutes

---

### 5. Preview Deployments (`preview-deploy.yml`)

**Triggers:**
- Pull request opened/updated
- Manual dispatch with PR number

**Features:**
- Isolated preview environment per PR
- Automatic deployment on PR updates
- PR comments with preview URL
- Automatic cleanup on PR close

**Preview URL Format:** `https://pr-{number}.preview.trading-bot.example.com`

**Duration:** ~10-15 minutes

---

### 6. E2E Tests (`e2e-tests.yml`)

**Triggers:**
- Push to main branches
- Pull requests
- Manual dispatch

**Features:**
- Sharded test execution (3 shards)
- Full Docker Compose test environment
- API, integration, and performance tests
- Test result artifacts

**Duration:** ~20-30 minutes

---

## Environment Variables & Secrets

### Required Secrets

#### Container Registry
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

#### Deployment
- `KUBECONFIG_STAGING` - Kubernetes config for staging (base64 encoded)
- `KUBECONFIG_PRODUCTION` - Kubernetes config for production (base64 encoded)
- `RENDER_DEPLOY_HOOK_STAGING` - Render deployment webhook (staging)
- `RENDER_DEPLOY_HOOK_PRODUCTION` - Render deployment webhook (production)
- `PREVIEW_DEPLOY_TOKEN` - Token for preview deployments

#### Environment URLs
- `STAGING_API_URL` - Staging API URL
- `STAGING_WEB_URL` - Staging web URL
- `PRODUCTION_API_URL` - Production API URL
- `PRODUCTION_WEB_URL` - Production web URL

#### Notifications
- `SLACK_WEBHOOK` - Slack webhook URL for notifications
- `MAIL_SERVER` - SMTP server address
- `MAIL_PORT` - SMTP server port
- `MAIL_USERNAME` - SMTP username
- `MAIL_PASSWORD` - SMTP password
- `DEPLOYMENT_NOTIFICATION_EMAIL` - Email for deployment notifications

#### Security Scanning
- `SNYK_TOKEN` - Snyk API token
- `GITLEAKS_LICENSE` - Gitleaks license (optional)

---

## GitHub Environments

### 1. `staging`
- **Protection:** None (auto-deploy)
- **URL:** https://staging.trading-bot.example.com
- **Secrets:** Staging-specific configuration

### 2. `production-approval`
- **Protection:** Required reviewers
- **Purpose:** Manual approval gate before production deployment

### 3. `production`
- **Protection:** Required reviewers, branch protection
- **URL:** https://trading-bot.example.com
- **Secrets:** Production-specific configuration

### 4. `production-rollback`
- **Protection:** Required reviewers
- **Purpose:** Manual approval for rollback operations

---

## Deployment Process

### Staging Deployment
```bash
# Automatic on merge to main
git checkout main
git pull
# Deployment starts automatically
```

### Production Deployment
```bash
# Create and push a version tag
git tag v1.2.3
git push origin v1.2.3

# Or use GitHub UI to create a release
# Workflow will start and wait for manual approval
```

### Manual Deployment
```bash
# Go to Actions tab in GitHub
# Select the workflow (Deploy Staging or Deploy Production)
# Click "Run workflow"
# Fill in required inputs
```

---

## Rollback Procedures

### Automatic Rollback
- Triggered automatically on deployment or smoke test failure
- Restores previous deployment state
- Sends immediate notifications

### Manual Rollback
```bash
# Using kubectl (if Kubernetes)
kubectl rollout undo deployment/api -n production
kubectl rollout undo deployment/web -n production
kubectl rollout undo deployment/worker -n production
kubectl rollout undo deployment/telegram-bot -n production

# Or use the rollback script
./scripts/rollback.sh production
```

### Rollback to Specific Version
```bash
# Deploy a previous version tag
git tag v1.2.2  # Previous working version
git push origin v1.2.2 --force
# Approve the deployment in GitHub Actions
```

---

## Monitoring & Notifications

### Slack Notifications
- CI pipeline status (main branch only)
- Deployment success/failure
- Security scan critical issues
- Preview deployment links
- Rollback alerts

### Email Notifications
- Production deployment success
- Production deployment failures (critical)
- Security vulnerabilities (optional)

### GitHub PR Comments
- CI pipeline summary
- Security scan results
- Preview deployment URLs
- Code coverage reports

---

## Quality Gates

### CI Pipeline
- ✅ Linting passes
- ✅ Type checking passes
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Build succeeds
- ✅ Docker images build successfully
- ✅ Code coverage > 80%
- ✅ No critical security vulnerabilities

### Staging Deployment
- ✅ Pre-deployment checks pass
- ✅ Docker images build successfully
- ✅ Health checks pass
- ✅ Smoke tests pass

### Production Deployment
- ✅ All CI quality gates
- ✅ Security audit passes
- ✅ Manual approval obtained
- ✅ Docker images vulnerability scan passes
- ✅ Health checks pass
- ✅ Smoke tests pass
- ✅ Post-deployment monitoring passes

---

## Troubleshooting

### CI Pipeline Failures

**Linting Errors:**
```bash
npm run lint
npm run lint -- --fix  # Auto-fix issues
```

**Type Errors:**
```bash
npm run typecheck
```

**Test Failures:**
```bash
npm test
npm run test:with-db  # For integration tests
```

**Build Failures:**
```bash
npm run build
```

### Deployment Failures

**Health Check Failures:**
- Check application logs
- Verify environment variables
- Check database connectivity
- Review recent code changes

**Docker Build Failures:**
- Check Dockerfile syntax
- Verify base image availability
- Check build context size
- Review .dockerignore file

**Kubernetes Deployment Issues:**
```bash
# Check pod status
kubectl get pods -n production

# View pod logs
kubectl logs -f deployment/api -n production

# Describe deployment
kubectl describe deployment/api -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'
```

### Security Scan Failures

**Critical Vulnerabilities:**
```bash
# Update dependencies
npm audit fix

# Force update (breaking changes possible)
npm audit fix --force

# Manual review
npm audit
```

**Secret Detection:**
- Remove secrets from code
- Rotate compromised credentials
- Use environment variables
- Add to .gitignore

---

## Best Practices

### Branch Strategy
- `main` - Production-ready code, auto-deploys to staging
- `develop` - Development branch
- `feature/*` - Feature branches with preview deployments
- `hotfix/*` - Urgent production fixes

### Commit Messages
```
feat: add new trading strategy
fix: resolve order execution bug
docs: update API documentation
test: add unit tests for signal generation
chore: update dependencies
```

### Version Tagging
- Use semantic versioning: `v{major}.{minor}.{patch}`
- `v1.0.0` - Major release
- `v1.1.0` - Minor feature addition
- `v1.1.1` - Patch/bugfix

### Pull Requests
- Create PR for all changes
- Wait for CI to pass
- Get code review approval
- Preview deployment for testing
- Squash and merge

### Security
- Never commit secrets
- Use GitHub Secrets for sensitive data
- Rotate credentials regularly
- Review security scan results
- Keep dependencies updated

---

## Maintenance

### Weekly Tasks
- Review security scan results
- Check for dependency updates
- Monitor deployment success rates
- Review error logs

### Monthly Tasks
- Update base Docker images
- Review and update secrets
- Audit access permissions
- Performance optimization review

### Quarterly Tasks
- Major dependency updates
- Infrastructure cost review
- Disaster recovery testing
- Documentation updates

---

## Support

### Getting Help
- Check workflow logs in GitHub Actions
- Review this documentation
- Check application logs
- Contact DevOps team

### Useful Commands
```bash
# View workflow runs
gh run list

# View specific run
gh run view <run-id>

# Re-run failed jobs
gh run rerun <run-id>

# View workflow logs
gh run view <run-id> --log

# Cancel running workflow
gh run cancel <run-id>
```

---

## Metrics & KPIs

### CI/CD Performance
- Average build time: ~10-15 minutes
- Deployment frequency: Multiple times per day
- Lead time for changes: < 1 hour
- Mean time to recovery: < 30 minutes
- Change failure rate: < 5%

### Quality Metrics
- Code coverage: > 80%
- Security vulnerabilities: 0 critical, < 5 high
- Test pass rate: > 95%
- Deployment success rate: > 98%

---

## Changelog

### 2026-05-05
- Initial CI/CD pipeline setup
- Added security scanning workflows
- Implemented staging and production deployments
- Added preview deployments for PRs
- Configured notifications and quality gates
