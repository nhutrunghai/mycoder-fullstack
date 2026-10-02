import _ from 'lodash'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import databaseService from '~/configs/database.config.js'
import {
  JobModerationStatus,
  JobPromotionSource,
  JobPromotionStatus,
  JobPromotionType,
  JobStatus
} from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'
import { AppError } from '~/errors/app-error.js'
import JobPromotion from '~/models/schema/client/jobPromotions.schema.js'
import JobPromotionPlan from '~/models/schema/client/jobPromotionPlans.schema.js'

type JobPromotionListItem = JobPromotion & {
  job: {
    _id: ObjectId
    title: string
    location: string
    job_type: string
    level: string
    status?: JobStatus
    moderation_status?: JobModerationStatus
    published_at?: Date
    expired_at?: Date
  }
  company: {
    _id: ObjectId
    company_name: string
    verified?: boolean
    logo?: string
  }
}

class AdminJobPromotionService {
  async getPromotions({
    type,
    status,
    companyId,
    jobId,
    planId,
    keyword,
    page,
    limit
  }: {
    type?: JobPromotionType
    status?: JobPromotionStatus
    companyId?: ObjectId
    jobId?: ObjectId
    planId?: ObjectId
    keyword?: string
    page: number
    limit: number
  }) {
    await this.syncPromotionStatuses()
    const match: {
      type?: JobPromotionType
      status?: JobPromotionStatus
      company_id?: ObjectId
      job_id?: ObjectId
      plan_id?: ObjectId
    } = {}

    if (type) {
      match.type = type
    }

    if (status) {
      match.status = status
    }

    if (companyId) {
      match.company_id = companyId
    }

    if (jobId) {
      match.job_id = jobId
    }

    if (planId) {
      match.plan_id = planId
    }

    const pipeline: object[] = [
      { $match: match },
      {
        $lookup: {
          from: databaseService.jobs.collectionName,
          localField: 'job_id',
          foreignField: '_id',
          as: 'job'
        }
      },
      { $unwind: '$job' },
      {
        $lookup: {
          from: databaseService.companies.collectionName,
          localField: 'company_id',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: '$company' }
    ]

    if (keyword) {
      pipeline.push({
        $match: {
          'job.title': {
            $regex: _.escapeRegExp(keyword),
            $options: 'i'
          }
        }
      })
    }

    const [result] = await databaseService.jobPromotions
      .aggregate<{
        items: JobPromotionListItem[]
        total: { count: number }[]
      }>([
        ...pipeline,
        {
          $sort: {
            priority: -1,
            starts_at: -1,
            created_at: -1
          }
        },
        {
          $facet: {
            items: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              this.getPromotionProjection()
            ],
            total: [{ $count: 'count' }]
          }
        }
      ])
      .toArray()

    const total = result?.total[0]?.count || 0

    const [counts, revenue] = await Promise.all([
      databaseService.jobPromotions
        .aggregate<{ _id: JobPromotionStatus; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
        .toArray(),
      databaseService.jobPromotions
        .aggregate<{ total_revenue: number }>([
          { $match: { amount_paid: { $gt: 0 } } },
          { $group: { _id: null, total_revenue: { $sum: '$amount_paid' } } }
        ])
        .toArray()
    ])
    const countMap = new Map(counts.map((c) => [c._id, c.count]))
    const summary = {
      total:
        (countMap.get(JobPromotionStatus.ACTIVE) || 0) +
        (countMap.get(JobPromotionStatus.SCHEDULED) || 0) +
        (countMap.get(JobPromotionStatus.EXPIRED) || 0) +
        (countMap.get(JobPromotionStatus.CANCELLED) || 0),
      active: countMap.get(JobPromotionStatus.ACTIVE) || 0,
      scheduled: countMap.get(JobPromotionStatus.SCHEDULED) || 0,
      expired: countMap.get(JobPromotionStatus.EXPIRED) || 0,
      cancelled: countMap.get(JobPromotionStatus.CANCELLED) || 0,
      total_revenue: revenue[0]?.total_revenue || 0
    }

    return {
      promotions: result?.items || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      summary
    }
  }

  async getPromotionByIdOrThrow(promotionId: ObjectId) {
    await this.syncPromotionStatuses()
    const promotion = await databaseService.jobPromotions
      .aggregate<JobPromotionListItem>([
        { $match: { _id: promotionId } },
        {
          $lookup: {
            from: databaseService.jobs.collectionName,
            localField: 'job_id',
            foreignField: '_id',
            as: 'job'
          }
        },
        { $unwind: '$job' },
        {
          $lookup: {
            from: databaseService.companies.collectionName,
            localField: 'company_id',
            foreignField: '_id',
            as: 'company'
          }
        },
        { $unwind: '$company' },
        this.getPromotionProjection()
      ])
      .next()

    if (!promotion) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.JOB_PROMOTION_NOT_FOUND
      })
    }

    return promotion
  }

  async createPromotion({ jobId, planId, startsAt, endsAt }: {
    jobId: ObjectId
    planId: ObjectId
    startsAt: Date
    endsAt: Date
  }) {
    this.assertValidDateRange(startsAt, endsAt)

    const plan = await databaseService.jobPromotionPlans.findOne({ _id: planId, is_active: true })
    if (!plan) {
      throw new AppError({ statusCode: StatusCodes.NOT_FOUND, message: 'Không tìm thấy gói quảng cáo đang hoạt động.' })
    }
    const durationDays = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86400000)
    if (durationDays < plan.min_duration_days || durationDays > plan.max_duration_days) {
      throw new AppError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: `Thời lượng gói phải từ ${plan.min_duration_days} đến ${plan.max_duration_days} ngày.`
      })
    }

    const job = await databaseService.jobs.findOne({ _id: jobId })

    if (!job) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.JOB_NOT_FOUND
      })
    }

    if (
      job.status !== JobStatus.OPEN ||
      job.moderation_status !== JobModerationStatus.ACTIVE ||
      !job.published_at ||
      job.expired_at <= new Date()
    ) {
      throw new AppError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: UserMessages.JOB_PROMOTION_JOB_NOT_ELIGIBLE
      })
    }

    await this.assertNoOverlappingPromotion({
      jobId,
      type: plan.type,
      startsAt,
      endsAt
    })

    const promotion = new JobPromotion({
      job_id: jobId,
      company_id: job.company_id,
      plan_id: plan._id,
      plan_snapshot: this.getPlanSnapshot(plan),
      source: JobPromotionSource.ADMIN_GRANT,
      type: plan.type,
      status: startsAt > new Date() ? JobPromotionStatus.SCHEDULED : JobPromotionStatus.ACTIVE,
      starts_at: startsAt,
      ends_at: endsAt,
      priority: plan.default_priority,
      amount_paid: 0,
      currency: plan.currency
    })

    const result = await databaseService.jobPromotions.insertOne(promotion)

    return this.getPromotionByIdOrThrow(result.insertedId)
  }

  async updatePromotion({
    promotionId,
    planId,
    status,
    startsAt,
    endsAt
  }: {
    promotionId: ObjectId
    planId?: ObjectId
    status?: JobPromotionStatus
    startsAt?: Date
    endsAt?: Date
  }) {
    const current = await databaseService.jobPromotions.findOne({ _id: promotionId })

    if (!current) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.JOB_PROMOTION_NOT_FOUND
      })
    }

    const isChangingPlan = Boolean(planId && (!current.plan_id || !planId.equals(current.plan_id)))
    const plan = isChangingPlan
      ? await databaseService.jobPromotionPlans.findOne({ _id: planId, is_active: true })
      : null
    if (isChangingPlan && !plan) {
      throw new AppError({ statusCode: StatusCodes.NOT_FOUND, message: 'Không tìm thấy gói quảng cáo đang hoạt động.' })
    }

    if (
      (current.source === JobPromotionSource.EMPLOYER_PURCHASE || current.amount_paid > 0) &&
      (isChangingPlan || startsAt || endsAt)
    ) {
      throw new AppError({
        statusCode: StatusCodes.CONFLICT,
        message: 'Không thể thay đổi gói hoặc thời gian của lượt do nhà tuyển dụng đã thanh toán.'
      })
    }
    const nextType = plan?.type || current.type
    const nextStartsAt = startsAt || current.starts_at
    const nextEndsAt = endsAt || current.ends_at
    this.assertValidDateRange(nextStartsAt, nextEndsAt)
    const now = new Date()
    const derivedStatus = (
      status === JobPromotionStatus.CANCELLED || (current.status === JobPromotionStatus.CANCELLED && status === undefined)
        ? JobPromotionStatus.CANCELLED
        : nextEndsAt <= now
          ? JobPromotionStatus.EXPIRED
          : nextStartsAt > now
            ? JobPromotionStatus.SCHEDULED
            : JobPromotionStatus.ACTIVE
    )

    const durationDays = Math.ceil((nextEndsAt.getTime() - nextStartsAt.getTime()) / 86400000)
    const minDurationDays = plan?.min_duration_days ?? current.plan_snapshot?.min_duration_days
    const maxDurationDays = plan?.max_duration_days ?? current.plan_snapshot?.max_duration_days
    if (
      minDurationDays !== undefined &&
      maxDurationDays !== undefined &&
      (durationDays < minDurationDays || durationDays > maxDurationDays)
    ) {
      throw new AppError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: `Thời lượng gói phải từ ${minDurationDays} đến ${maxDurationDays} ngày.`
      })
    }

    if (derivedStatus !== JobPromotionStatus.CANCELLED) {
      await this.assertNoOverlappingPromotion({
        jobId: current.job_id,
        type: nextType,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        excludePromotionId: promotionId
      })
    }

    const updated = await databaseService.jobPromotions.findOneAndUpdate(
      { _id: promotionId },
      {
        $set: {
          ...(plan ? {
            plan_id: plan._id,
            plan_snapshot: this.getPlanSnapshot(plan),
            type: plan.type,
            priority: plan.default_priority,
            currency: plan.currency
          } : {}),
          status: derivedStatus,
          ...(startsAt ? { starts_at: startsAt } : {}),
          ...(endsAt ? { ends_at: endsAt } : {}),
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    return this.getPromotionByIdOrThrow(updated!._id!)
  }

  async deletePromotion(promotionId: ObjectId) {
    const promotion = await databaseService.jobPromotions.findOne({ _id: promotionId })

    if (!promotion) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.JOB_PROMOTION_NOT_FOUND
      })
    }

    if (promotion.source === JobPromotionSource.EMPLOYER_PURCHASE || promotion.amount_paid > 0) {
      throw new AppError({
        statusCode: StatusCodes.CONFLICT,
        message: 'Không thể xóa lượt quảng cáo đã thanh toán. Hãy hủy để giữ lịch sử giao dịch.'
      })
    }

    await databaseService.jobPromotions.deleteOne({ _id: promotionId })

    return promotion
  }

  private assertValidDateRange(startsAt: Date, endsAt: Date) {
    if (startsAt >= endsAt) {
      throw new AppError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: UserMessages.JOB_PROMOTION_DATE_INVALID
      })
    }
  }

  async syncPromotionStatuses() {
    const now = new Date()
    await databaseService.jobPromotions.updateMany(
      { status: { $in: [JobPromotionStatus.ACTIVE, JobPromotionStatus.SCHEDULED] }, ends_at: { $lte: now } },
      { $set: { status: JobPromotionStatus.EXPIRED, updated_at: now } }
    )
    await databaseService.jobPromotions.updateMany(
      { status: JobPromotionStatus.SCHEDULED, starts_at: { $lte: now }, ends_at: { $gt: now } },
      { $set: { status: JobPromotionStatus.ACTIVE, updated_at: now } }
    )
  }

  private getPlanSnapshot(plan: JobPromotionPlan) {
    return {
      code: plan.code,
      name: plan.name,
      type: plan.type,
      daily_price: plan.daily_price,
      currency: plan.currency,
      min_duration_days: plan.min_duration_days,
      max_duration_days: plan.max_duration_days,
      default_priority: plan.default_priority
    }
  }

  private async assertNoOverlappingPromotion({
    jobId,
    type,
    startsAt,
    endsAt,
    excludePromotionId
  }: {
    jobId: ObjectId
    type: JobPromotionType
    startsAt: Date
    endsAt: Date
    excludePromotionId?: ObjectId
  }) {
    const duplicated = await databaseService.jobPromotions.findOne({
      ...(excludePromotionId ? { _id: { $ne: excludePromotionId } } : {}),
      job_id: jobId,
      type,
      status: { $in: [JobPromotionStatus.ACTIVE, JobPromotionStatus.SCHEDULED] },
      starts_at: { $lt: endsAt },
      ends_at: { $gt: startsAt }
    })

    if (duplicated) {
      throw new AppError({
        statusCode: StatusCodes.CONFLICT,
        message: UserMessages.JOB_PROMOTION_DUPLICATED
      })
    }
  }

  private getPromotionProjection() {
    return {
      $project: {
        _id: 1,
        job_id: 1,
        company_id: 1,
        plan_id: 1,
        plan_snapshot: 1,
        source: 1,
        type: 1,
        status: 1,
        starts_at: 1,
        ends_at: 1,
        priority: 1,
        amount_paid: 1,
        currency: 1,
        created_at: 1,
        updated_at: 1,
        job: {
          _id: '$job._id',
          title: '$job.title',
          location: '$job.location',
          job_type: '$job.job_type',
          level: '$job.level',
          status: '$job.status',
          moderation_status: '$job.moderation_status',
          published_at: '$job.published_at',
          expired_at: '$job.expired_at'
        },
        company: {
          _id: '$company._id',
          company_name: '$company.company_name',
          verified: '$company.verified',
          logo: '$company.logo'
        }
      }
    }
  }
}

const adminJobPromotionService = new AdminJobPromotionService()

export default adminJobPromotionService
