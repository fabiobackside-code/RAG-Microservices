import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers"
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector"
import { ChatOpenAI } from "@langchain/openai"
import { type PretrainedOptions } from "@huggingface/transformers"
import { CONFIG } from "./config.ts"
import { AI } from "./ai.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, '../public')))

let ai: AI | null = null
let vectorStore: Neo4jVectorStore | null = null
let isReady = false
let initError: string | null = null

async function initialize() {
    try {
        console.log('🚀 Inicializando RAG...\n')

        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: CONFIG.embedding.modelName,
            pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions,
        })

        vectorStore = await Neo4jVectorStore.fromExistingGraph(embeddings, CONFIG.neo4j)

        const nlpModel = new ChatOpenAI({
            temperature: CONFIG.openRouter.temperature,
            maxTokens: CONFIG.openRouter.maxTokens,
            maxRetries: CONFIG.openRouter.maxRetries,
            modelName: CONFIG.openRouter.nlpModel,
            openAIApiKey: CONFIG.openRouter.apiKey,
            configuration: {
                baseURL: CONFIG.openRouter.url,
                defaultHeaders: CONFIG.openRouter.defaultHeaders,
            },
        })

        ai = new AI({
            nlpModel,
            debugLog: console.log,
            vectorStore,
            promptConfig: CONFIG.promptConfig,
            templateText: CONFIG.templateText,
            topK: CONFIG.similarity.topK,
        })

        isReady = true
        console.log(`\n✅ Pronto → http://localhost:${CONFIG.server.port}\n`)
    } catch (err) {
        initError = err instanceof Error ? err.message : String(err)
        console.error('❌ Falha na inicialização:', initError)
    }
}

app.get('/api/status', (_req, res) => {
    res.json({ ready: isReady, error: initError })
})

app.post('/api/ask', async (req, res) => {
    if (!isReady || !ai) {
        res.status(503).json({ error: initError ?? 'Servidor ainda inicializando. Aguarde...' })
        return
    }

    const { question } = req.body as { question?: string }

    if (!question?.trim()) {
        res.status(400).json({ error: 'Pergunta não pode estar vazia.' })
        return
    }

    try {
        const result = await ai.answerQuestion(question.trim())
        res.json(result)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        res.status(500).json({ error: message })
    }
})

const server = app.listen(CONFIG.server.port, () => {
    console.log(`🌐 http://localhost:${CONFIG.server.port}`)
    initialize()
})

process.on('SIGTERM', async () => {
    await vectorStore?.close()
    server.close()
})
