import 'dotenv/config'
import { performance } from 'node:perf_hooks'
import {
  GEMINI_EMBEDDING_MODEL_NAME,
  LOCAL_EMBEDDING_MODEL,
  generateGeminiEmbedding,
  generateLocalEmbedding
} from '../services/chat/ai/embedding.service'
import logger from '~/configs/logger.config.js'

const args = process.argv.slice(2)
const providerArg = args.find((arg) => arg.startsWith('--provider=')) || '--provider=local'
const repeatArg = args.find((arg) => arg.startsWith('--repeat=')) || '--repeat=1'
const dimsArg = args.find((arg) => arg.startsWith('--dims='))
const text =
  args
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim() || 'Toi muon tim mot cong viec backend o Ha Noi'

const provider = providerArg.split('=')[1]
const repeat = Math.max(1, Number(repeatArg.split('=')[1] || 1))
const outputDimensionality = dimsArg ? Number(dimsArg.split('=')[1]) : undefined

const benchmark = async (label: string, fn: () => Promise<number[]>) => {
  const elapsedMsList: number[] = []
  let vector: number[] = []

  for (let attempt = 1; attempt <= repeat; attempt += 1) {
    const startedAt = performance.now()
    vector = await fn()
    const elapsedMs = performance.now() - startedAt
    elapsedMsList.push(Number(elapsedMs.toFixed(2)))
    logger.info({ label, attempt, elapsed_ms: Number(elapsedMs.toFixed(2)) }, 'Embedding attempt completed')
  }

  logger.debug(
    { label, vector_length: vector.length, first_values: vector.slice(0, 12), elapsed_ms: elapsedMsList },
    'Embedding benchmark completed'
  )
}

const main = async () => {
  logger.debug({ input_length: text.length }, 'Embedding demo started')

  if (provider === 'local') {
    logger.info({ provider, model: LOCAL_EMBEDDING_MODEL }, 'Running embedding demo')
    await benchmark('local', () => generateLocalEmbedding(text))
    return
  }

  if (provider === 'gemini') {
    logger.info(
      { provider, model: GEMINI_EMBEDDING_MODEL_NAME, output_dimensionality: outputDimensionality ?? null },
      'Running embedding demo'
    )
    await benchmark('gemini', () => generateGeminiEmbedding(text, { outputDimensionality }))
    return
  }

  throw new Error(`Unsupported provider: ${provider}`)
}

main().catch((error) => {
  logger.error({ err: error, provider }, 'Embedding demo failed')
  process.exit(1)
})
