# Security Hardening

This directory contains security configurations, scanning tools, and documentation for the Trading Bot application.

## Directory Structure

```
security/
├── waf/                    # Web Application Firewall configurations
├── scanning/               # Security scanning scripts and tools
├── reports/                # Security audit reports
├── policies/               # Security policies and guidelines
└── ssl/                    # SSL/TLS configurations
```

## Components

### 1. WAF (Web Application Firewall)
- ModSecurity with OWASP Core Rule Set
- Custom rules for trading bot protection
- Rate limiting and DDoS protection

### 2. Security Scanning
- OWASP ZAP automated scanning
- Snyk vulnerability scanning
- npm audit automation
- git-secrets for secret detection

### 3. Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options
- Referrer-Policy

### 4. SSL/TLS
- Modern TLS configuration (TLS 1.2+)
- Strong cipher suites
- Certificate management

## Quick Start

### Run Security Scan
```bash
cd security/scanning
./run-security-scan.sh
```

### Deploy WAF
```bash
docker-compose -f security/waf/docker-compose.waf.yml up -d
```

### Generate Security Report
```bash
cd security/scanning
./generate-security-report.sh
```

## Security Best Practices

1. Keep all dependencies updated
2. Run security scans before each deployment
3. Review security reports weekly
4. Rotate secrets and API keys regularly
5. Monitor security alerts in real-time
6. Follow principle of least privilege
7. Enable audit logging for all critical operations

## Incident Response

See `policies/incident-response.md` for detailed procedures.
