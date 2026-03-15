import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { CONFIG } from "./config.ts";
import { RagKnowledgeBaseProcessor } from "./ragKnowledgeBaseProcessor.ts";
import { type PretrainedOptions } from "@huggingface/transformers";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
// import { ChatOpenAI } from "@langchain/openai";
// import { AI } from "./ai.ts";
// import { writeFile, mkdir } from 'node:fs/promises'

let _neo4jVectorStore: Neo4jVectorStore | null = null

async function clearAll(vectorStore: Neo4jVectorStore, nodeLabel: string): Promise<void> {
    console.log("🗑️  Removendo todos os documentos existentes...");
    await vectorStore.query(`MATCH (n:\`${nodeLabel}\`) DETACH DELETE n`)
    console.log("✅ Documentos removidos com sucesso\n");
}

try {
    console.log("🚀 Iniciando ingestão de documentos...\n");

    const knowledgeBase = new RagKnowledgeBaseProcessor({
        pdfPaths: CONFIG.pdf.paths,
        links: CONFIG.links,
        database: CONFIG.database,
        textSplitterConfig: CONFIG.textSplitter,
    })
    const documents = await knowledgeBase.loadAndSplit()

    const embeddings = new HuggingFaceTransformersEmbeddings({
        model: CONFIG.embedding.modelName,
        pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions,
    })

    _neo4jVectorStore = await Neo4jVectorStore.fromExistingGraph(embeddings, CONFIG.neo4j)

    await clearAll(_neo4jVectorStore, CONFIG.neo4j.nodeLabel)

    for (const [index, doc] of documents.entries()) {
        console.log(`✅ Adicionando documento ${index + 1}/${documents.length}`);
        await _neo4jVectorStore.addDocuments([doc])
    }

    console.log("\n✅ Base de dados populada com sucesso!\n");

    // ==================== STEP 2: RUN SIMILARITY SEARCH ====================
    // Perguntas automáticas via CLI — substituídas pela interface web (npm start)
    //
    // console.log("🔍 ETAPA 2: Executando buscas por similaridade...\n");
    // const nlpModel = new ChatOpenAI({
    //     temperature: CONFIG.openRouter.temperature,
    //     maxTokens: CONFIG.openRouter.maxTokens,
    //     maxRetries: CONFIG.openRouter.maxRetries,
    //     modelName: CONFIG.openRouter.nlpModel,
    //     openAIApiKey: CONFIG.openRouter.apiKey,
    //     configuration: {
    //         baseURL: CONFIG.openRouter.url,
    //         defaultHeaders: CONFIG.openRouter.defaultHeaders
    //     }
    // })
    //
    // const questions = [
    //     "Detalhe os principais padrões de design para microservices.",
    //     "Quais são as melhores práticas para comunicação entre microservices?",
    //     "Como garantir a segurança em uma arquitetura de microservices?",
    //     "Quais são as melhores ferramentas para orquestração de microservices?",
    //     "Como lidar com a consistência de dados em microservices?",
    //     "Quais são as tendências futuras para microservices e arquitetura de software?",
    //     "O que é o padrão Strangler Fig em Microservices?",
    // ]
    //
    // const ai = new AI({
    //     nlpModel,
    //     debugLog: console.log,
    //     vectorStore: _neo4jVectorStore,
    //     promptConfig: CONFIG.promptConfig,
    //     templateText: CONFIG.templateText,
    //     topK: CONFIG.similarity.topK,
    // })
    //
    // for (const index in questions) {
    //     const question = questions[index]
    //     console.log(`\n${'='.repeat(80)}`);
    //     console.log(`📌 PERGUNTA: ${question}`);
    //     console.log('='.repeat(80));
    //     const result = await ai.answerQuestion(question!)
    //     if (result.error) {
    //         console.log(`\n❌ Erro: ${result.error}\n`);
    //         continue
    //     }
    //     console.log(`\n${result.answer}\n`);
    //     await mkdir(CONFIG.output.answersFolder, { recursive: true })
    //     const fileName = `${CONFIG.output.answersFolder}/${CONFIG.output.fileName}-${index}-${Date.now()}.md`
    //     await writeFile(fileName, result.answer!)
    // }

} catch (error) {
    console.error('error', error)
} finally {
    await _neo4jVectorStore?.close();
}
