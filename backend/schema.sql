-- ══════════════════════════════════════════════════════════════════════════════
-- TechStock — Schema PostgreSQL
-- Versão refatorada com melhorias de consistência, auditoria e performance
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Como executar:
--   psql -h <RDS_HOST> -U techstock_user -d techstock -f schema.sql
--
-- Ou via Docker:
--   docker exec -i <container_id> psql -U techstock_user -d techstock < schema.sql
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- EXTENSÕES
-- ══════════════════════════════════════════════════════════════════════════════

-- UUID generation (para futuros IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Busca textual otimizada (trigram)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Criptografia (para dados sensíveis)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELAS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Categorias ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(50)  NOT NULL UNIQUE,
  cor         VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Validações
  CONSTRAINT chk_cor_format CHECK (cor ~ '^#[0-9a-fA-F]{6}$')
);

COMMENT ON TABLE categorias IS 'Categorias de produtos para organização do estoque';
COMMENT ON COLUMN categorias.id IS 'Identificador único da categoria';
COMMENT ON COLUMN categorias.nome IS 'Nome da categoria (ex: Informática, Elétrico)';
COMMENT ON COLUMN categorias.cor IS 'Cor em hexadecimal para identificação visual (#RRGGBB)';
COMMENT ON COLUMN categorias.criado_em IS 'Data de criação do registro';
COMMENT ON COLUMN categorias.atualizado_em IS 'Data da última atualização do registro';

-- ── Produtos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20)   NOT NULL UNIQUE,
  nome            VARCHAR(100)  NOT NULL,
  descricao       TEXT,
  categoria_id    INT           REFERENCES categorias(id) ON DELETE SET NULL,
  unidade         VARCHAR(20)   NOT NULL DEFAULT 'un',
  quantidade      INT           NOT NULL DEFAULT 0,
  qtd_minima      INT           NOT NULL DEFAULT 5,
  preco_custo     NUMERIC(10,2) NOT NULL DEFAULT 0,
  localizacao     VARCHAR(60),
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  
  -- Validações
  CONSTRAINT chk_quantidade_positiva CHECK (quantidade >= 0),
  CONSTRAINT chk_qtd_minima_positiva CHECK (qtd_minima >= 0),
  CONSTRAINT chk_preco_positivo CHECK (preco_custo >= 0),
  CONSTRAINT chk_codigo_format CHECK (codigo ~ '^[A-Z0-9-]{4,20}$'),
  CONSTRAINT chk_unidade_valida CHECK (unidade IN ('un', 'cx', 'rolo', 'kg', 'lt', 'm'))
);

COMMENT ON TABLE produtos IS 'Catálogo de produtos com controle de estoque';
COMMENT ON COLUMN produtos.id IS 'Identificador único do produto';
COMMENT ON COLUMN produtos.codigo IS 'Código único do produto (formato: PREFIXO-XXX)';
COMMENT ON COLUMN produtos.nome IS 'Nome do produto';
COMMENT ON COLUMN produtos.descricao IS 'Descrição detalhada do produto';
COMMENT ON COLUMN produtos.categoria_id IS 'Referência à categoria do produto';
COMMENT ON COLUMN produtos.unidade IS 'Unidade de medida (un, cx, rolo, kg, lt, m)';
COMMENT ON COLUMN produtos.quantidade IS 'Quantidade atual em estoque';
COMMENT ON COLUMN produtos.qtd_minima IS 'Quantidade mínima para alerta de estoque';
COMMENT ON COLUMN produtos.preco_custo IS 'Preço de custo do produto (R$)';
COMMENT ON COLUMN produtos.localizacao IS 'Localização física do produto (ex: A1-01)';
COMMENT ON COLUMN produtos.ativo IS 'Indica se o produto está ativo (TRUE) ou inativo (FALSE)';
COMMENT ON COLUMN produtos.criado_em IS 'Data de criação do registro';
COMMENT ON COLUMN produtos.atualizado_em IS 'Data da última atualização do registro';

-- ── Movimentos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimentos (
  id                  SERIAL PRIMARY KEY,
  produto_id          INT           NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tipo                VARCHAR(10)   NOT NULL,
  quantidade          INT           NOT NULL,
  quantidade_anterior INT           NOT NULL,
  quantidade_nova     INT           NOT NULL,
  motivo              VARCHAR(200),
  responsavel         VARCHAR(80)   NOT NULL DEFAULT 'sistema',
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  
  -- Validações
  CONSTRAINT chk_tipo_valido CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  CONSTRAINT chk_quantidade_positiva CHECK (quantidade > 0),
  CONSTRAINT chk_quantidade_anterior_positiva CHECK (quantidade_anterior >= 0),
  CONSTRAINT chk_quantidade_nova_positiva CHECK (quantidade_nova >= 0)
);

