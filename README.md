# RAG com Neo4j + LangChain + OpenRouter

Sistema de **Retrieval-Augmented Generation (RAG)** que ingere documentos de múltiplas fontes, gera embeddings localmente, armazena vetores no Neo4j e responde perguntas usando um LLM via OpenRouter.

## Visão Geral da Arquitetura

```
Fontes de Conhecimento          Pipeline RAG
─────────────────────           ─────────────────────────────────────────
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
                                  Resposta em .md
```

## Stack

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js v22 (ESM, sem build) |
| Linguagem | TypeScript (experimental-strip-types) |
| Orquestração IA | LangChain |
| Embeddings | `@xenova/transformers` — local, sem API |
| Vector Store | Neo4j (bolt) |
| LLM | OpenRouter (API compatível OpenAI) |
| Loaders | PDFLoader, CheerioWebBaseLoader, pg |

## Pré-requisitos

- Node.js >= v22
- Docker (para o Neo4j)
- Conta no [OpenRouter](https://openrouter.ai) com créditos ou modelo free disponível

## Instalação

```bash
npm install
```

Para usar a fonte de banco de dados:

```bash
npm install pg @types/pg
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

# Banco de dados (opcional)
# DB_CONNECTION_STRING=postgresql://user:pass@localhost:5432/mydb
```

## Infraestrutura

Sobe o Neo4j via Docker:

```bash
npm run infra:up    # inicia Neo4j
npm run infra:down  # derruba e remove volumes
```

## Execução

```bash
npm start    # execução única
npm run dev  # modo watch (recarrega ao salvar)
```

O sistema executa duas etapas automaticamente:

1. **Ingestão** — carrega documentos das fontes configuradas, gera embeddings e popula o Neo4j
2. **Q&A** — executa as perguntas definidas em `index.ts` e salva as respostas em `./respostas/`

## Fontes de Conhecimento

Todas as fontes são configuradas em [`src/config.ts`](src/config.ts):

```ts
// PDFs locais
pdf: {
    paths: [
        "./design-patterns-microservices.pdf",
        "./microservices-transaction.pdf",
    ]
},

// Páginas web
links: [
    "https://microservices.io/",
    "https://martinfowler.com/architecture/",
],

// Banco de dados PostgreSQL (requer pg instalado)
database: {
    connectionString: process.env.DB_CONNECTION_STRING ?? '',
    query: "SELECT id::text AS source, content AS text FROM documents",
    textColumn: "text",
    sourceColumn: "source",
},
```

Basta adicionar ou remover itens dos arrays — sem alterar mais nada.

## Estrutura do Projeto

```
meu-rag/
├── src/
│   ├── index.ts                     # entrypoint — ingestão + Q&A
│   ├── config.ts                    # toda configuração centralizada
│   ├── ragKnowledgeBaseProcessor.ts # carrega PDFs, links e banco de dados
│   └── ai.ts                        # busca vetorial + geração de resposta
├── prompts/
│   ├── answerPrompt.json            # role, task, instruções do prompt
│   └── template.txt                 # template LangChain com variáveis
├── respostas/                       # respostas geradas (criado em runtime)
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

## Modelos LLM Gratuitos no OpenRouter

Modelos free têm quota compartilhada e podem sofrer rate limit em horários de pico:

```
google/gemma-3-27b-it:free
meta-llama/llama-3.3-70b-instruct:free
microsoft/phi-4:free
```

Para uso sem interrupções, adicione créditos e use um modelo pago leve como `google/gemma-3-12b-it`.
