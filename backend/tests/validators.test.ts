import { registerValidator } from '../src/validators/client/auth.validator.js'
import { createJobValidator } from '../src/validators/client/job.validator.js'
import { JobLevel, JobType } from '../src/constants/enums/job.enum.js'

describe('client validators', () => {
  it('normalizes registration email and rejects mismatched passwords', () => {
    const parsed = registerValidator.parse({
      body: {
        fullName: '  Nguyen Van A  ',
        email: 'TEST@EXAMPLE.COM',
        password: 'password-123',
        confirmPassword: 'password-123'
      }
    })

    expect(parsed.body.fullName).toBe('Nguyen Van A')
    expect(parsed.body.email).toBe('test@example.com')

    expect(() =>
      registerValidator.parse({
        body: {
          fullName: 'Nguyen Van A',
          email: 'test@example.com',
          password: 'password-123',
          confirmPassword: 'other-password'
        }
      })
    ).toThrow()
  })

  it('escapes job text and de-duplicates category ids', () => {
    const categoryId = '507f1f77bcf86cd799439011'
    const parsed = createJobValidator.parse({
      body: {
        title: '  <script>job</script>  ',
        description: 'Build reliable services',
        requirements: 'Node.js experience',
        benefits: 'Remote work',
        salary: { min: 1000, max: 2000, currency: 'USD' },
        location: 'Ha Noi',
        job_type: JobType.FULL_TIME,
        level: JobLevel.JUNIOR,
        category_ids: [categoryId, categoryId],
        skills: ['TypeScript', 'Node.js'],
        quantity: 2,
        expired_at: '2030-01-01T00:00:00.000Z'
      }
    })

    expect(parsed.body.title).toBe('&lt;script&gt;job&lt;/script&gt;')
    expect(parsed.body.category_ids).toHaveLength(1)
    expect(parsed.body.category_ids[0].toHexString()).toBe(categoryId)
  })

  it('rejects non-negotiable salary ranges where max is lower than min', () => {
    expect(() =>
      createJobValidator.parse({
        body: {
          title: 'Backend Engineer',
          description: 'Build reliable services',
          requirements: 'Node.js experience',
          benefits: 'Remote work',
          salary: { min: 2000, max: 1000, currency: 'USD' },
          location: 'Ha Noi',
          job_type: JobType.FULL_TIME,
          level: JobLevel.JUNIOR,
          category_ids: ['507f1f77bcf86cd799439011'],
          skills: ['TypeScript'],
          quantity: 1,
          expired_at: '2030-01-01T00:00:00.000Z'
        }
      })
    ).toThrow()
  })
})