COMMENT ON TABLE movimentos IS 'Histórico de movimentações de estoque';
COMMENT ON COLUMN movimentos.id IS 'Identificador único do movimento';
COMMENT ON COLUMN movimentos.produto_id IS 'Referência ao produto movimentado';
COMMENT ON COLUMN movimentos.tipo IS 'Tipo de movimentação (entrada, saida, ajuste)';
COMMENT ON COLUMN movimentos.quantidade IS 'Quantidade movimentada';
COMMENT ON COLUMN movimentos.quantidade_anterior IS 'Quantidade antes da movimentação';
COMMENT ON COLUMN movimentos.quantidade_nova IS 'Quantidade após a movimentação';
COMMENT ON COLUMN movimentos.motivo IS 'Motivo da movimentação (opcional)';
COMMENT ON COLUMN movimentos.responsavel IS 'Responsável pela movimentação';
COMMENT ON COLUMN movimentos.criado_em IS 'Data e hora da movimentação';

-- ── Auditoria ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  table_name  VARCHAR(50)   NOT NULL,
  record_id   INT           NOT NULL,
  action      VARCHAR(10)   NOT NULL,
  old_data    JSONB,
  new_data    JSONB,
  usuario     VARCHAR(80)   NOT NULL DEFAULT 'sistema',
  ip_address  INET,
  user_agent  TEXT,
  criado_em   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  
  -- Validações
  CONSTRAINT chk_action_valida CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

COMMENT ON TABLE audit_log IS 'Auditoria de alterações no sistema';
COMMENT ON COLUMN audit_log.table_name IS 'Nome da tabela auditada';
COMMENT ON COLUMN audit_log.record_id IS 'ID do registro alterado';
COMMENT ON COLUMN audit_log.action IS 'Tipo de operação (INSERT, UPDATE, DELETE)';
COMMENT ON COLUMN audit_log.old_data IS 'Dados anteriores (formato JSON)';
COMMENT ON COLUMN audit_log.new_data IS 'Dados novos (formato JSON)';
COMMENT ON COLUMN audit_log.usuario IS 'Usuário que realizou a operação';
COMMENT ON COLUMN audit_log.ip_address IS 'Endereço IP do usuário';
COMMENT ON COLUMN audit_log.user_agent IS 'User-Agent do navegador/cliente';
COMMENT ON COLUMN audit_log.criado_em IS 'Data e hora da operação';

-- ══════════════════════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Categorias ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON categorias(nome);

-- ── Produtos ──────────────────────────────────────────────────────────────────
-- Busca por categoria
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id) 
  WHERE ativo = TRUE;

-- Busca por nome (trigram para ILIKE)
CREATE INDEX IF NOT EXISTS idx_produtos_nome_trgm ON produtos 
  USING gin (nome gin_trgm_ops);

-- Busca por código (trigram para ILIKE)
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_trgm ON produtos 
  USING gin (codigo gin_trgm_ops);

-- Busca por quantidade (para alertas)
CREATE INDEX IF NOT EXISTS idx_produtos_quantidade ON produtos(quantidade) 
  WHERE ativo = TRUE;

-- Busca por alerta de estoque
CREATE INDEX IF NOT EXISTS idx_produtos_alerta ON produtos(quantidade, qtd_minima) 
  WHERE ativo = TRUE;

-- Busca por localização
CREATE INDEX IF NOT EXISTS idx_produtos_localizacao ON produtos(localizacao) 
  WHERE ativo = TRUE;

-- ── Movimentos ─────────────────────────────────────────────────────────────────
-- Histórico por produto (ordem decrescente)
CREATE INDEX IF NOT EXISTS idx_movimentos_produto_data ON movimentos(produto_id, criado_em DESC);

-- Busca por data
CREATE INDEX IF NOT EXISTS idx_movimentos_data ON movimentos(criado_em DESC);

-- Busca por tipo
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo ON movimentos(tipo);

-- ── Auditoria ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_data ON audit_log(criado_em DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNÇÕES E TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Atualização automática de timestamp ──────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger: Produtos ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_produtos_updated ON produtos;
CREATE TRIGGER trg_produtos_updated
  BEFORE UPDATE ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- ── Trigger: Categorias ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_categorias_updated ON categorias;
CREATE TRIGGER trg_categorias_updated
  BEFORE UPDATE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- ── Auditoria: Produtos ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_produtos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, usuario)
    VALUES ('produtos', OLD.id, 'DELETE', row_to_json(OLD), current_user);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, usuario)
    VALUES ('produtos', NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_user);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, usuario)
    VALUES ('produtos', NEW.id, 'INSERT', row_to_json(NEW), current_user);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_produtos_trigger ON produtos;
