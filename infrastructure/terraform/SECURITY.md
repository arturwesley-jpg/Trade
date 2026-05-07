# Security Best Practices for Terraform Infrastructure

This document outlines security best practices for the trading bot infrastructure.

## 1. Secrets Management

### AWS Secrets Manager

All sensitive data is stored in AWS Secrets Manager:

- Database passwords
- Redis auth tokens
- API keys (Binance, Telegram)
- JWT secrets
- Encryption keys

**Best Practices:**
- Never commit secrets to version control
- Use IAM roles for service accounts (IRSA) to access secrets
- Rotate secrets regularly (every 90 days)
- Enable automatic rotation where possible

### Rotating Secrets

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

## 2. Network Security

### VPC Configuration

- **Private Subnets**: All application workloads run in private subnets
- **Public Subnets**: Only ALB and NAT gateways in public subnets
- **NAT Gateways**: Provide outbound internet access for private subnets
- **VPC Flow Logs**: Enabled for network traffic monitoring

### Security Groups

**Principle of Least Privilege:**
- RDS: Only accessible from EKS worker nodes
- Redis: Only accessible from EKS worker nodes
- EKS: Only necessary ports open
- ALB: Only ports 80 and 443 open to internet

### Network Policies

Implement Kubernetes Network Policies:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: trading-bot
spec:
  podSelector:
    matchLabels:
      app: trading-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: trading-web
    ports:
    - protocol: TCP
      port: 3000
```

## 3. Encryption

### Data at Rest

- **RDS**: Encryption enabled using AWS KMS
- **ElastiCache**: Encryption at rest enabled
- **S3**: Server-side encryption (AES256)
- **EBS**: Encrypted volumes for EKS nodes

### Data in Transit

- **RDS**: SSL/TLS connections required
- **Redis**: TLS encryption enabled
- **ALB**: HTTPS with TLS 1.2+
- **Internal**: Service mesh with mTLS (optional)

## 4. IAM Security

### IAM Roles

**EKS Cluster Role:**
- Minimum permissions for cluster management
- No direct access to application resources

**Node Group Role:**
- ECR pull permissions
- CloudWatch logs write
- SSM parameter read (for secrets)

**Service Account Roles (IRSA):**
- Fine-grained permissions per service
- No shared credentials

### IAM Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:production/trading-bot/*"
      ]
    }
  ]
}
```

## 5. Access Control

### AWS Account

- Enable MFA for all IAM users
- Use IAM roles instead of access keys
- Implement least privilege access
- Regular access reviews

### Kubernetes RBAC

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: trading-bot
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch"]
```

### SSH Access

- **No SSH Access**: Use AWS Systems Manager Session Manager
- **Bastion Host**: Not required with SSM
- **kubectl**: Access via IAM authentication

## 6. Monitoring and Auditing

### CloudWatch Logs

All logs centralized in CloudWatch:
- Application logs
- API access logs
- Database query logs
- VPC flow logs

### CloudTrail

Enable CloudTrail for audit logging:
- All API calls logged
- S3 bucket with encryption
- Log file validation enabled

### Security Monitoring

```bash
# Monitor failed authentication attempts
aws logs filter-log-events \
  --log-group-name /aws/trading-bot/production/api \
  --filter-pattern "authentication failed"

# Monitor suspicious activity
aws logs filter-log-events \
  --log-group-name /aws/trading-bot/production/application \
  --filter-pattern "ERROR"
```

## 7. Compliance

### Data Protection

- **GDPR**: User data encrypted and deletable
- **PCI DSS**: No credit card data stored
- **SOC 2**: Audit logs and access controls

### Backup and Recovery

- **RDS**: Automated daily backups, 30-day retention
- **Point-in-Time Recovery**: 14-day window
- **Disaster Recovery**: Multi-AZ deployment

## 8. Container Security

### Image Scanning

ECR automatically scans images for vulnerabilities:

```bash
# View scan results
aws ecr describe-image-scan-findings \
  --repository-name production/trading-api \
  --image-id imageTag=latest
```

### Runtime Security

- **Read-only root filesystem**: Where possible
- **Non-root user**: All containers run as non-root
- **Resource limits**: CPU and memory limits set
- **Security contexts**: Drop unnecessary capabilities

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL
```

## 9. API Security

### Authentication

- JWT tokens with short expiration
- Refresh token rotation
- API key authentication for external services

### Rate Limiting

```typescript
// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
```

### Input Validation

- Validate all user inputs
- Sanitize data before database queries
- Use parameterized queries (prevent SQL injection)

## 10. Incident Response

### Security Incident Playbook

1. **Detection**: CloudWatch alarms trigger
2. **Containment**: Isolate affected resources
3. **Investigation**: Review logs and metrics
4. **Remediation**: Apply fixes and patches
5. **Recovery**: Restore from backups if needed
6. **Post-mortem**: Document and improve

### Emergency Contacts

```bash
# SNS topic for security alerts
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:security-alerts \
  --message "Security incident detected" \
  --subject "URGENT: Security Alert"
```

## 11. Regular Security Tasks

### Weekly

- Review CloudWatch alarms
- Check for failed login attempts
- Monitor resource utilization

### Monthly

- Review IAM permissions
- Update security groups
- Patch vulnerabilities
- Review access logs

### Quarterly

- Rotate secrets
- Update SSL certificates
- Security audit
- Disaster recovery test

## 12. Security Checklist

Before going to production:

- [ ] All secrets in AWS Secrets Manager
- [ ] MFA enabled for all users
- [ ] CloudTrail enabled
- [ ] VPC flow logs enabled
- [ ] Security groups follow least privilege
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enabled
- [ ] Backup strategy tested
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] Regular security updates scheduled
- [ ] Container images scanned
- [ ] RBAC policies configured
- [ ] Network policies implemented
- [ ] Rate limiting enabled
- [ ] Input validation implemented

## 13. Security Tools

### Recommended Tools

- **AWS Security Hub**: Centralized security findings
- **AWS GuardDuty**: Threat detection
- **AWS Inspector**: Vulnerability scanning
- **Falco**: Runtime security for Kubernetes
- **OPA**: Policy enforcement
- **Trivy**: Container vulnerability scanning

### Installation

```bash
# Install Falco on EKS
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm install falco falcosecurity/falco \
  --namespace falco-system \
  --create-namespace

# Install OPA Gatekeeper
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/master/deploy/gatekeeper.yaml
```

## 14. Compliance Automation

### AWS Config Rules

```bash
# Enable AWS Config
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=arn:aws:iam::ACCOUNT:role/config-role

# Add compliance rules
aws configservice put-config-rule \
  --config-rule file://config-rules/encrypted-volumes.json
```

## 15. Security Updates

### Patching Strategy

- **Critical**: Within 24 hours
- **High**: Within 7 days
- **Medium**: Within 30 days
- **Low**: Next maintenance window

### Update Process

```bash
# Update EKS cluster
terraform apply -target=module.eks

# Update node groups (rolling update)
kubectl drain <NODE_NAME> --ignore-daemonsets
# Wait for node to be replaced
kubectl uncordon <NODE_NAME>
```

## Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
