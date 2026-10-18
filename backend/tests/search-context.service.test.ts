import { JobLevel, JobType } from '../src/constants/enums/job.enum.js'
import { SearchContextService, MAX_SEARCH_CONTEXT_JOB_IDS } from '../src/services/chat/context/search-context.service.js'

const jobIds = Array.from({ length: 22 }, (_, index) => (index + 1).toString(16).padStart(24, '0'))

describe('search context service', () => {
  const service = new SearchContextService()
  const initialDate = new Date('2026-10-12T00:00:00.000Z')

  it('keeps Frontend and DevOps searches as separate active contexts', () => {
    const frontend = service.create(
      [],
      {
        label: 'Frontend jobs',
        query: 'Frontend React',
        filters: { location: 'Ho Chi Minh City', level: JobLevel.MIDDLE },
        job_ids: [jobIds[0], jobIds[1]]
      },
      initialDate
    )
    const devops = service.create(
      frontend.contexts,
      {
        label: 'DevOps jobs',
        query: 'DevOps Kubernetes',
        filters: { job_type: JobType.REMOTE },
        job_ids: [jobIds[2], jobIds[3]]
      },
      new Date('2026-10-12T00:01:00.000Z')
    )

    expect(service.list(devops.contexts, 'active')).toEqual([
      expect.objectContaining({ context_id: devops.context.context_id, query: 'DevOps Kubernetes' }),
      expect.objectContaining({ context_id: frontend.context.context_id, query: 'Frontend React' })
    ])
    expect(service.getActiveJobIds({ search_contexts: devops.contexts }, frontend.context.context_id)).toEqual([
      jobIds[0],
      jobIds[1]
    ])
  })

  it('replaces one active context without overwriting other domains', () => {
    const frontend = service.create(
      [],
      { label: 'Frontend jobs', query: 'Frontend', job_ids: [jobIds[0]] },
      initialDate
    )
    const devops = service.create(
      frontend.contexts,
      { label: 'DevOps jobs', query: 'DevOps', job_ids: [jobIds[1]] },
      new Date('2026-10-12T00:01:00.000Z')
    )
    const replacement = service.replace(
      devops.contexts,
      frontend.context.context_id,
      { label: 'Senior Frontend jobs', query: 'Senior Frontend', job_ids: [jobIds[2]] },
      new Date('2026-10-12T00:02:00.000Z')
    )

    expect(service.getActive(replacement.contexts, frontend.context.context_id)).toBeNull()
    expect(service.getActive(replacement.contexts, devops.context.context_id)).toEqual(
      expect.objectContaining({ query: 'DevOps' })
    )
    expect(service.getActive(replacement.contexts, replacement.context.context_id)).toEqual(
      expect.objectContaining({ query: 'Senior Frontend' })
    )
  })

  it('deduplicates and caps job IDs at 20', () => {
    const context = service.create(
      [],
      {
        label: 'All jobs',
        query: 'Engineer',
        job_ids: [jobIds[0], jobIds[0], ...jobIds.slice(1)]
      },
      initialDate
    ).context

    expect(context.job_ids).toHaveLength(MAX_SEARCH_CONTEXT_JOB_IDS)
    expect(context.job_ids).toEqual(jobIds.slice(0, MAX_SEARCH_CONTEXT_JOB_IDS))
  })

  it('uses legacy job IDs only when no active typed context exists', () => {
    expect(
      service.getActiveJobIds({
        last_retrieved_job_ids: [jobIds[0], jobIds[0], jobIds[1]]
      })
    ).toEqual([jobIds[0], jobIds[1]])

    const context = service.create(
      [],
      { label: 'Frontend jobs', query: 'Frontend', job_ids: [jobIds[2]] },
      initialDate
    ).context

    expect(
      service.getActiveJobIds({
        search_contexts: [context],
        last_retrieved_job_ids: [jobIds[0]]
      })
    ).toEqual([jobIds[2]])
  })

  it('rejects arbitrary filters, blank input, invalid IDs, and non-UUID context IDs', () => {
    const invalidInputs = [
      { label: 'Jobs', query: 'DevOps', filters: { $where: 'true' }, job_ids: [jobIds[0]] },
      { label: 'Jobs', query: '   ', job_ids: [jobIds[0]] },
      { label: 'Jobs', query: 'DevOps', job_ids: ['not-an-id'] }
    ]

    for (const input of invalidInputs) {
      expect(() => service.create([], input, initialDate)).toThrow()
    }

    expect(() => service.getActive([], 'not-a-uuid')).toThrow()
  })
})
