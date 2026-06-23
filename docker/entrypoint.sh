#!/bin/bash
# entrypoint.sh - Script de inicialização do container (Sem PostgreSQL)

set -e

echo "🚀 Iniciando TechStock Stack..."

# ── Iniciar Prometheus ──────────────────────────────────────────────────────
echo "📊 Iniciando Prometheus..."
/opt/prometheus/prometheus \
    --config.file=/opt/prometheus/prometheus.yml \
    --storage.tsdb.path=/var/lib/prometheus \
    --web.listen-address=0.0.0.0:9090 &
sleep 2

# ── Iniciar Node Exporter ──────────────────────────────────────────────────
echo "💻 Iniciando Node Exporter..."
/opt/node_exporter/node_exporter \
    --web.listen-address=0.0.0.0:9100 &
sleep 2

# ── Iniciar Grafana ────────────────────────────────────────────────────────
echo "📈 Iniciando Grafana..."
/opt/grafana/bin/grafana-server \
    --config=/opt/grafana/conf/custom.ini \
    --homepath=/opt/grafana \
    --packaging=docker &
sleep 3

# ── Iniciar Backend ────────────────────────────────────────────────────────
echo "🚀 Iniciando TechStock Backend..."
cd /app/backend
PORT=3000 npm start &

# ── Manter container rodando ──────────────────────────────────────────────
echo "✅ TechStock Stack iniciada com sucesso!"
echo ""
echo "📋 Serviços disponíveis:"
echo "  📦 TechStock API:    http://localhost:3001"
echo "  📊 Prometheus:       http://localhost:9091"
echo "  📈 Grafana:          http://localhost:3031"
echo "  💻 Node Exporter:    http://localhost:9101"
echo "  🗄️  PostgreSQL:      http://localhost:5432"
echo ""
echo "🔐 Grafana login: admin/admin"

# Aguardar todos os processos
wait