#!/bin/bash

# ============================================================
# PULSE SANTÉ — Script de Monitoring Sécurité
# ============================================================
# À exécuter régulièrement (cron job: */5 * * * *)

LOG_FILE="/var/log/pulsesante/security-monitor.log"
ALERT_EMAIL="andy.deruy@etu.unilim.fr"
ALERT_THRESHOLD=5  # Alerts après 5 erreurs suspectes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# Fonction: Logging
# ============================================================
log_event() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# ============================================================
# 1. Vérifier les fichiers sensibles
check_sensitive_files() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔍 Vérification des fichiers sensibles..."
  
  SENSITIVE_FILES=(
    ".env"
    ".git/config"
    "config.php"
    "database.yml"
    "private_key.pem"
  )
  
  FOUND_ISSUES=0
  for file in "${SENSITIVE_FILES[@]}"; do
    if [ -f "$file" ] && [ -r "$file" ]; then
      echo -e "${RED}⚠️  Fichier sensible trouvé et lisible: $file${NC}"
      log_event "SECURITY_ALERT: Sensitive file found - $file"
      FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
  done
  
  if [ $FOUND_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ Aucun fichier sensible trouvé${NC}"
  fi
}

# ============================================================
# 2. Vérifier les permissions des fichiers
# ============================================================
check_file_permissions() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔐 Vérification des permissions..."
  
  # Les fichiers PHP doivent avoir permissions 644
  if find . -name "*.php" -type f ! -perm 644 2>/dev/null | grep -q .; then
    echo -e "${RED}⚠️  Fichiers PHP avec permissions incorrectes${NC}"
    find . -name "*.php" -type f ! -perm 644 -exec echo "  {}" \;
    log_event "SECURITY_ALERT: Incorrect file permissions on PHP files"
  else
    echo -e "${GREEN}✓ Permissions des fichiers OK${NC}"
  fi
}

# ============================================================
# 3. Vérifier les en-têtes de sécurité
# ============================================================
check_security_headers() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🛡️  Vérification des en-têtes de sécurité..."
  
  DOMAIN="pulsesante.fr"
  
  # Vérifier HTTPS
  if ! curl -sI "https://$DOMAIN" 2>/dev/null | grep -q "Strict-Transport-Security"; then
    echo -e "${YELLOW}⚠️  HSTS non détecté ou non activé${NC}"
    log_event "WARNING: HSTS header missing"
  else
    echo -e "${GREEN}✓ HSTS activé${NC}"
  fi
  
  # Vérifier CSP
  if ! curl -sI "https://$DOMAIN" 2>/dev/null | grep -q "Content-Security-Policy"; then
    echo -e "${YELLOW}⚠️  CSP non détecté${NC}"
    log_event "WARNING: CSP header missing"
  else
    echo -e "${GREEN}✓ CSP détecté${NC}"
  fi
}

# ============================================================
# 4. Vérifier les logs d'accès pour les attaques
# ============================================================
check_access_logs() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 Vérification des logs d'accès..."
  
  # Chercher les tentatives SQL Injection
  if tail -n 1000 /var/log/apache2/access.log 2>/dev/null | grep -i "union.*select\|drop.*table\|insert.*into" | head -5; then
    echo -e "${RED}⚠️  Tentatives SQL Injection détectées!${NC}"
    log_event "SECURITY_ALERT: SQL Injection attempts detected"
  else
    echo -e "${GREEN}✓ Pas de tentatives SQL Injection${NC}"
  fi
  
  # Chercher les tentatives XSS
  if tail -n 1000 /var/log/apache2/access.log 2>/dev/null | grep -i "<script\|javascript:\|onerror=" | head -5; then
    echo -e "${RED}⚠️  Tentatives XSS détectées!${NC}"
    log_event "SECURITY_ALERT: XSS attempts detected"
  else
    echo -e "${GREEN}✓ Pas de tentatives XSS${NC}"
  fi
}

# ============================================================
# 5. Vérifier les dépendances outdatées
# ============================================================
check_dependencies() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Vérification des dépendances..."
  
  if [ -f "package.json" ] && command -v npm &> /dev/null; then
    if npm audit 2>/dev/null | grep -q "vulnerabilities"; then
      echo -e "${RED}⚠️  Vulnérabilités npm détectées!${NC}"
      npm audit 2>/dev/null | tail -5
      log_event "SECURITY_ALERT: NPM vulnerabilities found"
    else
      echo -e "${GREEN}✓ Aucune vulnérabilité npm${NC}"
    fi
  fi
}

# ============================================================
# 6. Vérifier l'uptime et la disponibilité
# ============================================================
check_uptime() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⏱️  Vérification de l'uptime..."
  
  DOMAIN="https://pulsesante.fr"
  RESPONSE_CODE=$(curl -o /dev/null -s -w "%{http_code}" "$DOMAIN" --max-time 5)
  
  if [ "$RESPONSE_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Site accessible (HTTP $RESPONSE_CODE)${NC}"
  else
    echo -e "${RED}⚠️  Site inaccessible (HTTP $RESPONSE_CODE)${NC}"
    log_event "ALERT: Site returning HTTP $RESPONSE_CODE"
  fi
}

# ============================================================
# MAIN EXECUTION
# ============================================================
echo ""
echo "🔐 PULSE SANTÉ — Monitoring Sécurité"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

check_sensitive_files
check_file_permissions
check_security_headers
check_access_logs
check_dependencies
check_uptime

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Monitoring complété$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# Loguer la completion
log_event "Security monitoring completed"
