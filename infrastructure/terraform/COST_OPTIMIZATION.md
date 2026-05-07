# Cost Optimization Guide

This guide provides strategies to optimize AWS costs for the trading bot infrastructure.

## Current Cost Breakdown

### Production Environment (~$2,118/month)

| Service | Cost | Percentage | Optimization Potential |
|---------|------|------------|----------------------|
| EC2 (EKS Nodes) | $750 | 35% | High |
| RDS PostgreSQL | $650 | 31% | Medium |
| ElastiCache Redis | $450 | 21% | Medium |
| EKS Cluster | $73 | 3% | None |
| Data Transfer | $90 | 4% | Low |
| CloudWatch | $50 | 2% | Low |
| ALB | $25 | 1% | None |
| Backups | $30 | 1% | Low |

## Optimization Strategies

### 1. Right-Sizing EC2 Instances

**Current**: 5x t3.xlarge (4 vCPU, 16GB RAM)

**Analysis**:
```bash
# Check actual resource utilization
kubectl top nodes

# Expected output showing underutilization:
# NAME                         CPU    MEMORY
# ip-10-0-1-123.ec2.internal   25%    40%
# ip-10-0-2-456.ec2.internal   30%    45%
```

**Recommendation**: Switch to t3.large (2 vCPU, 8GB RAM)
- **Savings**: $375/month (50% reduction)
- **Risk**: Low (can scale up if needed)

```hcl
# Update terraform.tfvars
node_instance_type = "t3.large"
desired_nodes      = 6  # Increase count to maintain capacity
```

### 2. Use Spot Instances for Non-Critical Workloads

**Strategy**: Mix on-demand and spot instances

```hcl
# Add to modules/eks/main.tf
resource "aws_eks_node_group" "spot" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-spot-node-group"
  node_role_arn   = aws_iam_role.node_group.arn
  subnet_ids      = var.private_subnet_ids

  capacity_type  = "SPOT"
  instance_types = ["t3.large", "t3a.large", "t2.large"]

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 2
  }

  labels = {
    workload-type = "spot"
  }

  taint {
    key    = "spot"
    value  = "true"
    effect = "NoSchedule"
  }
}
```

**Savings**: $225/month (30% discount on spot instances)

### 3. RDS Cost Optimization

**Option A: Reserved Instances (1-year commitment)**
- Current: $650/month on-demand
- Reserved: $390/month (40% savings)
- **Savings**: $260/month

**Option B: Downgrade Instance Class**
- Current: db.r6g.xlarge (4 vCPU, 32GB RAM)
- Recommended: db.r6g.large (2 vCPU, 16GB RAM)
- **Savings**: $325/month (50% reduction)

**Option C: Aurora Serverless v2**
- Pay only for actual usage
- Auto-scales based on load
- **Potential Savings**: 30-50% for variable workloads

```hcl
# Update modules/rds/main.tf for Aurora Serverless
resource "aws_rds_cluster" "main" {
  cluster_identifier      = "${var.environment}-trading-db"
  engine                  = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "15.5"
  database_name          = var.db_name
  master_username        = var.db_username
  master_password        = random_password.db_password.result

  serverlessv2_scaling_configuration {
    max_capacity = 4.0
    min_capacity = 0.5
  }
}
```

### 4. ElastiCache Optimization

**Option A: Reserved Nodes (1-year commitment)**
- Current: $450/month on-demand
- Reserved: $270/month (40% savings)
- **Savings**: $180/month

**Option B: Downgrade Node Type**
- Current: 3x cache.r6g.large
- Recommended: 3x cache.r6g.medium
- **Savings**: $225/month (50% reduction)

**Option C: Reduce Node Count**
- Current: 3 nodes (Multi-AZ)
- Recommended: 2 nodes (for staging/dev)
- **Savings**: $150/month (33% reduction)

### 5. Data Transfer Optimization

**Strategies**:
- Use CloudFront CDN for static assets
- Enable compression
- Optimize API responses
- Use VPC endpoints for AWS services

```hcl
# Add VPC endpoints to reduce data transfer costs
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = var.vpc_id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"
  route_table_ids = concat(
    aws_route_table.private[*].id,
    [aws_route_table.public.id]
  )
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
}
```

**Savings**: $20-30/month

### 6. CloudWatch Logs Optimization

**Strategies**:
- Reduce log retention (30 days → 7 days for non-critical logs)
- Filter logs before sending to CloudWatch
- Use log sampling for high-volume logs

```hcl
# Update log retention
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/trading-bot/${var.environment}/application"
  retention_in_days = 7  # Reduced from 30
}
```

