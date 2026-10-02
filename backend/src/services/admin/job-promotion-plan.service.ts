import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import databaseService from '~/configs/database.config.js'
import { JobPromotionSource, JobPromotionType } from '~/constants/enums.js'
import { AppError } from '~/errors/app-error.js'
import JobPromotionPlan, { JobPromotionPlanInput } from '~/models/schema/client/jobPromotionPlans.schema.js'

const DEFAULT_PLANS: JobPromotionPlanInput[] = [
  {
    code: 'homepage-standard',
    name: 'Nổi bật trang chủ - Tiêu chuẩn',
    description: 'Hiển thị tin tuyển dụng trong khu vực nổi bật trên trang chủ.',
    type: JobPromotionType.HOMEPAGE_FEATURED,
    daily_price: 50000,
    currency: 'VND',
    min_duration_days: 1,
    max_duration_days: 30,
    default_priority: 100,
    is_active: true,
    sort_order: 10
  },
  {
    code: 'homepage-premium',
    name: 'Nổi bật trang chủ - Cao cấp',
    description: 'Ưu tiên cao hơn trong khu vực tin tuyển dụng nổi bật trên trang chủ.',
    type: JobPromotionType.HOMEPAGE_FEATURED,
    daily_price: 90000,
    currency: 'VND',
    min_duration_days: 3,
    max_duration_days: 30,
    default_priority: 200,
    is_active: true,
    sort_order: 20
  }
]

class AdminJobPromotionPlanService {
  async ensureDefaultPlans() {
    for (const input of DEFAULT_PLANS) {
      const plan = new JobPromotionPlan(input)
      try {
        await databaseService.jobPromotionPlans.updateOne(
          { code: plan.code },
          { $setOnInsert: plan },
          { upsert: true }
        )
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error
      }
    }

    const standard = await databaseService.jobPromotionPlans.findOne({ code: 'homepage-standard' })
    if (standard?._id) {
      const planSnapshot = {
        code: standard.code,
        name: standard.name,
        type: standard.type,
        daily_price: standard.daily_price,
        currency: standard.currency,
        min_duration_days: standard.min_duration_days,
        max_duration_days: standard.max_duration_days,
        default_priority: standard.default_priority
      }

      await databaseService.jobPromotions.updateMany(
        { amount_paid: { $gt: 0 }, source: { $ne: JobPromotionSource.EMPLOYER_PURCHASE } },
        { $set: { source: JobPromotionSource.EMPLOYER_PURCHASE, updated_at: new Date() } }
      )
      await databaseService.jobPromotions.updateMany(
        { plan_id: { $exists: false }, amount_paid: { $gt: 0 } },
        {
          $set: {
            plan_id: standard._id,
            plan_snapshot: planSnapshot,
            source: JobPromotionSource.EMPLOYER_PURCHASE,
            updated_at: new Date()
          }
        }
      )
      await databaseService.jobPromotions.updateMany(
        {
          plan_id: { $exists: false },
          $or: [{ amount_paid: { $exists: false } }, { amount_paid: { $lte: 0 } }]
        },
        {
          $set: {
            plan_id: standard._id,
            plan_snapshot: planSnapshot,
            source: JobPromotionSource.ADMIN_GRANT,
            updated_at: new Date()
          }
        }
      )
    }
  }

  async getPlans({ activeOnly = false } = {}) {
    const plans = await databaseService.jobPromotionPlans
      .find(activeOnly ? { is_active: true } : {})
      .sort({ sort_order: 1, created_at: 1 })
      .toArray()

    const usage = await databaseService.jobPromotions
      .aggregate<{ _id: ObjectId; total: number; active_count: number }>([
        {
          $group: {
            _id: '$plan_id',
            total: { $sum: 1 },
            active_count: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            }
          }
        }
      ])
      .toArray()
    const usageMap = new Map(usage.map((u) => [String(u._id), u]))

    return plans.map((plan) => ({
      ...plan,
      total_promotions: usageMap.get(String(plan._id))?.total || 0,
      active_promotions: usageMap.get(String(plan._id))?.active_count || 0
    }))
  }

  async getPlanByIdOrThrow(planId: ObjectId, activeOnly = false) {
    const plan = await databaseService.jobPromotionPlans.findOne({
      _id: planId,
      ...(activeOnly ? { is_active: true } : {})
    })
    if (!plan) {
      throw new AppError({ statusCode: StatusCodes.NOT_FOUND, message: 'Không tìm thấy gói quảng cáo.' })
    }
    return plan
  }

  async createPlan(input: JobPromotionPlanInput) {
    const plan = new JobPromotionPlan(input)
    const duplicated = await databaseService.jobPromotionPlans.findOne({ code: plan.code })
    if (duplicated) {
      throw new AppError({ statusCode: StatusCodes.CONFLICT, message: 'Mã gói quảng cáo đã tồn tại.' })
    }
    try {
      const result = await databaseService.jobPromotionPlans.insertOne(plan)
      return this.getPlanByIdOrThrow(result.insertedId)
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError({ statusCode: StatusCodes.CONFLICT, message: 'Mã gói quảng cáo đã tồn tại.' })
      }
      throw error
    }
  }

  async updatePlan(planId: ObjectId, input: Partial<JobPromotionPlanInput>) {
    const current = await this.getPlanByIdOrThrow(planId)
    const nextMinDays = input.min_duration_days ?? current.min_duration_days
    const nextMaxDays = input.max_duration_days ?? current.max_duration_days
    if (nextMinDays > nextMaxDays) {
      throw new AppError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Số ngày tối đa phải lớn hơn hoặc bằng số ngày tối thiểu.'
      })
    }
    const update = {
      ...(input.code !== undefined ? { code: input.code.trim().toLowerCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.daily_price !== undefined ? { daily_price: input.daily_price } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.min_duration_days !== undefined ? { min_duration_days: input.min_duration_days } : {}),
      ...(input.max_duration_days !== undefined ? { max_duration_days: input.max_duration_days } : {}),
      ...(input.default_priority !== undefined ? { default_priority: input.default_priority } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
      updated_at: new Date()
    }
    try {
      await databaseService.jobPromotionPlans.updateOne({ _id: planId }, { $set: update })
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError({ statusCode: StatusCodes.CONFLICT, message: 'Mã gói quảng cáo đã tồn tại.' })
      }
      throw error
    }
    return this.getPlanByIdOrThrow(planId)
  }

  async deletePlan(planId: ObjectId) {
    const plan = await this.getPlanByIdOrThrow(planId)
    const used = await databaseService.jobPromotions.countDocuments({ plan_id: planId })
    if (used > 0) {
      throw new AppError({
        statusCode: StatusCodes.CONFLICT,
        message: 'Gói đã được sử dụng. Hãy tắt gói thay vì xóa để giữ lịch sử.'
      })
    }
    await databaseService.jobPromotionPlans.deleteOne({ _id: planId })
    return plan
  }
}

const adminJobPromotionPlanService = new AdminJobPromotionPlanService()
export default adminJobPromotionPlanService
