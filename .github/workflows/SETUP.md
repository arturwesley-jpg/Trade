# CI/CD Setup Guide

## Quick Start

This guide will help you set up the complete CI/CD pipeline for the trading platform.

## Prerequisites

- GitHub repository with admin access
- Docker Hub or GitHub Container Registry account
- Deployment platform (Kubernetes, Render, Vercel, etc.)
- Slack workspace (optional, for notifications)
- Email server (optional, for notifications)

## Step 1: Configure GitHub Secrets

Navigate to your repository: **Settings → Secrets and variables → Actions**

### Container Registry (Required)
```
GITHUB_TOKEN - Automatically provided, no action needed
```

### Deployment Secrets (Choose your platform)

#### Option A: Kubernetes Deployment
```
KUBECONFIG_STAGING - Base64 encoded kubeconfig for staging
KUBECONFIG_PRODUCTION - Base64 encoded kubeconfig for production
```

To encode your kubeconfig:
```bash
cat ~/.kube/config | base64 -w 0
```

#### Option B: Render Deployment
```
RENDER_DEPLOY_HOOK_STAGING - https://api.render.com/deploy/srv-xxx?key=xxx
RENDER_DEPLOY_HOOK_PRODUCTION - https://api.render.com/deploy/srv-xxx?key=xxx
```

Get these from Render Dashboard → Service → Settings → Deploy Hook

#### Option C: Vercel/Netlify (for preview deployments)
```
PREVIEW_DEPLOY_TOKEN - Deployment token from your platform
```

### Environment URLs (Required)
```
STAGING_API_URL - https://staging-api.trading-bot.example.com
STAGING_WEB_URL - https://staging.trading-bot.example.com
PRODUCTION_API_URL - https://api.trading-bot.example.com
PRODUCTION_WEB_URL - https://trading-bot.example.com
```

### Notification Secrets (Optional but Recommended)

#### Slack Notifications
```
SLACK_WEBHOOK - https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

To create a Slack webhook:
1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Enable Incoming Webhooks
4. Add New Webhook to Workspace
5. Copy the webhook URL

#### Email Notifications
```
MAIL_SERVER - smtp.gmail.com (or your SMTP server)
MAIL_PORT - 587
MAIL_USERNAME - your-email@example.com
MAIL_PASSWORD - your-app-password
DEPLOYMENT_NOTIFICATION_EMAIL - team@example.com
```

For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as MAIL_PASSWORD

### Security Scanning (Optional but Recommended)
```
SNYK_TOKEN - Get from https://app.snyk.io/account
GITLEAKS_LICENSE - Optional, for Gitleaks Pro features
```

## Step 2: Configure GitHub Environments

Navigate to: **Settings → Environments**

### Create Environment: `staging`
- **Protection rules:** None (auto-deploy)
- **Environment secrets:** Add staging-specific configs if needed
- **Deployment branches:** Only `main` branch

### Create Environment: `production-approval`
- **Protection rules:**
  - ✅ Required reviewers (add team members)
  - ✅ Wait timer: 0 minutes
- **Purpose:** Manual approval gate before production deployment

### Create Environment: `production`
- **Protection rules:**
  - ✅ Required reviewers (add senior team members)
  - ✅ Wait timer: 5 minutes (optional)
  - ✅ Deployment branches: Only `main` and tags matching `v*`
- **Environment secrets:** Add production-specific configs if needed

### Create Environment: `production-rollback`
- **Protection rules:**
  - ✅ Required reviewers (add senior team members)
- **Purpose:** Manual approval for rollback operations

## Step 3: Configure Branch Protection

Navigate to: **Settings → Branches → Add branch protection rule**

### For `main` branch:
- ✅ Require a pull request before merging
- ✅ Require approvals (1-2 reviewers)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - Select: `CI Success`, `Security Summary`, `E2E Tests`
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

### For `develop` branch (if used):
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - Select: `CI Success`

## Step 4: Test the Pipeline

### Test CI Pipeline
```bash
# Create a feature branch
git checkout -b test/ci-pipeline