CREATE TRIGGER audit_produtos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION audit_produtos();

-- ── Auditoria: Categorias ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_categorias()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, usuario)
    VALUES ('categorias', OLD.id, 'DELETE', row_to_json(OLD), current_user);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, usuario)
    VALUES ('categorias', NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_user);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, usuario)
    VALUES ('categorias', NEW.id, 'INSERT', row_to_json(NEW), current_user);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_categorias_trigger ON categorias;
CREATE TRIGGER audit_categorias_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION audit_categorias();

-- ══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Resumo de Produtos ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_resumo_produtos AS
SELECT 
  p.id,
  p.codigo,
  p.nome,
  p.descricao,
  p.quantidade,
  p.qtd_minima,
  p.preco_custo,
  ROUND((p.quantidade * p.preco_custo)::NUMERIC, 2) AS valor_estoque,
  c.nome AS categoria,
  c.cor AS categoria_cor,
  p.localizacao,
  p.unidade,
  p.ativo,
  CASE 
    WHEN p.quantidade <= 0 THEN 'ZERADO'
    WHEN p.quantidade <= p.qtd_minima THEN 'CRITICO'
    WHEN p.quantidade <= p.qtd_minima * 2 THEN 'ATENCAO'
    ELSE 'OK'
  END AS status_estoque,
  p.criado_em,
  p.atualizado_em
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id;

COMMENT ON VIEW vw_resumo_produtos IS 'Visão consolidada de produtos com status de estoque';

-- ── Movimentos por Produto ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_movimentos_produto AS
SELECT 
  m.id,
  p.id AS produto_id,
  p.codigo AS produto_codigo,
  p.nome AS produto_nome,
  m.tipo,
  m.quantidade,
  m.quantidade_anterior,
  m.quantidade_nova,
  m.motivo,
  m.responsavel,
  m.criado_em,
  DATE(m.criado_em) AS data_movimento,
  EXTRACT(HOUR FROM m.criado_em) AS hora_movimento,
  CASE 
    WHEN m.tipo = 'entrada' THEN '📥'
    WHEN m.tipo = 'saida' THEN '📤'
    WHEN m.tipo = 'ajuste' THEN '⚖️'
  END AS icone
FROM movimentos m
JOIN produtos p ON p.id = m.produto_id
ORDER BY m.criado_em DESC;

COMMENT ON VIEW vw_movimentos_produto IS 'Histórico de movimentos com informações do produto';

-- ── Estatísticas Diárias ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_estatisticas_diarias AS
WITH data_atual AS (
  SELECT NOW() AS hoje
)
SELECT 
  DATE(m.criado_em) AS data,
  COUNT(*) AS total_movimentos,
  COUNT(CASE WHEN m.tipo = 'entrada' THEN 1 END) AS entradas,
  COUNT(CASE WHEN m.tipo = 'saida' THEN 1 END) AS saidas,
  COUNT(CASE WHEN m.tipo = 'ajuste' THEN 1 END) AS ajustes,
  COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE 0 END), 0) AS total_entradas,
  COALESCE(SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE 0 END), 0) AS total_saidas,
  COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END), 0) AS saldo_dia
FROM movimentos m
WHERE DATE(m.criado_em) >= DATE(NOW() - INTERVAL '30 days')
GROUP BY DATE(m.criado_em)
ORDER BY data DESC;

COMMENT ON VIEW vw_estatisticas_diarias IS 'Estatísticas diárias de movimentações dos últimos 30 dias';

-- ── Produtos com Movimentação Recente ──────────────────────────────────────
CREATE OR REPLACE VIEW vw_produtos_movimentados AS
SELECT DISTINCT ON (p.id)
  p.id,
  p.codigo,
  p.nome,
  p.quantidade,
  p.qtd_minima,
  m.criado_em AS ultima_movimentacao,
  m.tipo AS ultimo_tipo,
  m.quantidade AS ultima_quantidade,
  m.responsavel AS ultimo_responsavel
FROM produtos p
LEFT JOIN movimentos m ON m.produto_id = p.id
WHERE p.ativo = TRUE
ORDER BY p.id, m.criado_em DESC;

