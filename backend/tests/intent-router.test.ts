const generateJson = jest.fn()

jest.mock('~/configs/env.config.js', () => ({
  __esModule: true,
  default: {
    LLM_PROVIDER: 'openai',
    LLM_MODEL_INTENT: 'gpt-4o-mini'
  }
}))

jest.mock('~/services/chat/ai/llm.service.js', () => ({
  __esModule: true,
  default: {
    generateJson
  }
}))

import intentRouterService from '../src/services/chat/intent/intent-router.service.js'

describe('intent router', () => {
  beforeEach(() => {
    generateJson.mockReset()
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses deterministic job search fallback when the LLM is unavailable', async () => {
    generateJson.mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(intentRouterService.detectIntent('Tìm remote frontend job')).resolves.toEqual({
      intent: 'job_search',
      confidence: 0.25
    })
    expect(generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o-mini'
      })
    )
  })

  it('overrides an incorrect LLM classification for CV review requests', async () => {
    generateJson.mockResolvedValueOnce({
      intent: 'job_search',
      confidence: 0.9
    })

    await expect(intentRouterService.detectIntent('Review my CV please')).resolves.toEqual({
      intent: 'cv_review',
      confidence: 0.9
    })
  })

  it('falls back to unsupported for messages outside supported domains', async () => {
    generateJson.mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(intentRouterService.detectIntent('Tell me a joke')).resolves.toEqual({
      intent: 'unsupported',
      confidence: 0.25
    })
  })
})
