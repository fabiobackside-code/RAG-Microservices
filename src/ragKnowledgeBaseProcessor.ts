import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio"
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from "@langchain/core/documents"
import { type TextSplitterConfig, type DatabaseConfig } from './config.ts'

export interface KnowledgeBaseOptions {
    pdfPaths?: string[]
    links?: string[]
    database?: DatabaseConfig
    textSplitterConfig: TextSplitterConfig
}

export class RagKnowledgeBaseProcessor {
    private options: KnowledgeBaseOptions

    constructor(options: KnowledgeBaseOptions) {
        this.options = options
    }

    async loadAndSplit() {
        const splitter = new RecursiveCharacterTextSplitter(this.options.textSplitterConfig)
        const allDocuments: Document[] = []

        // PDFs
        for (const pdfPath of this.options.pdfPaths ?? []) {
            const loader = new PDFLoader(pdfPath)
            const rawDocuments = await loader.load()
            console.log(`📄 Loaded ${rawDocuments.length} pages from ${pdfPath}`)
            const documents = await splitter.splitDocuments(rawDocuments)
            console.log(`✂️  Split into ${documents.length} chunks`)
            allDocuments.push(...documents.map(doc => ({
                ...doc,
                metadata: { source: doc.metadata.source }
            })))
        }

        // Links
        for (const link of this.options.links ?? []) {
            const loader = new CheerioWebBaseLoader(link)
            const rawDocuments = await loader.load()
            console.log(`🌐 Loaded ${rawDocuments.length} pages from ${link}`)
            const documents = await splitter.splitDocuments(rawDocuments)
            console.log(`✂️  Split into ${documents.length} chunks`)
            allDocuments.push(...documents.map(doc => ({
                ...doc,
                metadata: { source: doc.metadata.source }
            })))
        }

        // Database
        // Requer: npm install pg @types/pg
        if (this.options.database?.connectionString) {
            const { default: pg } = await import('pg')
            const client = new pg.Client({ connectionString: this.options.database.connectionString })
            await client.connect()

            const result = await client.query(this.options.database.query)
            await client.end()

            const rawDocuments = result.rows.map(row => new Document({
                pageContent: row[this.options.database!.textColumn],
                metadata: { source: row[this.options.database!.sourceColumn] ?? 'database' }
            }))
            console.log(`🗄️  Loaded ${rawDocuments.length} rows from database`)
            const documents = await splitter.splitDocuments(rawDocuments)
            console.log(`✂️  Split into ${documents.length} chunks`)
            allDocuments.push(...documents)
        }

        return allDocuments
    }
}
