const mockCountDocuments = jest.fn()

jest.mock('../src/configs/database.config.js', () => ({
  __esModule: true,
  default: {
    jobs: {
      countDocuments: mockCountDocuments
    },
    companies: {
      collectionName: 'companies'
    }
  }
}))

jest.mock('../src/services/chat/search/lexical-job-search.service.js', () => ({
  __esModule: true,
  default: {
    search: jest.fn(),
    buildPublicSearchFilters: jest.fn()
  }
}))

jest.mock('../src/services/chat/search/semantic-job-search.service.js', () => ({
  __esModule: true,
  default: {
    search: jest.fn()
  }
}))

jest.mock('../src/services/chat/search/hybrid-job-search.service.js', () => ({
  __esModule: true,
  default: {
    mergeSearchCandidates: jest.fn(),
    applySearchThresholdAndSort: jest.fn()
  }
}))

import publicJobSearchService from '../src/services/chat/search/public-job-search.service.js'

describe('public job search database-wide count', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCountDocuments.mockResolvedValue(37)
  })

  it('requires a non-null published_at value', async () => {
    await expect(
      publicJobSearchService.countPublicJobs({
        q: 'DevOps',
        page: 1,
        limit: 10
      })
    ).resolves.toBe(37)

    expect(mockCountDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'open',
        moderation_status: 'active',
        published_at: { $ne: null },
        $or: expect.any(Array)
      })
    )
  })
})