**Savings**: $15-20/month

### 7. S3 Backup Optimization

**Strategies**:
- Use S3 Intelligent-Tiering
- Implement lifecycle policies
- Compress backups

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "intelligent-tiering"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}
```

**Savings**: $10-15/month

### 8. Auto-Scaling Configuration

**Implement aggressive auto-scaling**:

```hcl
# Update EKS node group scaling
scaling_config {
  desired_size = 3
  max_size     = 10
  min_size     = 2  # Scale down to 2 during off-hours
}
```

**Schedule-based scaling**:

```yaml
# Kubernetes CronJob to scale down during off-hours
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-down-off-hours
spec:
  schedule: "0 22 * * *"  # 10 PM UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl
            command:
            - kubectl
            - scale
            - deployment/trading-api
            - --replicas=1
```

**Savings**: $100-150/month

## Cost Optimization Tiers

### Tier 1: Quick Wins (No Risk)
- Enable S3 Intelligent-Tiering: **$10/month**
- Reduce CloudWatch log retention: **$15/month**
- Add VPC endpoints: **$25/month**
- **Total Savings**: $50/month

### Tier 2: Low Risk
- Right-size EC2 instances: **$375/month**
- Reduce Redis nodes (staging): **$150/month**
- Implement auto-scaling: **$125/month**
- **Total Savings**: $650/month

### Tier 3: Medium Risk (Requires Testing)
- Use Spot instances: **$225/month**
- Downgrade RDS instance: **$325/month**
- Downgrade Redis nodes: **$225/month**
- **Total Savings**: $775/month

### Tier 4: High Commitment (Reserved Instances)
- RDS Reserved Instances: **$260/month**
- ElastiCache Reserved Instances: **$180/month**
- **Total Savings**: $440/month

## Optimized Cost Scenarios

### Scenario 1: Conservative Optimization
**Changes**: Tier 1 + Tier 2
- **Current Cost**: $2,118/month
- **Optimized Cost**: $1,418/month
- **Savings**: $700/month (33%)

### Scenario 2: Aggressive Optimization
**Changes**: Tier 1 + Tier 2 + Tier 3
- **Current Cost**: $2,118/month
- **Optimized Cost**: $643/month
- **Savings**: $1,475/month (70%)

### Scenario 3: Maximum Optimization
**Changes**: All Tiers
- **Current Cost**: $2,118/month
- **Optimized Cost**: $203/month
- **Savings**: $1,915/month (90%)

## Monitoring Cost Optimization

### Set Up Cost Alerts

```bash
# Create budget alert
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json

# budget.json
{
  "BudgetName": "trading-bot-monthly-budget",
  "BudgetLimit": {
    "Amount": "1500",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

### Cost Explorer Tags

```hcl
# Add cost allocation tags
default_tags {
  tags = {
    Environment = var.environment
    Project     = "trading-bot"
    CostCenter  = "engineering"
    Owner       = "platform-team"
  }
}
```

### Daily Cost Reports

```bash
# Get daily cost breakdown
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## Cost Optimization Checklist

- [ ] Right-size EC2 instances based on actual usage
- [ ] Implement auto-scaling policies
- [ ] Use Spot instances for non-critical workloads
- [ ] Purchase Reserved Instances for stable workloads
- [ ] Optimize database instance size
- [ ] Reduce log retention periods
- [ ] Implement S3 lifecycle policies
- [ ] Use VPC endpoints to reduce data transfer
- [ ] Enable S3 Intelligent-Tiering
- [ ] Set up cost alerts and budgets
- [ ] Review and remove unused resources
- [ ] Optimize container images (smaller = faster = cheaper)
- [ ] Use CloudFront for static assets
- [ ] Implement caching strategies
- [ ] Schedule non-critical workloads during off-peak hours

## Tools for Cost Optimization

1. **AWS Cost Explorer**: Analyze spending patterns
2. **AWS Trusted Advisor**: Get cost optimization recommendations
3. **Kubecost**: Kubernetes cost monitoring
4. **Infracost**: Terraform cost estimation

```bash
# Install Kubecost
kubectl create namespace kubecost
helm repo add kubecost https://kubecost.github.io/cost-analyzer/
helm install kubecost kubecost/cost-analyzer \
  --namespace kubecost \
  --set kubecostToken="your-token"
```

## Conclusion

By implementing these optimizations, you can reduce infrastructure costs by 33-90% while maintaining performance and reliability. Start with Tier 1 and Tier 2 optimizations for immediate savings with minimal risk.