COMMENT ON VIEW vw_produtos_movimentados IS 'Produtos com data da última movimentação';

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNÇÕES DE BUSCA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Busca Textual de Produtos ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_products(
  search_term TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  codigo VARCHAR(20),
  nome VARCHAR(100),
  descricao TEXT,
  categoria VARCHAR(50),
  localizacao VARCHAR(60),
  quantidade INT,
  qtd_minima INT,
  preco_custo NUMERIC(10,2),
  relevance FLOAT,
  total_count BIGINT
) AS $$
DECLARE
  clean_term TEXT := TRIM(search_term);
  total BIGINT;
BEGIN
  -- Se a busca for vazia, retorna todos os produtos
  IF clean_term = '' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.codigo,
      p.nome,
      p.descricao,
      c.nome AS categoria,
      p.localizacao,
      p.quantidade,
      p.qtd_minima,
      p.preco_custo,
      1.0 AS relevance,
      COUNT(*) OVER() AS total_count
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = TRUE
    ORDER BY p.nome
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  -- Busca com relevância
  RETURN QUERY
  SELECT 
    p.id,
    p.codigo,
    p.nome,
    p.descricao,
    c.nome AS categoria,
    p.localizacao,
    p.quantidade,
    p.qtd_minima,
    p.preco_custo,
    GREATEST(
      COALESCE(similarity(p.nome, clean_term), 0),
      COALESCE(similarity(p.codigo, clean_term), 0),
      COALESCE(similarity(p.descricao, clean_term), 0)
    ) AS relevance,
    COUNT(*) OVER() AS total_count
  FROM produtos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
  WHERE p.ativo = TRUE
    AND (
      p.nome ILIKE '%' || clean_term || '%'
      OR p.codigo ILIKE '%' || clean_term || '%'
      OR p.descricao ILIKE '%' || clean_term || '%'
    )
  ORDER BY relevance DESC, p.nome
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_products IS 'Busca textual de produtos com relevância e paginação';

-- ══════════════════════════════════════════════════════════════════════════════
-- SEEDS - Dados Iniciais
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Categorias ─────────────────────────────────────────────────────────────────
INSERT INTO categorias (nome, cor) VALUES
  ('Informática', '#6366f1'),
  ('Elétrico',    '#f59e0b'),
  ('Escritório',  '#10b981'),
  ('Ferramentas', '#ef4444'),
  ('Limpeza',     '#06b6d4'),
  ('Segurança',   '#8b5cf6'),
  ('Moveis',      '#ec4899')
ON CONFLICT (nome) DO NOTHING;

