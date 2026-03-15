# RAG com Neo4j + LangChain + OpenRouter

Sistema de **Retrieval-Augmented Generation (RAG)** com interface web para perguntas dinâmicas sobre Microservices e Design Patterns. Ingere documentos de múltiplas fontes, gera embeddings localmente e responde via LLM através do OpenRouter.

## Visão Geral da Arquitetura

```
Fontes de Conhecimento          Pipeline RAG
─────────────────────           ──────────────────────────────────────────────
  PDFs                  ──┐
  Links (web)           ──┤──► RagKnowledgeBaseProcessor ──► chunks
  Banco de dados        ──┘              │
                                         ▼
                               HuggingFace Embeddings
                               (Xenova/all-MiniLM-L6-v2, local)
                                         │
                                         ▼
                                   Neo4j VectorStore
                                         │
                            ┌────────────┴────────────┐
                            ▼                         ▼
                     Similarity Search         LLM (OpenRouter)
                            └────────────┬────────────┘
                                         ▼
                               Interface Web (chat)
```

## Stack

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js v22 (ESM, sem build) |
| Linguagem | TypeScript (experimental-strip-types) |
| Servidor Web | Express v5 |
| Orquestração IA | LangChain |
| Embeddings | `@xenova/transformers` — local, sem API |
| Vector Store | Neo4j (bolt) |
| LLM | OpenRouter (API compatível OpenAI) |
| Loaders | PDFLoader, CheerioWebBaseLoader, pg |
| Frontend | HTML + CSS + JS vanilla (sem build) |

## Pré-requisitos

- Node.js >= v22
- Docker (para o Neo4j)
- Conta no [OpenRouter](https://openrouter.ai) com créditos ou modelo free disponível

## Instalação

```bash
npm install
```

Para usar a fonte de banco de dados (opcional):

```bash
npm install pg
```

## Configuração

Crie o arquivo `.env` na raiz do projeto:

```env
# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME=RAG Example

# Modelo LLM
NLP_MODEL='google/gemma-3-27b-it:free'

# Embeddings (local, sem API)
EMBEDDING_MODEL='Xenova/all-MiniLM-L6-v2'

# Neo4j
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_URI=bolt://localhost:7687
NEO4J_DATABASE=neo4j

# Porta do servidor web (padrão: 3000)
# PORT=3000

# Banco de dados (opcional)
# DB_CONNECTION_STRING=postgresql://user:pass@localhost:5432/mydb
```

## Como Usar

### Passo 1 — Subir a infraestrutura

```bash
npm run infra:up
```

Inicia o Neo4j via Docker e aguarda ficar pronto.

### Passo 2 — Ingerir os documentos

```bash
npm run ingest
```

Carrega os PDFs e links configurados, gera embeddings e popula o Neo4j.
> Execute apenas uma vez (ou quando adicionar novos documentos).

### Passo 3 — Iniciar o servidor web

```bash
npm run dev       # modo watch — recarrega ao salvar arquivos
# ou
npm start         # execução única
```

### Passo 4 — Abrir no navegador

```
http://localhost:3000
```

A interface exibe **"Inicializando..."** enquanto carrega o modelo de embeddings (~30s na primeira vez). Quando o indicador ficar **verde (Pronto)**, o chat está liberado.

---

## Interface Web

```
┌──────────────────────────────────────────── ● Pronto ┐
│ ⚙️ RAG Microservices                                  │
├───────────────────────────────────────────────────────┤
│ Sugestões: [Circuit Breaker] [Saga] [CQRS] [Saga] ... │
├───────────────────────────────────────────────────────┤
│                                                       │
│  🤖  Olá! Sou especialista em Microservices...        │
│                                                       │
│              👤  O que é o padrão Circuit Breaker?    │
│                                                       │
│  🤖  O Circuit Breaker é um padrão que...             │
│      ```código de exemplo```                          │
│                                                       │
├───────────────────────────────────────────────────────┤
│  [ Digite sua pergunta...                   ] [Enviar]│
└───────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Sugestões de perguntas clicáveis
- Respostas renderizadas em Markdown com syntax highlight
- Indicador de "digitando..." durante o processamento
- Input desabilitado durante a inicialização

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run infra:up` | Inicia o Neo4j via Docker |
| `npm run infra:down` | Para o Neo4j e remove os volumes |
| `npm run ingest` | Popula o Neo4j com os documentos configurados |
| `npm start` | Inicia o servidor web |
| `npm run dev` | Inicia o servidor web em modo watch |

## API

| Endpoint | Método | Descrição |
|---|---|---|
| `GET /api/status` | GET | Retorna `{ ready: boolean, error: string \| null }` |
| `POST /api/ask` | POST | Recebe `{ question: string }`, retorna `{ answer, topScore, error }` |

## Fontes de Conhecimento

Todas as fontes são configuradas em [`src/config.ts`](src/config.ts):

```ts
pdf: {
    paths: [
        "./design-patterns-microservices.pdf",
        "./microservices-transaction.pdf",
    ]
},
links: [
    "https://microservices.io/",
    "https://martinfowler.com/architecture/",
],
database: {
    connectionString: process.env.DB_CONNECTION_STRING ?? '',
    query: "SELECT id::text AS source, content AS text FROM documents",
    textColumn: "text",
    sourceColumn: "source",
},
```

Basta adicionar ou remover itens dos arrays. Rode `npm run ingest` novamente após qualquer alteração nas fontes.

## Estrutura do Projeto

```
meu-rag/
├── src/
│   ├── server.ts                    # servidor web Express + API REST
│   ├── index.ts                     # script de ingestão (CLI)
│   ├── config.ts                    # toda configuração centralizada
│   ├── ragKnowledgeBaseProcessor.ts # carrega PDFs, links e banco de dados
│   ├── ai.ts                        # busca vetorial + geração de resposta
│   └── util.ts
├── public/
│   └── index.html                   # interface web (SPA)
├── prompts/
│   ├── answerPrompt.json            # role, task, instruções do prompt
│   └── template.txt                 # template LangChain com variáveis
├── .env                             # variáveis de ambiente (não versionar)
├── docker-compose.yml               # Neo4j
└── package.json
```

## Customização do Prompt

Edite [`prompts/answerPrompt.json`](prompts/answerPrompt.json) para mudar o domínio do assistente:

```json
{
  "role": "Você é um assistente especializado em Microservices e Design Patterns",
  "task": "Responder perguntas sobre Microservices de forma educacional",
  "constraints": {
    "language": "pt-BR",
    "tone": "educacional e amigável"
  }
}
```

## Parâmetros Relevantes

| Parâmetro | Local | Descrição |
|---|---|---|
| `chunkSize` | `config.textSplitter` | Tamanho dos chunks de texto |
| `chunkOverlap` | `config.textSplitter` | Sobreposição entre chunks |
| `topK` | `config.similarity` | Nº de chunks recuperados por busca |
| `maxTokens` | `config.openRouter` | Limite de tokens na resposta do LLM |
| `temperature` | `config.openRouter` | Criatividade do LLM (0 = determinístico) |
| `PORT` | `.env` | Porta do servidor web (padrão: 3000) |

## Modelos LLM Gratuitos no OpenRouter

Modelos free têm quota compartilhada e podem sofrer rate limit em horários de pico:

```
google/gemma-3-27b-it:free
meta-llama/llama-3.3-70b-instruct:free
microsoft/phi-4:free
```

Para uso sem interrupções, adicione créditos e use um modelo pago leve como `google/gemma-3-12b-it`.
