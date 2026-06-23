# ══════════════════════════════════════════════════════════════════════════════
# Dockerfile para TechStock (Sem PostgreSQL interno)
# ══════════════════════════════════════════════════════════════════════════════

# ── ESTÁGIO 1: Build do Backend ──────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .

# ── ESTÁGIO 2: Build do Frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY frontend/ .

# ── ESTÁGIO 3: Imagem Final ──────────────────────────────────────────────────
FROM alpine:3.20

# ── Criar usuário node antes de instalar pacotes ──────────────────────────
RUN addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/sh -D node

# ── Instalar dependências do sistema ──────────────────────────────────────
RUN apk add --no-cache \
    nodejs \
    npm \
    bash \
    curl \
    jq \
    tini \
    supervisor \
    wget \
    tar

# ── Instalar Node Exporter ──────────────────────────────────────────────────
RUN wget https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-arm64.tar.gz -O /tmp/node_exporter.tar.gz && \
    tar -xzf /tmp/node_exporter.tar.gz -C /opt && \
    mv /opt/node_exporter-1.8.2.linux-arm64 /opt/node_exporter && \
    rm /tmp/node_exporter.tar.gz && \
    mkdir -p /var/lib/node_exporter && \
    chown -R node:node /opt/node_exporter /var/lib/node_exporter

# ── Instalar Prometheus ───────────────────────────────────────────────────────
RUN wget https://github.com/prometheus/prometheus/releases/download/v2.54.0/prometheus-2.54.0.linux-arm64.tar.gz -O /tmp/prometheus.tar.gz && \
    tar -xzf /tmp/prometheus.tar.gz -C /opt && \
    mv /opt/prometheus-2.54.0.linux-arm64 /opt/prometheus && \
    rm /tmp/prometheus.tar.gz && \
    mkdir -p /var/lib/prometheus && \
    chown -R node:node /opt/prometheus /var/lib/prometheus

# ── Instalar Grafana ──────────────────────────────────────────────────────────
RUN wget https://dl.grafana.com/oss/release/grafana-11.3.0.linux-arm64.tar.gz -O /tmp/grafana.tar.gz && \
    tar -xzf /tmp/grafana.tar.gz -C /opt && \
    mv /opt/grafana-v11.3.0 /opt/grafana && \
    rm /tmp/grafana.tar.gz && \
    mkdir -p /var/lib/grafana && \
    chown -R node:node /opt/grafana /var/lib/grafana

# ── Copiar aplicação ─────────────────────────────────────────────────────────
WORKDIR /app
COPY --from=backend-builder /app /app/backend
COPY --from=backend-builder /app/node_modules /app/backend/node_modules
COPY --from=frontend-builder /app /app/frontend

# ── Copiar scripts ──────────────────────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Configurar Prometheus ────────────────────────────────────────────────────
COPY prometheus/prometheus.yml /opt/prometheus/prometheus.yml

# ── Configurar Grafana ──────────────────────────────────────────────────────
COPY grafana/grafana.ini /opt/grafana/conf/custom.ini

# ── Criar arquivo .env ──────────────────────────────────────────────────────
RUN echo 'PORT=3000\n\
    NODE_ENV=production\n\
    DB_HOST=postgres\n\
    DB_PORT=5432\n\
    DB_NAME=techstock\n\
    DB_USER=postgres\n\
    DB_PASSWORD=postgres\n\
    DB_SSL=false\n\
    CORS_ORIGIN=*\n\
    API_KEY=' > /app/backend/.env && \
    chown node:node /app/backend/.env

# ── Configurar permissões ────────────────────────────────────────────────────
RUN chmod +x /entrypoint.sh && \
    chown -R node:node /app && \
    chown -R node:node /var/lib/grafana && \
    chown -R node:node /var/lib/prometheus && \
    chown -R node:node /opt/prometheus && \
    chown -R node:node /opt/grafana && \
    chown -R node:node /opt/node_exporter

# ── Criar diretórios de log ──────────────────────────────────────────────────
RUN mkdir -p /var/log && \
    chown node:node /var/log

# ── Portas EXPOSE ─────────────────────────────────────────────────────────────
EXPOSE 3000 9090 3030 9100

# ── Trocar para usuário node ─────────────────────────────────────────────────
USER node

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]