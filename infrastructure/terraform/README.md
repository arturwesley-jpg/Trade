# Terraform Infrastructure for Trading Bot

This directory contains Terraform infrastructure as code for deploying the trading platform to AWS with EKS (Kubernetes).

## Architecture Overview

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public and private subnets, NAT gateways, and VPC flow logs
- **EKS**: Managed Kubernetes cluster with auto-scaling node groups
- **RDS**: PostgreSQL database with automated backups and multi-AZ support
- **ElastiCache**: Redis cluster for caching and session management
- **ALB**: Application Load Balancer with HTTPS support
- **ECR**: Container registry for Docker images
- **CloudWatch**: Comprehensive monitoring, logging, and alerting
- **AWS Backup**: Automated backup solution for RDS
- **Secrets Manager**: Secure storage for sensitive configuration

## Directory Structure

```
infrastructure/terraform/
├── bootstrap/              # Initial setup for Terraform state backend
├── modules/                # Reusable Terraform modules
│   ├── vpc/               # VPC and networking
│   ├── eks/               # EKS cluster and node groups
│   ├── rds/               # PostgreSQL database
│   ├── redis/             # ElastiCache Redis
│   ├── alb/               # Application Load Balancer
│   ├── ecr/               # Container registry
│   ├── monitoring/        # CloudWatch monitoring
│   ├── backup/            # AWS Backup configuration
│   ├── secrets/           # Secrets Manager
│   └── k8s-resources/     # Kubernetes application resources
├── environments/
│   ├── production/        # Production environment
│   └── staging/           # Staging environment
└── main.tf                # Root configuration (legacy)
```

## Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Configured with credentials (`aws configure`)
3. **Terraform**: Version 1.5.0 or higher
4. **kubectl**: For Kubernetes cluster management
5. **Domain & SSL Certificate**: (Optional) ACM certificate for HTTPS

## Initial Setup

### Step 1: Bootstrap Terraform State Backend

First, create the S3 bucket and DynamoDB table for Terraform state management:

```bash
cd bootstrap
terraform init
terraform plan
terraform apply
```

This creates:
- S3 bucket: `trading-bot-terraform-state`
- DynamoDB table: `trading-bot-terraform-locks`

### Step 2: Configure Environment Variables

Copy the example variables file:

```bash
cd ../environments/production
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:

```hcl
region          = "us-east-1"
alarm_email     = "your-email@example.com"
certificate_arn = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
```

### Step 3: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the infrastructure
terraform apply
```

This will create all AWS resources. The process takes approximately 20-30 minutes.

## Deployment by Environment

### Production Environment

```bash
cd environments/production
terraform init
terraform plan
terraform apply
```

**Production Configuration:**
- EKS: 3-20 nodes (t3.xlarge)
- RDS: db.r6g.xlarge, Multi-AZ, 200GB storage
- Redis: cache.r6g.large, 3 nodes
- Backups: 30-day retention

### Staging Environment

```bash
cd environments/staging
terraform init
terraform plan
terraform apply
```

**Staging Configuration:**
- EKS: 2-5 nodes (t3.large)
- RDS: db.t3.large, Single-AZ, 50GB storage
- Redis: cache.t3.medium, 2 nodes
- Backups: 7-day retention

## Post-Deployment Steps

### 1. Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name trading-bot-prod
kubectl get nodes
```

### 2. Deploy Application to Kubernetes

```bash
# Build and push Docker images to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag and push images
docker tag trading-api:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/production/trading-api:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/production/trading-api:latest

# Apply Kubernetes manifests (see infrastructure/k8s/)
kubectl apply -f infrastructure/k8s/
```

### 3. Configure Secrets

Update secrets in AWS Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id production/trading-bot/jwt_secret \
  --secret-string "your-jwt-secret"

aws secretsmanager update-secret \
  --secret-id production/trading-bot/binance_api_key \
  --secret-string "your-binance-api-key"
```

### 4. Configure DNS

Point your domain to the ALB:

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Create CNAME record in Route53 or your DNS provider
# Example: trading.yourdomain.com -> trading-bot-prod-alb-123456789.us-east-1.elb.amazonaws.com
```

## Accessing Resources

### View Outputs

```bash
terraform output
```

Key outputs:
- `eks_cluster_endpoint`: EKS API endpoint
- `alb_dns_name`: Load balancer DNS
- `ecr_repositories`: Container registry URLs
- `rds_endpoint`: Database endpoint (sensitive)
- `redis_endpoint`: Redis endpoint (sensitive)

### Access Database

```bash
# Get database credentials from Secrets Manager
aws secretsmanager get-secret-value --secret-id production-rds-password

# Connect via bastion or kubectl port-forward
kubectl run -it --rm psql --image=postgres:15 --restart=Never -- \
  psql -h <RDS_ENDPOINT> -U tradingadmin -d tradingbot
```

### View Logs

```bash
# Application logs
aws logs tail /aws/trading-bot/production/application --follow

# API logs
aws logs tail /aws/trading-bot/production/api --follow

