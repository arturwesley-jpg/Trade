# Deployment Guide

This guide walks through deploying the trading bot infrastructure to AWS.

## Prerequisites Checklist

- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform 1.5.0+ installed
- [ ] kubectl installed
- [ ] Docker installed (for building images)
- [ ] Domain name (optional, for HTTPS)
- [ ] ACM certificate (optional, for HTTPS)

## Step-by-Step Deployment

### Phase 1: Bootstrap (5 minutes)

Create the Terraform state backend:

```bash
cd infrastructure/terraform/bootstrap
terraform init
terraform apply
```

Expected output:
```
state_bucket_name = "trading-bot-terraform-state"
lock_table_name = "trading-bot-terraform-locks"
```

### Phase 2: Configure Environment (5 minutes)

Choose your environment (production or staging):

```bash
cd ../environments/production
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
region          = "us-east-1"
alarm_email     = "alerts@yourcompany.com"
certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/abc-123"
```

### Phase 3: Deploy Infrastructure (20-30 minutes)

```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

This creates:
- VPC with 3 availability zones
- EKS cluster with worker nodes
- RDS PostgreSQL database
- ElastiCache Redis cluster
- Application Load Balancer
- ECR repositories
- CloudWatch monitoring
- S3 backup buckets

### Phase 4: Configure kubectl (2 minutes)

```bash
aws eks update-kubeconfig --region us-east-1 --name trading-bot-prod
kubectl get nodes
```

Expected output:
```
NAME                         STATUS   ROLES    AGE   VERSION
ip-10-0-1-123.ec2.internal   Ready    <none>   5m    v1.29.0
ip-10-0-2-456.ec2.internal   Ready    <none>   5m    v1.29.0
ip-10-0-3-789.ec2.internal   Ready    <none>   5m    v1.29.0
```

### Phase 5: Build and Push Docker Images (10 minutes)

Get ECR login:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com
```

Build and push images:

```bash
# Get ECR URLs from Terraform output
terraform output ecr_repositories

# Build images
cd ../../../../  # Back to project root
docker build -t trading-api -f apps/api/Dockerfile.optimized .
docker build -t trading-web -f apps/web/Dockerfile.optimized .
docker build -t trading-worker -f apps/worker/Dockerfile.optimized .

# Tag and push
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/production"

docker tag trading-api:latest $ECR_BASE/trading-api:latest
docker tag trading-web:latest $ECR_BASE/trading-web:latest
docker tag trading-worker:latest $ECR_BASE/trading-worker:latest

docker push $ECR_BASE/trading-api:latest
docker push $ECR_BASE/trading-web:latest
docker push $ECR_BASE/trading-worker:latest
```

### Phase 6: Configure Secrets (5 minutes)

Update application secrets in AWS Secrets Manager:

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Update secrets
aws secretsmanager update-secret \
  --secret-id production/trading-bot/jwt_secret \
  --secret-string "$JWT_SECRET"

aws secretsmanager update-secret \
  --secret-id production/trading-bot/encryption_key \
  --secret-string "$ENCRYPTION_KEY"

# Add your API keys
aws secretsmanager update-secret \
  --secret-id production/trading-bot/binance_api_key \
  --secret-string "your-binance-api-key"

aws secretsmanager update-secret \
  --secret-id production/trading-bot/binance_api_secret \
  --secret-string "your-binance-api-secret"

aws secretsmanager update-secret \
  --secret-id production/trading-bot/telegram_bot_token \
  --secret-string "your-telegram-bot-token"
```

### Phase 7: Deploy Application to Kubernetes (5 minutes)

```bash
cd infrastructure/k8s
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f deployments/
kubectl apply -f services/
kubectl apply -f ingress.yaml
```

Verify deployment:

```bash
kubectl get pods -n trading-bot
kubectl get services -n trading-bot
```

### Phase 8: Configure DNS (5 minutes)

Get the ALB DNS name:

```bash
cd ../../terraform/environments/production
terraform output alb_dns_name
```

Create DNS records:

**Option A: Route53**
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "trading.yourdomain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "ALB_DNS_NAME"}]
      }
    }]
  }'
```

**Option B: Other DNS Provider**
- Create CNAME record: `trading.yourdomain.com` → `ALB_DNS_NAME`

### Phase 9: Verify Deployment (5 minutes)

Check application health:

```bash
# Check pods
kubectl get pods -n trading-bot

# Check logs
kubectl logs -f deployment/trading-api -n trading-bot

# Test API endpoint
curl https://trading.yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-05T12:54:20.900Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Phase 10: Set Up Monitoring (5 minutes)

Access CloudWatch Dashboard:

```bash
# Get dashboard name
terraform output dashboard_name

# Open in browser
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=$(terraform output -raw dashboard_name)"
```

Configure alarm notifications:

```bash
# Subscribe to SNS topic
aws sns subscribe \
  --topic-arn $(terraform output -raw monitoring_sns_topic_arn) \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email
```

## Post-Deployment Tasks

### 1. Database Migration

```bash
# Port-forward to database
kubectl port-forward svc/trading-api 3000:80 -n trading-bot &

# Run migrations
npm run migrate:latest
```

### 2. Load Initial Data

```bash
# Seed database with initial data
npm run seed:production
```

### 3. Test Trading Functionality

```bash
# Test market data
curl https://trading.yourdomain.com/api/market-data/BTCUSDT

# Test signal generation
curl https://trading.yourdomain.com/api/signals
```

### 4. Configure Backups

Backups are automatic, but verify:

```bash
# Check backup plan
aws backup list-backup-plans

# Verify backup vault
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name production-trading-bot-vault
```

## Rollback Procedure

If deployment fails:

```bash
# Rollback Kubernetes deployment
kubectl rollout undo deployment/trading-api -n trading-bot

# Rollback infrastructure (if needed)
cd infrastructure/terraform/environments/production
terraform plan -destroy
terraform destroy
```

## Troubleshooting

### Issue: EKS nodes not ready

```bash
kubectl describe nodes
kubectl get events -n kube-system
```

### Issue: Pods not starting

```bash
kubectl describe pod <POD_NAME> -n trading-bot
kubectl logs <POD_NAME> -n trading-bot
```

### Issue: Database connection failed

```bash
# Check security groups
aws ec2 describe-security-groups --group-ids <RDS_SG_ID>

# Test connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h <RDS_ENDPOINT> -U tradingadmin -d tradingbot
```

### Issue: High costs

```bash
# Check resource utilization
kubectl top nodes
kubectl top pods -n trading-bot

# Scale down if needed
kubectl scale deployment/trading-api --replicas=2 -n trading-bot
```

## Next Steps

1. Set up CI/CD pipeline (see `.github/workflows/`)
2. Configure monitoring alerts
3. Set up log aggregation
4. Implement disaster recovery testing
5. Document runbooks for common operations

## Estimated Timeline

| Phase | Duration | Can Run in Parallel |
|-------|----------|---------------------|
| Bootstrap | 5 min | No |
| Configure | 5 min | No |
| Deploy Infrastructure | 25 min | No |
| Configure kubectl | 2 min | No |
| Build Images | 10 min | Yes (with Phase 6) |
| Configure Secrets | 5 min | Yes (with Phase 5) |
| Deploy K8s | 5 min | No |
| Configure DNS | 5 min | Yes (with Phase 9) |
| Verify | 5 min | No |
| Monitoring | 5 min | Yes |

**Total Time**: ~45-60 minutes (with parallelization)

## Cost Summary

After deployment, expect monthly costs of:
- **Production**: ~$2,118/month
- **Staging**: ~$541/month

See README.md for detailed cost breakdown.