# Make a small change
echo "# Test" >> README.md

# Commit and push
git add README.md
git commit -m "test: verify CI pipeline"
git push origin test/ci-pipeline

# Create a pull request
gh pr create --title "Test CI Pipeline" --body "Testing CI/CD setup"
```

Expected results:
- CI workflow runs automatically
- All checks should pass (or show expected failures)
- PR comment with CI summary
- Preview deployment created (if configured)

### Test Staging Deployment
```bash
# Merge the test PR to main
gh pr merge --squash

# Check deployment status
gh run list --workflow=deploy-staging.yml
```

Expected results:
- Staging deployment workflow starts automatically
- Docker images built and pushed
- Deployment to staging environment
- Smoke tests run
- Slack notification (if configured)

### Test Production Deployment
```bash
# Create a version tag
git checkout main
git pull
git tag v0.1.0
git push origin v0.1.0

# Monitor deployment
gh run list --workflow=deploy-production.yml
```

Expected results:
- Production deployment workflow starts
- Pre-deployment validation runs
- Docker images built with version tags
- Workflow pauses for manual approval
- After approval, deploys to production
- Smoke tests and monitoring
- Notifications sent

## Step 5: Verify Security Scanning

Security scans run automatically, but you can trigger manually:

```bash
# Trigger security scan
gh workflow run security-scan.yml

# Check results
gh run list --workflow=security-scan.yml
```

Expected results:
- NPM audit completes
- Snyk scan runs (if token configured)
- CodeQL analysis completes
- Docker image scanning
- Secret detection
- Results uploaded as artifacts

## Step 6: Configure Notifications

### Slack Integration

1. **Create a Slack channel** (e.g., `#deployments` or `#ci-cd`)

2. **Test Slack notifications:**
```bash
# Send test message
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test notification from CI/CD pipeline"}' \
  YOUR_SLACK_WEBHOOK_URL
```

3. **Customize notification format** (optional):
   - Edit `.github/workflows/*.yml`
   - Find `8398a7/action-slack@v3` steps
   - Modify the `text` field

### Email Integration

1. **Test email configuration:**
```bash
# Use a test script or manual SMTP test
# Verify SMTP credentials work
```

2. **Customize email templates** (optional):
   - Edit `.github/workflows/deploy-*.yml`
   - Find `dawidd6/action-send-mail@v3` steps
   - Modify the `body` field

## Step 7: Documentation

### Update URLs in workflows

Replace placeholder URLs with your actual URLs:

```bash
# Find and replace in all workflow files
cd .github/workflows

# Update staging URLs
sed -i 's|staging.trading-bot.example.com|your-staging-url.com|g' *.yml

# Update production URLs
sed -i 's|trading-bot.example.com|your-production-url.com|g' *.yml

# Update preview URLs
sed -i 's|preview.trading-bot.example.com|your-preview-url.com|g' *.yml
```

### Update README

Add CI/CD badges to your main README.md:

```markdown
## CI/CD Status

[![CI](https://github.com/your-org/your-repo/actions/workflows/ci-parallel.yml/badge.svg)](https://github.com/your-org/your-repo/actions/workflows/ci-parallel.yml)
[![Security Scan](https://github.com/your-org/your-repo/actions/workflows/security-scan.yml/badge.svg)](https://github.com/your-org/your-repo/actions/workflows/security-scan.yml)
[![Deploy Staging](https://github.com/your-org/your-repo/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/your-org/your-repo/actions/workflows/deploy-staging.yml)
[![Deploy Production](https://github.com/your-org/your-repo/actions/workflows/deploy-production.yml/badge.svg)](https://github.com/your-org/your-repo/actions/workflows/deploy-production.yml)
```

## Troubleshooting

### Common Issues