# Kubernetes pod logs
kubectl logs -f deployment/trading-api -n trading-bot
```

### CloudWatch Dashboard

Access the CloudWatch dashboard:
```bash
terraform output dashboard_name
# Open in AWS Console: CloudWatch > Dashboards > production-trading-bot-dashboard
```

## Cost Estimation

### Production Environment (Monthly)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| EKS Cluster | 1 cluster | $73 |
| EC2 (EKS Nodes) | 5x t3.xlarge | $750 |
| RDS PostgreSQL | db.r6g.xlarge, Multi-AZ | $650 |
| ElastiCache Redis | 3x cache.r6g.large | $450 |
| ALB | 1 load balancer | $25 |
| Data Transfer | ~1TB/month | $90 |
| CloudWatch | Logs + Metrics | $50 |
| Backups | S3 + AWS Backup | $30 |
| **Total** | | **~$2,118/month** |

### Staging Environment (Monthly)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| EKS Cluster | 1 cluster | $73 |
| EC2 (EKS Nodes) | 2x t3.large | $150 |
| RDS PostgreSQL | db.t3.large, Single-AZ | $145 |
| ElastiCache Redis | 2x cache.t3.medium | $100 |
| ALB | 1 load balancer | $25 |
| Data Transfer | ~200GB/month | $18 |
| CloudWatch | Logs + Metrics | $20 |
| Backups | S3 + AWS Backup | $10 |
| **Total** | | **~$541/month** |

## Scaling Guidelines

### Horizontal Scaling (Add More Nodes)

```bash
# Update desired_nodes in terraform.tfvars
desired_nodes = 10

terraform apply
```

### Vertical Scaling (Larger Instances)

```bash
# Update instance types in terraform.tfvars
node_instance_type = "t3.2xlarge"
db_instance_class  = "db.r6g.2xlarge"

terraform apply
```

### Auto-Scaling

EKS node groups automatically scale between `min_nodes` and `max_nodes` based on pod resource requests.

Kubernetes HPA (Horizontal Pod Autoscaler) scales application pods based on CPU/memory utilization.

## Disaster Recovery

### Database Backups

- **Automated Snapshots**: Daily at 2 AM UTC
- **Retention**: 30 days (production), 7 days (staging)
- **Point-in-Time Recovery**: Available for last 14 days

### Restore from Backup

```bash
# List available backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name production-trading-bot-vault

# Restore via AWS Console or CLI
aws backup start-restore-job \
  --recovery-point-arn <RECOVERY_POINT_ARN> \
  --metadata <RESTORE_METADATA>
```

### Infrastructure Recovery

All infrastructure is defined as code. To rebuild:

```bash
terraform destroy  # Remove old infrastructure
terraform apply    # Recreate from scratch
```

## Security Best Practices

1. **Secrets Management**: All sensitive data stored in AWS Secrets Manager
2. **Encryption**: 
   - RDS: Encryption at rest enabled
   - Redis: Encryption in transit and at rest
   - S3: Server-side encryption (AES256)
3. **Network Security**:
   - Private subnets for databases and application
   - Security groups with least-privilege access
   - VPC flow logs enabled
4. **Access Control**:
   - IAM roles for service accounts (IRSA)
   - No hardcoded credentials
5. **Monitoring**: CloudWatch alarms for security events

## Maintenance

### Update Terraform Modules

```bash
terraform get -update
terraform plan
terraform apply
```

### Update EKS Version

```bash
# Update version in modules/eks/main.tf
version = "1.30"

terraform apply
```

### Rotate Secrets

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Update in Secrets Manager
aws secretsmanager update-secret \
  --secret-id production/trading-bot/jwt_secret \
  --secret-string "$NEW_SECRET"

# Restart pods to pick up new secret
kubectl rollout restart deployment/trading-api -n trading-bot
```

## Troubleshooting

### EKS Cluster Not Accessible

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name trading-bot-prod

# Verify IAM permissions
aws sts get-caller-identity
```

### Database Connection Issues

```bash
# Check security groups
aws ec2 describe-security-groups --group-ids <RDS_SG_ID>

# Verify connectivity from EKS
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h <RDS_ENDPOINT> -U tradingadmin -d tradingbot
```

### High Costs

```bash
# Check resource utilization
kubectl top nodes
kubectl top pods -n trading-bot

# Review CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/EKS \
  --metric-name cluster_node_count \
  --dimensions Name=ClusterName,Value=trading-bot-prod \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

### Pod Failures

```bash
# Check pod status
kubectl get pods -n trading-bot

# View pod logs
kubectl logs <POD_NAME> -n trading-bot

# Describe pod for events
kubectl describe pod <POD_NAME> -n trading-bot

# Check resource constraints
kubectl top pods -n trading-bot
```

## Cleanup

To destroy all infrastructure:

```bash
cd environments/production
terraform destroy
```

**WARNING**: This will delete all resources including databases. Ensure backups are available before destroying.

## Support

For issues or questions:
1. Check CloudWatch logs for application errors
2. Review Terraform plan output before applying changes
3. Consult AWS documentation for service-specific issues
4. Review security group rules for connectivity issues

## License

This infrastructure code is part of the Trading Bot project.
