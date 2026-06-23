# 📦 TechStock - Sistema de Controle de Estoque

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Node.js](https://img.shields.io/badge/Node.js-20.x-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-blue) ![Docker](https://img.shields.io/badge/Docker-✓-2496ED) ![Grafana](https://img.shields.io/badge/Grafana-✓-F46800) ![Prometheus](https://img.shields.io/badge/Prometheus-✓-E6522C)

**Sistema completo de controle de estoque com monitoramento em tempo real, totalmente containerizado com Docker.**

---

## 🚀 Demonstração Rápida

```bash
# Clone o repositório
git clone https://github.com/CrisisUp/techstock2.git
cd techstock2

# Inicie o sistema
docker-compose up -d
```

Acesse:
Serviço URL Credenciais
API [http://localhost:3001](http://localhost:3001) -
Grafana [http://localhost:3031](http://localhost:3031) admin / admin
Prometheus [http://localhost:9091](http://localhost:9091) -
Node Exporter [http://localhost:9101](http://localhost:9101) -

✨ Funcionalidades
📊 Dashboard Principal
✅ Métricas em tempo real: Total de produtos, alertas, valor em estoque e movimentações

✅ Itens críticos: Visualize produtos com estoque baixo

✅ Atualização automática: Dados sempre atualizados

📦 Gestão de Produtos
✅ CRUD completo: Crie, edite, visualize e inative produtos

✅ Busca avançada: Por nome ou código

✅ Filtro por categoria: Organize seu estoque

✅ Controle de estoque: Quantidade, preço de custo e localização

🔄 Movimentações
✅ Entrada e saída: Registre movimentações de estoque

✅ Histórico completo: Visualize todas as movimentações

✅ Filtros: Por tipo e por produto

✅ Auditoria: Rastreie quem realizou cada movimentação

🔔 Alertas
✅ Estoque baixo: Visualize produtos abaixo do mínimo

✅ Ações rápidas: Reponha estoque com um clique

📈 Monitoramento (Grafana + Prometheus)
✅ Métricas HTTP: Requisições por segundo, erros 5xx

✅ Performance do Node.js: Heap, Event Loop Lag, Garbage Collection

✅ Infraestrutura: CPU, RAM, Disco das instâncias

✅ Banco de dados: Conexões ativas, taxa de sucesso, throughput

🛠️ Tecnologias Utilizadas
Backend
Tecnologia  Descrição
Node.js  Runtime JavaScript
Express  Framework web
PostgreSQL  Banco de dados relacional
Joi  Validação de dados
Prometheus Client  Métricas para monitoramento
Frontend
Tecnologia  Descrição
HTML5  Estrutura
CSS3  Estilização com variáveis CSS
JavaScript ES6+  Interatividade
ARIA  Acessibilidade
DevOps
Tecnologia  Descrição
Docker  Containerização
Docker Compose  Orquestração de serviços
Grafana  Dashboards
Prometheus  Coleta de métricas
Node Exporter  Métricas do sistema
📂 Estrutura do Projeto

```text
techstock/
├── backend/
│   ├── server.js           # API principal
│   ├── package.json        # Dependências
│   ├── schema.sql          # Schema do banco
│   └── .env.example        # Exemplo de variáveis
├── frontend/
│   ├── index.html          # Página principal
│   ├── app.js              # Lógica frontend
│   ├── config.js           # Configurações
│   └── style.css           # Estilos
├── docker/
│   ├── entrypoint.sh       # Script de inicialização
│   └── supervisord.conf    # Gerenciador de processos
├── prometheus/
│   └── prometheus.yml      # Configuração do Prometheus
├── grafana/
│   └── grafana.ini         # Configuração do Grafana
├── dashboards/             # Dashboards do Grafana
│   ├── dashboard_api.json
│   ├── dashboard_devops.json
│   ├── dashboard_infra.json
│   └── dashboard_rds.json
├── Dockerfile              # Imagem do container
├── docker-compose.yml      # Orquestração dos serviços
├── .gitignore              # Arquivos ignorados
└── README.md               # Documentação
```

🚀 Guia de Instalação
Pré-requisitos
Docker

Docker Compose

Git

Passo a Passo
1. Clone o repositório

```bash
git clone https://github.com/CrisisUp/techstock2.git
cd techstock2
```

1. Configure as variáveis de ambiente

```bash
cp backend/.env.example backend/.env
# Edite o arquivo se necessário
nano backend/.env
```

1. Inicie os containers

```bash
docker-compose up -d
```

1. Aguarde a inicialização
Os logs mostrarão quando todos os serviços estiverem prontos:

text
✅ TechStock Stack iniciada com sucesso!
📋 Serviços disponíveis:
  📦 TechStock API:    [http://localhost:3001](http://localhost:3001)
  📊 Prometheus:       [http://localhost:9091](http://localhost:9091)
  📈 Grafana:          [http://localhost:3031](http://localhost:3031)
5. Acesse o sistema
API: [http://localhost:3001](http://localhost:3001)

Frontend: Abra frontend/index.html ou sirva com Live Server

🌐 Portas dos Serviços

Serviço | Porta | Descrição
--------- | ------- | ----------
TechStock API | 3001 | API do sistema
PostgreSQL | 5432 | Banco de dados
Prometheus | 9091 | Coleta de métricas
Grafana | 3031 | Dashboards
Node Exporter | 9101 | Métricas do sistema

📊 Dashboards

1. TechStock API - Visão Geral

Métricas da aplicação:

- Requisições por segundo
- Taxa de erros 5xx
- Heap Node.js usado
- Event Loop Lag p99
- Rotas mais acessadas

2. DevOps - Containers

Saúde dos containers:

- Status da API e exportadores
- Uptime e restarts
- Métricas de recursos

3. Infraestrutura EC2

Métricas do sistema:

CPU por instância

RAM disponível

Disco usado

Tráfego de rede

4. Observabilidade
Saúde do Prometheus:

Séries temporais ativas

Taxa de ingestão

Targets UP

Tamanho TSDB

5. RDS - PostgreSQL
Métricas do banco:

Conexões ativas

Throughput total

Erros de banco

🔧 Desenvolvimento
Backend (modo local)
bash
cd backend
npm install
npm run dev
Frontend (modo local)
bash
cd frontend

### Use Live Server no VS Code

#### Ou sirva com Python

python -m http.server 5500
Build da imagem Docker
bash
docker build -t techstock:latest .
📚 API Endpoints
Produtos
Método Endpoint Descrição
GET /api/produtos Lista produtos
GET /api/produtos?alerta=1 Lista produtos com alerta
GET /api/produtos?busca=nome Busca produtos
POST /api/produtos Cria produto
PUT /api/produtos/:id Atualiza produto
DELETE /api/produtos/:id Inativa produto
Movimentações
Método Endpoint Descrição
GET /api/movimentos/:produto_id Histórico do produto
POST /api/movimentos Registra movimentação
Categorias
Método Endpoint Descrição
GET /api/categorias Lista categorias
POST /api/categorias Cria categoria
Estatísticas
Método Endpoint Descrição
GET /api/stats Métricas do sistema
GET /api/health Health check
🔐 Segurança
Autenticação
API Key: Configurável via .env

Grafana: Admin padrão (admin/admin)

Banco de Dados
SSL: Suportado para RDS

Pool: Conexões gerenciadas

Validação: Dados validados com Joi

📝 Variáveis de Ambiente
Variável  Padrão  Descrição
PORT      3000    Porta da API
DB_HOST   localhost Host do PostgreSQL
DB_PORT   5432     Porta do PostgreSQL
DB_NAME   techstock Nome do banco
DB_USER   postgres  Usuário do banco
DB_PASSWORD postgres Senha do banco
CORS_ORIGIN *        Origens permitidas
API_KEY   ""       Chave da API
🐳 Comandos Docker

```bash
# Ver todos os containers rodando
docker ps

# Ver logs do TechStock
docker logs -f techstock

# Ver logs de todos os serviços
docker-compose logs -f

# Parar todos os serviços
docker-compose down

# Subir novamente
docker-compose up -d

# Reiniciar um serviço específico
docker-compose restart techstock

# Acessar o container
docker exec -it techstock /bin/bash
```

🤝 Contribuição
Fork o projeto

Crie sua branch (git checkout -b feature/nova-funcionalidade)

Commit suas alterações (git commit -am 'Adiciona nova funcionalidade')

Push para a branch (git push origin feature/nova-funcionalidade)

Abra um Pull Request

📄 Licença
Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

👥 Autor
Cristiano - CrisisUp

🙏 Agradecimentos
Express

PostgreSQL

Prometheus

Grafana

Docker

<p align="center"> <strong>⭐ Se este projeto te ajudou, considere dar uma estrela no GitHub!</strong> </p><p align="center"> <em>Feito com ❤️ para controle de estoque eficiente.</em> </p> ```
🚀 ADICIONAR AO GIT
bash
# Salvar o README
cat > README.md << 'EOF'
[cole o conteúdo acima]
EOF

# Adicionar ao git
git add README.md
git commit -m "📝 Adiciona README.md completo e bonitão"
git push origin main
