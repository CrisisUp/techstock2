"use strict";

/**
 * server.js — TechStock Backend API
 *
 * Versão refatorada com melhorias de segurança, validação, paginação e documentação
 *
 * Ordem de inicialização:
 * 1. dotenv carrega .env (contém TECHSTOCK_SECRET_NAME e AWS_REGION)
 * 2. loadSecrets() lê o secret do AWS Secrets Manager e popula process.env
 * 3. Pool PostgreSQL e demais configs usam process.env já populado
 * 4. Validação Joi para dados de entrada
 * 5. Sistema de paginação para movimentos
 * 6. Logging estruturado
 */

const dotenvResult = require("dotenv").config();
require("express-async-errors");

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const helmet = require("helmet");
const promClient = require("prom-client");
const path = require("path");
const os = require("os");
const Joi = require("joi");

// ── AWS Secrets Manager ───────────────────────────────────────────────────────
async function loadSecrets() {
  const secretName = process.env.TECHSTOCK_SECRET_NAME;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!secretName) {
    console.log(
      "[Secrets] TECHSTOCK_SECRET_NAME não definido — usando variáveis do ambiente",
    );
    return;
  }

  try {
    const {
      SecretsManagerClient,
      GetSecretValueCommand,
    } = require("@aws-sdk/client-secrets-manager");

    const client = new SecretsManagerClient({ region });
    const cmd = new GetSecretValueCommand({ SecretId: secretName });
    const resp = await client.send(cmd);
    const secret = JSON.parse(resp.SecretString);

    Object.entries(secret).forEach(([k, v]) => {
      process.env[k] = v;
    });
    console.log(
      `[Secrets] Carregado: ${secretName} (${Object.keys(secret).length} variáveis)`,
    );
  } catch (err) {
    console.warn(`[Secrets] Falha ao ler secret: ${err.message}`);
    console.warn("[Secrets] Usando variáveis do ambiente como fallback");
  }
}

// ── Schemas de Validação (Joi) ──────────────────────────────────────────────
const schemas = {
  // Validação de Produto
  produto: Joi.object({
    codigo: Joi.string()
      .pattern(/^[A-Z0-9-]{4,20}$/)
      .required()
      .messages({
        "string.pattern.base": "Código deve ter 4-20 caracteres alfanuméricos",
        "any.required": "Código é obrigatório",
      }),
    nome: Joi.string().min(2).max(100).required().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome não pode exceder 100 caracteres",
      "any.required": "Nome é obrigatório",
    }),
    descricao: Joi.string().max(500).allow(null, ""),
    categoria_id: Joi.number().integer().allow(null),
    unidade: Joi.string()
      .valid("un", "cx", "rolo", "kg", "lt", "m")
      .default("un"),
    quantidade: Joi.number().integer().min(0).max(999999).default(0).messages({
      "number.min": "Quantidade deve ser maior ou igual a 0",
      "number.max": "Quantidade não pode exceder 999.999",
    }),
    qtd_minima: Joi.number().integer().min(0).default(5),
    preco_custo: Joi.number().min(0).max(999999.99).default(0).messages({
      "number.min": "Preço deve ser maior ou igual a 0",
      "number.max": "Preço não pode exceder R$ 999.999,99",
    }),
    localizacao: Joi.string().max(50).allow(null, ""),
  }),

  // Validação de Movimento
  movimento: Joi.object({
    produto_id: Joi.number().integer().required().messages({
      "any.required": "Produto é obrigatório",
    }),
    tipo: Joi.string().valid("entrada", "saida", "ajuste").required().messages({
      "any.only": "Tipo deve ser entrada, saida ou ajuste",
      "any.required": "Tipo é obrigatório",
    }),
    quantidade: Joi.number().integer().min(1).max(999999).required().messages({
      "number.min": "Quantidade deve ser maior que 0",
      "number.max": "Quantidade não pode exceder 999.999",
      "any.required": "Quantidade é obrigatória",
    }),
    motivo: Joi.string().max(200).allow(null, ""),
    responsavel: Joi.string().max(50).default("web"),
  }),

  // Validação de Categoria
  categoria: Joi.object({
    nome: Joi.string().min(2).max(50).required().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome não pode exceder 50 caracteres",
      "any.required": "Nome é obrigatório",
    }),
    cor: Joi.string()
      .pattern(/^#[0-9a-fA-F]{6}$/)
      .default("#6366f1"),
  }),

  // Validação de Paginação
  paginacao: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),
};

