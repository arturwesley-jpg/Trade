#!/bin/bash

# OWASP ZAP Security Scan Script for Trading Bot
# This script runs automated security scans using OWASP ZAP

set -e

# Configuration
ZAP_VERSION="2.14.0"
TARGET_URL="${TARGET_URL:-http://localhost:3000}"
ZAP_CONFIG="${ZAP_CONFIG:-./zap-config.yaml}"
REPORT_DIR="${REPORT_DIR:-./reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="zap-report-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== OWASP ZAP Security Scan ===${NC}"
echo "Target: ${TARGET_URL}"
echo "Config: ${ZAP_CONFIG}"
echo "Report: ${REPORT_DIR}/${REPORT_FILE}"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Create report directory
mkdir -p "${REPORT_DIR}"

# Check if target is reachable
echo -e "${YELLOW}Checking if target is reachable...${NC}"
if ! curl -s -o /dev/null -w "%{http_code}" "${TARGET_URL}/api/health" | grep -q "200"; then
    echo -e "${RED}Warning: Target ${TARGET_URL} is not reachable${NC}"
    echo "Make sure the application is running before scanning"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Pull latest ZAP Docker image
echo -e "${YELLOW}Pulling OWASP ZAP Docker image...${NC}"
docker pull owasp/zap2docker-stable:${ZAP_VERSION}

# Run ZAP baseline scan
echo -e "${YELLOW}Running ZAP baseline scan...${NC}"
docker run --rm \
    --network host \
    -v "$(pwd)/${REPORT_DIR}:/zap/wrk:rw" \
    owasp/zap2docker-stable:${ZAP_VERSION} \
    zap-baseline.py \
    -t "${TARGET_URL}" \
    -r "${REPORT_FILE}-baseline.html" \
    -J "${REPORT_FILE}-baseline.json" \
    -w "${REPORT_FILE}-baseline.md" \
    -d \
    -I \
    -l INFO

# Run ZAP full scan with automation framework
if [ -f "${ZAP_CONFIG}" ]; then
    echo -e "${YELLOW}Running ZAP full scan with automation framework...${NC}"
    docker run --rm \
        --network host \
        -v "$(pwd)/${REPORT_DIR}:/zap/reports:rw" \
        -v "$(pwd)/${ZAP_CONFIG}:/zap/config/zap-config.yaml:ro" \
        owasp/zap2docker-stable:${ZAP_VERSION} \
        zap.sh \
        -cmd \
        -autorun /zap/config/zap-config.yaml \
        -config api.disablekey=true
else
    echo -e "${YELLOW}ZAP config not found, skipping full scan${NC}"
fi

# Run ZAP API scan
echo -e "${YELLOW}Running ZAP API scan...${NC}"
docker run --rm \
    --network host \
    -v "$(pwd)/${REPORT_DIR}:/zap/wrk:rw" \
    owasp/zap2docker-stable:${ZAP_VERSION} \
    zap-api-scan.py \
    -t "${TARGET_URL}/api" \
    -f openapi \
    -r "${REPORT_FILE}-api.html" \
    -J "${REPORT_FILE}-api.json" \
    -w "${REPORT_FILE}-api.md" \
    -d \
    -I \
    -l INFO

# Parse results and check for critical issues
echo -e "${YELLOW}Analyzing scan results...${NC}"

CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

if [ -f "${REPORT_DIR}/${REPORT_FILE}-baseline.json" ]; then
    CRITICAL_COUNT=$(jq '[.site[].alerts[] | select(.riskcode == "3")] | length' "${REPORT_DIR}/${REPORT_FILE}-baseline.json")
    HIGH_COUNT=$(jq '[.site[].alerts[] | select(.riskcode == "2")] | length' "${REPORT_DIR}/${REPORT_FILE}-baseline.json")
    MEDIUM_COUNT=$(jq '[.site[].alerts[] | select(.riskcode == "1")] | length' "${REPORT_DIR}/${REPORT_FILE}-baseline.json")
    LOW_COUNT=$(jq '[.site[].alerts[] | select(.riskcode == "0")] | length' "${REPORT_DIR}/${REPORT_FILE}-baseline.json")
fi

echo ""
echo -e "${GREEN}=== Scan Results ===${NC}"
echo -e "${RED}Critical: ${CRITICAL_COUNT}${NC}"
echo -e "${RED}High: ${HIGH_COUNT}${NC}"
echo -e "${YELLOW}Medium: ${MEDIUM_COUNT}${NC}"
echo -e "${GREEN}Low: ${LOW_COUNT}${NC}"
echo ""

# Generate summary report
cat > "${REPORT_DIR}/${REPORT_FILE}-summary.txt" <<EOF
OWASP ZAP Security Scan Summary
================================

Scan Date: $(date)
Target: ${TARGET_URL}
ZAP Version: ${ZAP_VERSION}

Vulnerability Summary:
- Critical: ${CRITICAL_COUNT}
- High: ${HIGH_COUNT}
- Medium: ${MEDIUM_COUNT}
- Low: ${LOW_COUNT}

Reports Generated:
- HTML Report: ${REPORT_FILE}-baseline.html
- JSON Report: ${REPORT_FILE}-baseline.json
- Markdown Report: ${REPORT_FILE}-baseline.md
- API Report: ${REPORT_FILE}-api.html

Recommendations:
1. Review all critical and high severity issues immediately
2. Prioritize fixes based on risk and exploitability
3. Re-run scan after applying fixes
4. Integrate ZAP into CI/CD pipeline for continuous security testing

EOF

echo -e "${GREEN}Summary report saved to: ${REPORT_DIR}/${REPORT_FILE}-summary.txt${NC}"

# Check if scan should fail based on findings
if [ "${CRITICAL_COUNT}" -gt 0 ]; then
    echo -e "${RED}FAIL: Critical vulnerabilities found!${NC}"
    exit 1
elif [ "${HIGH_COUNT}" -gt 5 ]; then
    echo -e "${RED}FAIL: Too many high severity vulnerabilities found!${NC}"
    exit 1
else
    echo -e "${GREEN}PASS: No critical issues found${NC}"
    exit 0
fi