-- ── Produtos ──────────────────────────────────────────────────────────────────
INSERT INTO produtos (codigo, nome, descricao, categoria_id, unidade, quantidade, qtd_minima, preco_custo, localizacao) VALUES
  ('TI-001', 'Cabo USB-C 1m',       'Cabo de dados e carga USB-C compatível com todos os dispositivos',         1, 'un',  25, 10, 12.50, 'A1-01'),
  ('TI-002', 'Mouse sem fio',        'Mouse wireless 2.4GHz com receptor USB',                                 1, 'un',   8,  5, 45.00, 'A1-02'),
  ('TI-003', 'Teclado ABNT2',        'Teclado USB padrão ABNT2 com layout brasileiro',                         1, 'un',   3,  5, 89.00, 'A1-03'),
  ('TI-004', 'HD Externo 1TB',       'HD externo portátil USB 3.0 1TB',                                         1, 'un',  12,  5, 299.90, 'A1-04'),
  ('TI-005', 'Monitor 24"',          'Monitor LED Full HD 24 polegadas',                                        1, 'un',   6,  3, 899.00, 'A1-05'),
  ('EL-001', 'Tomada 3 pinos',       'Tomada de embutir 10A com terra',                                         2, 'un',  50, 20,  4.80, 'B2-01'),
  ('EL-002', 'Fita LED 5m',          'Fita LED branca 5050 com 5 metros',                                       2, 'rolo', 12,  5, 28.00, 'B2-02'),
  ('EL-003', 'Disjuntor 20A',        'Disjuntor monopolar 20A',                                                 2, 'un',  30, 10, 15.50, 'B2-03'),
  ('EL-004', 'Extensão 3m',          'Extensão elétrica com 3 tomadas e 3 metros',                              2, 'un',  18, 10, 22.00, 'B2-04'),
  ('ES-001', 'Papel A4 500fls',      'Resma de papel sulfite A4 75g',                                            3, 'cx',  40, 15, 22.00, 'C1-01'),
  ('ES-002', 'Caneta azul cx50',     'Caixa com 50 canetas esferográficas azuis',                               3, 'cx',   7, 10, 18.50, 'C1-02'),
  ('ES-003', 'Caderno 100fls',       'Caderno universitário 100 folhas',                                        3, 'un',  25, 10, 12.00, 'C1-03'),
  ('ES-004', 'Grampeador',           'Grampeador de mesa capacidade 20 folhas',                                 3, 'un',  15,  5, 35.00, 'C1-04'),
  ('FE-001', 'Chave Phillips #2',    'Chave de fenda Phillips tamanho #2',                                      4, 'un',  15,  5,  8.90, 'D1-01'),
  ('FE-002', 'Alicate Universal',     'Alicate universal 8" com cabo isolado',                                   4, 'un',  10,  5, 25.00, 'D1-02'),
  ('FE-003', 'Furadeira 650W',       'Furadeira elétrica 650W com mandril 13mm',                                4, 'un',   4,  2, 189.00, 'D1-03'),
  ('FE-004', 'Parafuso M4x20',       'Parafuso M4x20 com porca e arruela (caixa 100)',                          4, 'cx',  20, 10, 15.00, 'D1-04'),
  ('LI-001', 'Álcool 70% 1L',       'Álcool isopropílico 70% 1 litro',                                           5, 'un',  20, 10,  9.50, 'E1-01'),
  ('LI-002', 'Papel toalha cx',      'Caixa com 1000 folhas de papel toalha',                                   5, 'cx',   4, 10, 34.00, 'E1-02'),
  ('LI-003', 'Detergente 5L',        'Detergente líquido neutro 5 litros',                                      5, 'un',  15,  5, 18.00, 'E1-03'),
  ('LI-004', 'Saco de lixo 50L',     'Saco de lixo preto 50 litros (pacote 100)',                               5, 'cx',  30, 10, 25.00, 'E1-04'),
  ('SG-001', 'Câmera IP',           'Câmera de segurança IP Full HD com visão noturna',                         6, 'un',   8,  3, 350.00, 'F1-01'),
  ('SG-002', 'Alarme movimento',     'Sensor de movimento para alarme residencial',                             6, 'un',  12,  5, 45.00, 'F1-02'),
  ('MV-001', 'Mesa escritório',      'Mesa de escritório 120x60cm com estrutura metálica',                      7, 'un',   5,  2, 450.00, 'G1-01'),
  ('MV-002', 'Cadeira giratória',    'Cadeira giratória com regulagem de altura',                               7, 'un',   3,  2, 299.00, 'G1-02')
ON CONFLICT (codigo) DO NOTHING;

-- ── Movimentos Iniciais (Histórico) ──────────────────────────────────────────
INSERT INTO movimentos (produto_id, tipo, quantidade, quantidade_anterior, quantidade_nova, motivo, responsavel) 
SELECT 
  p.id,
  'entrada',
  p.quantidade,
  0,
  p.quantidade,
  'Estoque inicial',
  'sistema'
FROM produtos p
WHERE p.quantidade > 0
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- VALIDAÇÕES FINAIS
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  table_count INT;
BEGIN
  -- Verifica se todas as tabelas foram criadas
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('categorias', 'produtos', 'movimentos', 'audit_log');
  
  IF table_count < 4 THEN
    RAISE NOTICE '⚠️ Alerta: Nem todas as tabelas foram criadas!';
  ELSE
    RAISE NOTICE '✅ Todas as tabelas foram criadas com sucesso!';
  END IF;
  
  -- Verifica se os índices foram criados
  PERFORM 1 FROM pg_indexes WHERE indexname = 'idx_produtos_nome_trgm';
  IF NOT FOUND THEN
    RAISE NOTICE '⚠️ Alerta: Índices de busca textual podem não ter sido criados!';
  END IF;
  
  -- Verifica se as views foram criadas
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.views 
  WHERE table_schema = 'public' 
    AND table_name IN ('vw_resumo_produtos', 'vw_movimentos_produto', 'vw_estatisticas_diarias');
  
  IF table_count < 3 THEN
    RAISE NOTICE '⚠️ Alerta: Nem todas as views foram criadas!';
  END IF;
  
  RAISE NOTICE '✅ Schema inicializado com sucesso!';
  RAISE NOTICE '📊 Total de produtos: %', (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE);
  RAISE NOTICE '📊 Total de categorias: %', (SELECT COUNT(*) FROM categorias);
  RAISE NOTICE '📊 Total de movimentos: %', (SELECT COUNT(*) FROM movimentos);
END $$;