#### 1. Docker Build Fails
```
Error: failed to solve: failed to compute cache key
```

**Solution:**
- Check Dockerfile syntax
- Verify all COPY paths exist
- Check .dockerignore file
- Ensure base image is accessible

#### 2. Kubernetes Deployment Fails
```
Error: error validating data: ValidationError
```

**Solution:**
- Verify KUBECONFIG is correctly base64 encoded
- Check namespace exists
- Verify deployment manifests
- Check RBAC permissions

#### 3. Health Check Fails
```
Error: Health check failed after 10 attempts
```

**Solution:**
- Check application logs
- Verify environment variables
- Check database connectivity
- Increase timeout in workflow

#### 4. Security Scan Fails
```
Error: Critical vulnerabilities found
```

**Solution:**
```bash
# Update dependencies
npm audit fix

# Check specific vulnerabilities
npm audit

# Update specific package
npm update package-name
```

#### 5. Secrets Not Available
```
Error: Secret SLACK_WEBHOOK not found
```

**Solution:**
- Verify secret is created in GitHub Settings
- Check secret name matches exactly (case-sensitive)
- Ensure secret is available in the environment
- Check environment protection rules

## Advanced Configuration

### Custom Deployment Strategies

#### Blue-Green Deployment
Modify `deploy-production.yml` to implement blue-green:

```yaml
- name: Deploy to blue environment
  run: kubectl apply -f k8s/blue-deployment.yaml

- name: Run tests on blue
  run: ./scripts/test-blue.sh

- name: Switch traffic to blue
  run: kubectl patch service api -p '{"spec":{"selector":{"version":"blue"}}}'
```

#### Canary Deployment
Implement gradual rollout:

```yaml
- name: Deploy canary (10%)
  run: kubectl apply -f k8s/canary-deployment.yaml

- name: Monitor canary
  run: ./scripts/monitor-canary.sh

- name: Promote canary to 100%
  run: kubectl scale deployment/api-canary --replicas=10
```

### Custom Quality Gates

Add custom checks to `ci-parallel.yml`:

```yaml
- name: Custom quality check
  run: |
    # Add your custom checks
    npm run custom-lint
    npm run security-check
    npm run performance-test
```

### Integration with External Tools

#### Datadog Integration
```yaml
- name: Send metrics to Datadog
  run: |
    curl -X POST "https://api.datadoghq.com/api/v1/events" \
      -H "DD-API-KEY: ${{ secrets.DATADOG_API_KEY }}" \
      -d @- << EOF
    {
      "title": "Deployment to production",
      "text": "Version ${{ github.ref_name }} deployed",
      "tags": ["environment:production", "service:trading-bot"]
    }
    EOF
```

#### Sentry Release Tracking
```yaml
- name: Create Sentry release
  run: |
    npm install -g @sentry/cli
    sentry-cli releases new "${{ github.ref_name }}"
    sentry-cli releases set-commits "${{ github.ref_name }}" --auto
    sentry-cli releases finalize "${{ github.ref_name }}"
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: trading-bot
```

## Maintenance

### Weekly Tasks
- [ ] Review failed workflow runs
- [ ] Check security scan results
- [ ] Update dependencies if needed
- [ ] Review deployment metrics

### Monthly Tasks
- [ ] Update base Docker images
- [ ] Rotate secrets and tokens
- [ ] Review and optimize workflow performance
- [ ] Update documentation

### Quarterly Tasks
- [ ] Major dependency updates
- [ ] Review and update security policies
- [ ] Disaster recovery testing
- [ ] Team training on CI/CD processes

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Check `.github/workflows/README.md`
4. Contact DevOps team

## Next Steps

After setup is complete:
1. ✅ All secrets configured
2. ✅ Environments created
3. ✅ Branch protection enabled
4. ✅ Test deployments successful
5. ✅ Notifications working
6. ✅ Team trained on processes

You're ready to use the CI/CD pipeline!