// ── Middleware de Validação ──────────────────────────────────────────────────
function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: "Validação falhou",
        details: error.details.map((d) => d.message),
      });
    }

    req[property] = value;
    next();
  };
}

// ── Bootstrap assíncrono ──────────────────────────────────────────────────────
async function bootstrap() {
  // 1. Carrega secrets antes de qualquer uso de process.env
  await loadSecrets();

  const app = express();
  const port = process.env.PORT || 3000;

  // ── Pool PostgreSQL ─────────────────────────────────────────────────────────
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "techstock",
    user: process.env.DB_USER || "techstock_user",
    password: process.env.DB_PASSWORD || "",
    min: Number(process.env.DB_POOL_MIN) || 1,
    max: Number(process.env.DB_POOL_MAX) || 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  pool.on("error", (err) => console.error("[Pool error]", err.message));

  // Testar a conexão com o banco antes de prosseguir
  await pool.query("SELECT NOW()");
  console.log(
    "[Database] Conexão com o PostgreSQL/RDS estabelecida com sucesso.",
  );

  // Helper para queries usando conexões limpas do pool
  async function q(sql, params = []) {
    const client = await pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  // ── Prometheus ──────────────────────────────────────────────────────────────
  promClient.collectDefaultMetrics({ prefix: "techstock_" });
  const httpRequests = new promClient.Counter({
    name: "techstock_http_requests_total",
    help: "Total de requisições HTTP",
    labelNames: ["method", "path", "status"],
  });

  const httpDuration = new promClient.Histogram({
    name: "techstock_http_request_duration_seconds",
    help: "Duração das requisições HTTP em segundos",
    labelNames: ["method", "path"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.CORS_ORIGIN || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, cb) => {
        // Permitir requisições sem origin (ex: mobile apps, ferramentas)
        if (!origin) return cb(null, true);

        // Verificar se origin é permitida
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }

        // Log para debug
        console.warn(`[CORS] Bloqueada origem: ${origin}`);
        cb(new Error(`CORS: origem bloqueada — ${origin}`));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-api-key"],
      exposedHeaders: ["x-total-count", "x-pagination"],
      credentials: true,
      maxAge: 86400, // 24 horas
    }),
  );

  // ── Segurança ───────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── API Key (obrigatória em produção) ──────────────────────────────────────
  app.use((req, res, next) => {
    const key = process.env.API_KEY;
    // Se API_KEY não estiver configurada, pula validação (desenvolvimento)
    if (!key) return next();

    // Endpoints públicos (health, metrics)
    if (req.path === "/api/health" || req.path === "/metrics") return next();

    const apiKey = req.headers["x-api-key"];
    if (apiKey !== key) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "x-api-key inválida ou não fornecida",
      });
    }
    next();
  });

  // ── Logging e Métricas ─────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000;

      // Contador de requisições
      httpRequests.inc({
        method: req.method,
        path: req.path,
        status: res.statusCode,
      });

      // Histograma de duração
      httpDuration.observe({ method: req.method, path: req.path }, duration);

      // Log para requisições lentas (> 1s)
      if (duration > 1) {
        console.warn(
          `[SLOW] ${req.method} ${req.path} - ${duration.toFixed(2)}s`,
        );
      }
    });

    next();
  });

  // ── Middlewares básicos ─────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  // ── ROTAS ──────────────────────────────────────────────────────────────────

  // ── Métricas Prometheus ─────────────────────────────────────────────────────
  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });

  // ── Health Check ────────────────────────────────────────────────────────────
  app.get("/api/health", async (req, res) => {
    try {
      const { rows } = await q("SELECT NOW() AS ts, version() AS ver");
      res.json({
        ok: true,
        database: "connected",
        db: rows[0],
        cors_origin: req.headers.origin || "direct",
        hostname: os.hostname(),
        uptime_s: Math.floor(process.uptime()),
        env: process.env.NODE_ENV || "production",
        secret: process.env.TECHSTOCK_SECRET_NAME || "não configurado",
        api_key_required: !!process.env.API_KEY,
      });
    } catch (e) {
      res.status(503).json({
        ok: false,
        error: e.message,
        database: "disconnected",
      });
    }
  });

  // ── Categorias ──────────────────────────────────────────────────────────────
  app.get("/api/categorias", async (_req, res) => {
    const { rows } = await q("SELECT * FROM categorias ORDER BY nome");
    res.json(rows);
  });

  app.post("/api/categorias", validate(schemas.categoria), async (req, res) => {
    const { nome, cor } = req.body;

    // Verificar duplicata
    const { rows: existentes } = await q(
      "SELECT id FROM categorias WHERE nome ILIKE $1",
      [nome],
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        error: "Categoria já existe",
        message: `Uma categoria com o nome "${nome}" já está cadastrada`,
      });
    }

    const { rows } = await q(
      "INSERT INTO categorias (nome, cor) VALUES ($1, $2) RETURNING *",
      [nome, cor || "#6366f1"],
    );

    res.status(201).json(rows[0]);
  });

  // ── Produtos ────────────────────────────────────────────────────────────────
  app.get("/api/produtos", async (req, res) => {
    const { busca, categoria_id, alerta } = req.query;
    const params = [];
    const where = ["p.ativo = TRUE"];

    if (busca) {
      params.push(`%${busca}%`);
      where.push(
        `(p.nome ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`,
      );
    }
    if (categoria_id) {
      params.push(Number(categoria_id));
      where.push(`p.categoria_id = $${params.length}`);
    }
    if (alerta === "1") {
      where.push("p.quantidade <= p.qtd_minima");
    }

    const { rows } = await q(
      `
      SELECT p.*, c.nome AS categoria_nome, c.cor AS categoria_cor
      FROM   produtos p
      LEFT   JOIN categorias c ON c.id = p.categoria_id
      WHERE  ${where.join(" AND ")}
      ORDER  BY p.nome
      `,
      params,
    );
    res.json(rows);
  });

  app.post("/api/produtos", validate(schemas.produto), async (req, res) => {
    const {
      codigo,
      nome,
      descricao,
      categoria_id,
      unidade,
      quantidade,
      qtd_minima,
      preco_custo,
      localizacao,
    } = req.body;

    // Verificar código duplicado
    const { rows: existentes } = await q(
      "SELECT id FROM produtos WHERE codigo = $1 AND ativo = TRUE",
      [codigo],
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        error: "Código duplicado",
        message: `Já existe um produto com o código "${codigo}"`,
      });
    }

    const { rows } = await q(
      `INSERT INTO produtos
           (codigo, nome, descricao, categoria_id, unidade, 
            quantidade, qtd_minima, preco_custo, localizacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        codigo,
        nome,
        descricao || null,
        categoria_id || null,
        unidade || "un",
        quantidade || 0,
        qtd_minima || 5,
        preco_custo || 0,
        localizacao || null,
      ],
    );

    res.status(201).json(rows[0]);
  });

  app.put("/api/produtos/:id", validate(schemas.produto), async (req, res) => {
    const id = req.params.id;

    // NOTA: codigo e quantidade NÃO podem ser alterados via PUT
    // Use POST /api/movimentos para alterar quantidade
    // Use DELETE + POST para alterar código (reativar com novo código)

    const {
      nome,
      descricao,
      categoria_id,
      unidade,
      qtd_minima,
      preco_custo,
      localizacao,
    } = req.body;

    // Verificar se produto existe
    const {
      rows: [produto],
    } = await q("SELECT id FROM produtos WHERE id = $1 AND ativo = TRUE", [id]);

    if (!produto) {
      return res.status(404).json({
        error: "Produto não encontrado",
        message:
          "O produto que você tentou atualizar não existe ou está inativo",
      });
    }

    const { rows } = await q(
      `UPDATE produtos SET
           nome = $1,
           descricao = $2,
           categoria_id = $3,
           unidade = $4,
           qtd_minima = $5,
           preco_custo = $6,
           localizacao = $7,
           atualizado_em = NOW()
         WHERE id = $8 AND ativo = TRUE
         RETURNING *`,
      [
        nome,
        descricao || null,
        categoria_id || null,
        unidade || "un",
        qtd_minima || 5,
        preco_custo || 0,
        localizacao || null,
        id,
      ],
    );

    res.json(rows[0]);
  });

  app.delete("/api/produtos/:id", async (req, res) => {
    const id = req.params.id;

    // Verificar se produto existe
    const {
      rows: [produto],
    } = await q(
      "SELECT id, nome FROM produtos WHERE id = $1 AND ativo = TRUE",
      [id],
    );

    if (!produto) {
      return res.status(404).json({
        error: "Produto não encontrado",
        message:
          "O produto que você tentou remover não existe ou já está inativo",
      });
    }

    await q(
      "UPDATE produtos SET ativo = FALSE, atualizado_em = NOW() WHERE id = $1",
      [id],
    );

    res.json({
      ok: true,
      message: `Produto "${produto.nome}" inativado com sucesso`,
    });
  });

  // ── Movimentos ──────────────────────────────────────────────────────────────
  app.post("/api/movimentos", validate(schemas.movimento), async (req, res) => {
    const { produto_id, tipo, quantidade, motivo, responsavel } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Bloquear produto para evitar race conditions
      const {
        rows: [prod],
      } = await client.query(
        "SELECT id, quantidade, nome FROM produtos WHERE id = $1 AND ativo = TRUE FOR UPDATE",
        [produto_id],
      );

      if (!prod) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Produto não encontrado",
          message: "O produto selecionado não existe ou está inativo",
        });
      }

      let nova;
      const qtd = Number(quantidade);

      if (tipo === "entrada") {
        nova = prod.quantidade + qtd;
      } else if (tipo === "saida") {
        nova = prod.quantidade - qtd;
        if (nova < 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Estoque insuficiente",
            message: `Estoque atual: ${prod.quantidade}, tentativa de saída: ${qtd}`,
            estoque_atual: prod.quantidade,
            tentativa: qtd,
          });
        }
      } else {
        // ajuste
        nova = qtd;
      }

      // Atualizar estoque
      await client.query(
        "UPDATE produtos SET quantidade = $1, atualizado_em = NOW() WHERE id = $2",
        [nova, produto_id],
      );

      // Registrar movimento
      const {
        rows: [mov],
      } = await client.query(
        `INSERT INTO movimentos
             (produto_id, tipo, quantidade, quantidade_anterior, 
              quantidade_nova, motivo, responsavel)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
        [
          produto_id,
          tipo,
          qtd,
          prod.quantidade,
          nova,
          motivo || null,
          responsavel || "web",
        ],
      );

      await client.query("COMMIT");

      res.status(201).json({
        movimento: mov,
        quantidade_atual: nova,
        message: "Movimentação registrada com sucesso",
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });

  app.get("/api/movimentos/:produto_id", async (req, res) => {
    // Validar paginação
    const { error, value } = schemas.paginacao.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: "Parâmetros de paginação inválidos",
        details: error.details.map((d) => d.message),
      });
    }

    const { limit, offset } = value;
    const produtoId = req.params.produto_id;

    // Verificar se produto existe
    const {
      rows: [produto],
    } = await q(
      "SELECT id, nome FROM produtos WHERE id = $1 AND ativo = TRUE",
      [produtoId],
    );

    if (!produto) {
      return res.status(404).json({
        error: "Produto não encontrado",
        message: "O produto solicitado não existe ou está inativo",
      });
    }

    // Buscar movimentos com paginação
    const { rows } = await q(
      `SELECT m.*, p.nome AS produto_nome, p.codigo AS produto_codigo
       FROM   movimentos m
       JOIN   produtos p ON p.id = m.produto_id
       WHERE  m.produto_id = $1
       ORDER  BY m.criado_em DESC
       LIMIT  $2 OFFSET $3`,
      [produtoId, limit, offset],
    );

    // Contar total de movimentos
    const {
      rows: [count],
    } = await q(
      "SELECT COUNT(*) AS total FROM movimentos WHERE produto_id = $1",
      [produtoId],
    );

    const total = Number(count.total);

    // Headers de paginação
    res.set({
      "x-total-count": total,
      "x-pagination": JSON.stringify({
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      }),
    });

    res.json({
      data: rows,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
        has_next: offset + limit < total,
      },
    });
  });

  // ── Stats ───────────────────────────────────────────────────────────────────
  app.get("/api/stats", async (_req, res) => {
    const [total, alertas, valor, movHoje] = await Promise.all([
      q("SELECT COUNT(*) AS n FROM produtos WHERE ativo = TRUE"),
      q(
        "SELECT COUNT(*) AS n FROM produtos WHERE ativo = TRUE AND quantidade <= qtd_minima",
      ),
      q(
        "SELECT COALESCE(SUM(quantidade * preco_custo), 0) AS v FROM produtos WHERE ativo = TRUE",
      ),
      q(
        "SELECT COUNT(*) AS n FROM movimentos WHERE criado_em >= NOW() - INTERVAL '24 hours'",
      ),
    ]);

    res.json({
      total_produtos: Number(total.rows[0].n),
      alertas_estoque: Number(alertas.rows[0].n),
      valor_total: Number(valor.rows[0].v),
      movimentos_hoje: Number(movHoje.rows[0].n),
      timestamp: new Date().toISOString(),
    });
  });

  // ── Error handler ───────────────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // Log estruturado
    console.error({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      error: err.message,
      stack: err.stack,
      status: err.status || 500,
    });

    // Resposta amigável
    const status = err.status || 500;
    const message = status === 500 ? "Erro interno do servidor" : err.message;

    res.status(status).json({
      error: message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  });

  // ── Start ───────────────────────────────────────────────────────────────────
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🚀 TechStock Backend API                                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Porta:      http://0.0.0.0:${port}                          ║
║  Hostname:   ${os.hostname()}                                ║
║  Ambiente:   ${process.env.NODE_ENV || "development"}        ║
║  Database:   ${process.env.DB_HOST || "localhost"}           ║
║  CORS:       ${allowedOrigins.join(", ") || "*"}            ║
║  API Key:    ${process.env.API_KEY ? "✅ Configurada" : "⚠️ Não configurada"} ║
║  Secrets:    ${process.env.TECHSTOCK_SECRET_NAME || "⚠️ Não configurado"}     ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    if (dotenvResult.error) {
      console.warn(
        `[TechStock] dotenv: .env não encontrado — usando ambiente/systemd`,
      );
    } else {
      console.log("[TechStock] dotenv: .env carregado");
    }
  });

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n[TechStock] Recebido sinal ${signal}, encerrando...`);

    server.close(async () => {
      console.log("[TechStock] Servidor HTTP fechado");

      try {
        await pool.end();
        console.log("[TechStock] Pool de conexões fechado");
      } catch (err) {
        console.error("[TechStock] Erro ao fechar pool:", err);
      }

      console.log("[TechStock] Encerramento concluído");
      process.exit(0);
    });

    // Timeout de segurança
    setTimeout(() => {
      console.error("[TechStock] Timeout no encerramento, forçando saída");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGQUIT", () => shutdown("SIGQUIT"));

  // ── Unhandled Rejections ──────────────────────────────────────────────────
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[UnhandledRejection]", {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise,
    });
  });

  process.on("uncaughtException", (error) => {
    console.error("[UncaughtException]", {
      message: error.message,
      stack: error.stack,
    });
    // Não encerra o processo, apenas loga
  });

  return server;
}

// ── Inicia o servidor ─────────────────────────────────────────────────────────
bootstrap().catch((err) => {
  console.error("[FATAL] Falha na inicialização:", err.message);
  console.error(err.stack);
  process.exit(1);
});
