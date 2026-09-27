import 'dotenv/config'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config'
import logger from '~/configs/logger.config.js'

const CATEGORY_DEFINITIONS = [
  {
    slug: 'information-technology',
    name: 'Information Technology',
    parent: null,
    sort_order: 10,
    description: 'Software, data, infrastructure and technology jobs.'
  },
  { slug: 'backend-development', name: 'Backend Development', parent: 'information-technology', sort_order: 11 },
  { slug: 'frontend-development', name: 'Frontend Development', parent: 'information-technology', sort_order: 12 },
  { slug: 'fullstack-development', name: 'Fullstack Development', parent: 'information-technology', sort_order: 13 },
  { slug: 'mobile-development', name: 'Mobile Development', parent: 'information-technology', sort_order: 14 },
  { slug: 'devops-cloud', name: 'DevOps / Cloud', parent: 'information-technology', sort_order: 15 },
  {
    slug: 'data-ai-machine-learning',
    name: 'Data / AI / Machine Learning',
    parent: 'information-technology',
    sort_order: 16
  },
  { slug: 'qa-testing', name: 'QA / Testing', parent: 'information-technology', sort_order: 17 },
  { slug: 'ui-ux-design', name: 'UI/UX Design', parent: 'information-technology', sort_order: 18 },
  { slug: 'business-sales', name: 'Business / Sales', parent: null, sort_order: 20 },
  { slug: 'sales', name: 'Sales', parent: 'business-sales', sort_order: 21 },
  { slug: 'business-development', name: 'Business Development', parent: 'business-sales', sort_order: 22 },
  { slug: 'customer-service', name: 'Customer Service', parent: 'business-sales', sort_order: 23 },
  { slug: 'marketing', name: 'Marketing', parent: null, sort_order: 30 },
  { slug: 'digital-marketing', name: 'Digital Marketing', parent: 'marketing', sort_order: 31 },
  { slug: 'content-marketing', name: 'Content Marketing', parent: 'marketing', sort_order: 32 },
  { slug: 'seo-sem', name: 'SEO / SEM', parent: 'marketing', sort_order: 33 },
  { slug: 'finance-accounting', name: 'Finance / Accounting', parent: null, sort_order: 40 },
  { slug: 'accounting', name: 'Accounting', parent: 'finance-accounting', sort_order: 41 },
  { slug: 'finance', name: 'Finance', parent: 'finance-accounting', sort_order: 42 },
  { slug: 'banking', name: 'Banking', parent: 'finance-accounting', sort_order: 43 },
  { slug: 'human-resources', name: 'Human Resources', parent: null, sort_order: 50 },
  { slug: 'recruitment', name: 'Recruitment', parent: 'human-resources', sort_order: 51 },
  { slug: 'hr-operations', name: 'HR Operations', parent: 'human-resources', sort_order: 52 },
  { slug: 'operations-admin', name: 'Operations / Admin', parent: null, sort_order: 60 },
  { slug: 'administration', name: 'Administration', parent: 'operations-admin', sort_order: 61 },
  { slug: 'operations', name: 'Operations', parent: 'operations-admin', sort_order: 62 },
  { slug: 'logistics', name: 'Logistics', parent: 'operations-admin', sort_order: 63 },
  { slug: 'education', name: 'Education', parent: null, sort_order: 70 },
  { slug: 'healthcare', name: 'Healthcare', parent: null, sort_order: 80 },
  { slug: 'manufacturing', name: 'Manufacturing', parent: null, sort_order: 90 },
  { slug: 'other', name: 'Other', parent: null, sort_order: 999 }
] as const

