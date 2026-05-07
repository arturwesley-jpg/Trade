# Kubernetes Deployment Guide

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Helm 3.x installed
- Docker images built and pushed to registry

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f kubernetes/deployment.yml
```

This creates the `trading-platform` namespace.

### 2. Configure Secrets

Edit `kubernetes/deployment.yml` and update the secrets:

```bash
kubectl create secret generic trading-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@postgres:5432/trading' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=JWT_SECRET='your-secret-here' \
  --from-literal=JWT_REFRESH_SECRET='your-refresh-secret-here' \
  --from-literal=BINANCE_API_KEY='your-binance-key' \
  --from-literal=BINANCE_API_SECRET='your-binance-secret' \
  -n trading-platform
```

### 3. Deploy Infrastructure

```bash
# Deploy PostgreSQL and Redis
kubectl apply -f kubernetes/deployment.yml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n trading-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n trading-platform --timeout=300s
```

### 4. Deploy Applications

```bash
# Build and push Docker images
docker build -t your-registry/trading-api:latest -f apps/api/Dockerfile .
docker build -t your-registry/trading-web:latest -f apps/web/Dockerfile .
docker build -t your-registry/trading-worker:latest -f apps/worker/Dockerfile .

docker push your-registry/trading-api:latest
docker push your-registry/trading-web:latest
docker push your-registry/trading-worker:latest

# Update image references in deployment.yml
# Then apply
kubectl apply -f kubernetes/deployment.yml
```

### 5. Deploy Monitoring

```bash
kubectl apply -f kubernetes/monitoring.yml

# Access Grafana
kubectl port-forward svc/grafana 3000:3000 -n trading-platform
# Open http://localhost:3000 (admin/admin)
```

### 6. Setup Ingress

```bash
# Install nginx-ingress-controller if not present
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Apply ingress
kubectl apply -f kubernetes/ingress.yml
```

## Scaling

### Manual Scaling

```bash
# Scale API
kubectl scale deployment trading-api --replicas=5 -n trading-platform

# Scale Web
kubectl scale deployment trading-web --replicas=3 -n trading-platform

# Scale Worker
kubectl scale deployment trading-worker --replicas=4 -n trading-platform
```

### Auto-scaling

HPA (Horizontal Pod Autoscaler) is configured in `deployment.yml`:

- **API**: 3-10 replicas (CPU 70%, Memory 80%)
- **Web**: 2-5 replicas (CPU 70%)

Monitor auto-scaling:

```bash
kubectl get hpa -n trading-platform -w
```

## Monitoring

### Prometheus Metrics

```bash
# Port-forward Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n trading-platform

# Open http://localhost:9090
```

### Grafana Dashboards

```bash
# Port-forward Grafana
kubectl port-forward svc/grafana 3000:3000 -n trading-platform

# Open http://localhost:3000
# Default credentials: admin/admin
```

### Logs

```bash
# API logs
kubectl logs -f deployment/trading-api -n trading-platform

# Worker logs
kubectl logs -f deployment/trading-worker -n trading-platform

# Web logs
kubectl logs -f deployment/trading-web -n trading-platform

# All logs with labels
kubectl logs -l app=trading-api -n trading-platform --tail=100 -f
```

## Database Management

### Backup PostgreSQL

```bash
# Create backup
kubectl exec -it postgres-0 -n trading-platform -- pg_dump -U postgres trading > backup.sql

# Restore backup
kubectl exec -i postgres-0 -n trading-platform -- psql -U postgres trading < backup.sql
```

### Access PostgreSQL

```bash
# Port-forward
kubectl port-forward svc/postgres 5432:5432 -n trading-platform

# Connect
psql postgresql://postgres:postgres@localhost:5432/trading
```

### Access Redis

```bash
# Port-forward
kubectl port-forward svc/redis 6379:6379 -n trading-platform

# Connect
redis-cli -h localhost -p 6379
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n trading-platform
kubectl describe pod <pod-name> -n trading-platform
```

### Check Events

```bash
kubectl get events -n trading-platform --sort-by='.lastTimestamp'
```

### Check Resource Usage

```bash
kubectl top pods -n trading-platform
kubectl top nodes
```

### Restart Deployment

```bash
kubectl rollout restart deployment/trading-api -n trading-platform
kubectl rollout restart deployment/trading-web -n trading-platform
kubectl rollout restart deployment/trading-worker -n trading-platform
```

### Rollback Deployment

```bash
# Check rollout history
kubectl rollout history deployment/trading-api -n trading-platform

# Rollback to previous version
kubectl rollout undo deployment/trading-api -n trading-platform

# Rollback to specific revision
kubectl rollout undo deployment/trading-api --to-revision=2 -n trading-platform
```

## Health Checks

### API Health

```bash
kubectl exec -it deployment/trading-api -n trading-platform -- wget -qO- http://localhost:3001/health
```

### Database Health

```bash
kubectl exec -it postgres-0 -n trading-platform -- pg_isready -U postgres
```

### Redis Health

```bash
kubectl exec -it redis-0 -n trading-platform -- redis-cli ping
```

## Security

### Update Secrets

```bash
kubectl delete secret trading-secrets -n trading-platform
kubectl create secret generic trading-secrets \
  --from-literal=DATABASE_URL='new-value' \
  --from-literal=JWT_SECRET='new-secret' \
  -n trading-platform

# Restart pods to pick up new secrets
kubectl rollout restart deployment/trading-api -n trading-platform
```

### Network Policies

```bash
# Apply network policies (create kubernetes/network-policy.yml first)
kubectl apply -f kubernetes/network-policy.yml
```

## Performance Tuning

### Resource Limits

Edit `kubernetes/deployment.yml` to adjust:

- `requests`: Guaranteed resources
- `limits`: Maximum resources

### Database Tuning

```bash
# Access PostgreSQL
kubectl exec -it postgres-0 -n trading-platform -- psql -U postgres trading

# Check connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace trading-platform

# Delete ingress controller
helm uninstall nginx-ingress -n ingress-nginx

# Delete cert-manager
kubectl delete -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

## Production Checklist

- [ ] Update all secrets with production values
- [ ] Configure SSL certificates
- [ ] Setup backup strategy for PostgreSQL
- [ ] Configure monitoring alerts
- [ ] Setup log aggregation (ELK/Loki)
- [ ] Configure resource limits based on load testing
- [ ] Setup CI/CD pipeline
- [ ] Configure network policies
- [ ] Enable pod security policies
- [ ] Setup disaster recovery plan
- [ ] Configure rate limiting
- [ ] Setup DDoS protection
- [ ] Enable audit logging
- [ ] Configure RBAC properly
- [ ] Setup cost monitoring

## Support

For issues, check:
1. Pod logs: `kubectl logs -f <pod-name> -n trading-platform`
2. Events: `kubectl get events -n trading-platform`
3. Resource usage: `kubectl top pods -n trading-platform`
4. Health endpoints: `/health` on each service