const CATEGORY_IDS: Map<string, ObjectId> = new Map(
  CATEGORY_DEFINITIONS.map((item, index) => [
    item.slug,
    new ObjectId(`7000000000000000000000${String(index + 1).padStart(2, '0')}`)
  ])
)

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const matchCategorySlugs = (job: {
  title?: string
  description?: string
  requirements?: string
  skills?: string[]
  category?: string[]
}) => {
  const text = normalizeText(
    [job.title, job.description, job.requirements, ...(job.skills || []), ...(job.category || [])].join(' ')
  )
  const slugs = new Set<string>()

  if (/backend|back end|node|express|nestjs|java|spring|php|laravel|api|server/.test(text))
    slugs.add('backend-development')
  if (/frontend|front end|react|vue|angular|html|css|javascript|typescript/.test(text))
    slugs.add('frontend-development')
  if (/fullstack|full stack/.test(text)) slugs.add('fullstack-development')
  if (/mobile|android|ios|flutter|react native|kotlin|swift/.test(text)) slugs.add('mobile-development')
  if (/devops|cloud|aws|azure|gcp|docker|kubernetes|ci\/cd|infrastructure/.test(text)) slugs.add('devops-cloud')
  if (/data|ai|machine learning|ml|deep learning|python|analyst|analytics|etl/.test(text))
    slugs.add('data-ai-machine-learning')
  if (/qa|tester|testing|automation test|quality assurance/.test(text)) slugs.add('qa-testing')
  if (/ui|ux|designer|figma|product design/.test(text)) slugs.add('ui-ux-design')
  if (/sales|sale|telesales|account executive/.test(text)) slugs.add('sales')
  if (/business development|bd|partnership/.test(text)) slugs.add('business-development')
  if (/customer service|customer support|support|cham soc khach hang|cskh/.test(text)) slugs.add('customer-service')
  if (/marketing|digital marketing|facebook ads|google ads|campaign/.test(text)) slugs.add('digital-marketing')
  if (/content|copywriter|writer/.test(text)) slugs.add('content-marketing')
  if (/seo|sem/.test(text)) slugs.add('seo-sem')
  if (/accounting|accountant|ke toan/.test(text)) slugs.add('accounting')
  if (/finance|financial|tai chinh/.test(text)) slugs.add('finance')
  if (/bank|banking|ngan hang/.test(text)) slugs.add('banking')
  if (/recruit|recruitment|talent acquisition|tuyen dung/.test(text)) slugs.add('recruitment')
  if (/hr|human resource|nhan su/.test(text)) slugs.add('hr-operations')
  if (/admin|administration|hanh chinh/.test(text)) slugs.add('administration')
  if (/operation|operations|van hanh/.test(text)) slugs.add('operations')
  if (/logistics|warehouse|supply chain|kho|van tai/.test(text)) slugs.add('logistics')
  if (/teacher|education|training|giao vien|dao tao/.test(text)) slugs.add('education')
  if (/health|medical|doctor|nurse|y te|duoc/.test(text)) slugs.add('healthcare')
  if (/manufacturing|factory|production|san xuat/.test(text)) slugs.add('manufacturing')

  const hasTech = [
    'backend-development',
    'frontend-development',
    'fullstack-development',
    'mobile-development',
    'devops-cloud',
    'data-ai-machine-learning',
    'qa-testing',
    'ui-ux-design'
  ].some((slug) => slugs.has(slug))
  if (hasTech) slugs.add('information-technology')

  if (slugs.size === 0) slugs.add('other')
  return [...slugs].slice(0, 5)
}

const seedCategories = async () => {
  const now = new Date()
  const operations = CATEGORY_DEFINITIONS.map((item) => ({
    updateOne: {
      filter: { slug: item.slug },
      update: {
        $set: {
          name: item.name,
          slug: item.slug,
          parent_id: item.parent ? CATEGORY_IDS.get(item.parent) || null : null,
          description: 'description' in item ? item.description : undefined,
          is_active: true,
          sort_order: item.sort_order,
          updated_at: now
        },
        $setOnInsert: {
          _id: CATEGORY_IDS.get(item.slug),
          created_at: now
        }
      },
      upsert: true
    }
  }))

  if (operations.length > 0) {
    await databaseService.jobCategories.bulkWrite(operations)
  }
}

const migrateJobs = async () => {
  const jobs = await databaseService.jobs
    .find({}, { projection: { title: 1, description: 1, requirements: 1, skills: 1, category: 1 } })
    .toArray()

  let migrated = 0
  for (const job of jobs) {
    const slugs = matchCategorySlugs(
      job as { title?: string; description?: string; requirements?: string; skills?: string[]; category?: string[] }
    )
    const categoryIds = slugs.map((slug) => CATEGORY_IDS.get(slug)).filter((id): id is ObjectId => Boolean(id))

    await databaseService.jobs.updateOne(
      { _id: job._id },
      {
        $set: {
          category_ids: categoryIds,
          updated_at: new Date()
        },
        $unset: {
          category: ''
        }
      }
    )
    migrated += 1
  }

  return migrated
}

const main = async () => {
  await databaseService.connect()
  await seedCategories()
  const migrated = await migrateJobs()
  logger.info({ categories: CATEGORY_DEFINITIONS.length, migrated }, 'Job categories migrated')
  process.exit(0)
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Job category migration failed')
  process.exit(1)
})
