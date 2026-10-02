import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import JobCategory from '~/models/schema/client/job-categories.schema.js'

type JobCategoryPayload = {
  name?: string
  slug?: string
  parent_id?: string | null
  description?: string
  is_active?: boolean
  sort_order?: number
}

const vietnameseMap: Record<string, string> = {
  à: 'a', á: 'a', ạ: 'a', ả: 'a', ã: 'a', â: 'a', ầ: 'a', ấ: 'a', ậ: 'a', ẩ: 'a', ẫ: 'a', ă: 'a',ằ: 'a', ắ: 'a', ặ: 'a', ẳ: 'a', ẵ: 'a',
  è: 'e', é: 'e', ẹ: 'e', ẻ: 'e', ẽ: 'e', ê: 'e', ề: 'e', ế: 'e', ệ: 'e', ể: 'e', ễ: 'e',
  ì: 'i', í: 'i', ị: 'i', ỉ: 'i', ĩ: 'i',
  ò: 'o', ó: 'o', ọ: 'o', ỏ: 'o', õ: 'o', ô: 'o', ồ: 'o', ố: 'o', ộ: 'o', ổ: 'o',ỗ: 'o', ơ: 'o', ờ: 'o', ớ: 'o', ợ: 'o', ở: 'o', ỡ: 'o',
  ù: 'u', ú: 'u', ụ: 'u', ủ: 'u', ũ: 'u', ư: 'u', ừ: 'u', ứ: 'u', ự: 'u', ử: 'u', ữ: 'u',
  ỳ: 'y', ý: 'y', ỵ: 'y', ỷ: 'y', ỹ: 'y', đ: 'd'
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => vietnameseMap[char] || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizePayload(payload: JobCategoryPayload) {
  const name = payload.name?.trim()
  if (!name) throw new Error('Tên danh mục không được để trống')

  const slug = slugify(payload.slug || name)
  if (!slug) throw new Error('Slug danh mục không hợp lệ')

  return {
    name,
    slug,
    parent_id: payload.parent_id ? new ObjectId(payload.parent_id) : null,
    description: payload.description?.trim() || undefined,
    is_active: payload.is_active ?? true,
    sort_order: Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0
  }
}

class AdminJobCategoryService {
  async getCategories() {
    const categories = await databaseService.jobCategories
      .find({})
      .sort({ sort_order: 1, name: 1 })
      .toArray()

    const usage = await databaseService.jobs
      .aggregate<{ _id: ObjectId; total: number }>([
        { $unwind: '$category_ids' },
        { $group: { _id: '$category_ids', total: { $sum: 1 } } }
      ])
      .toArray()
    const usageMap = new Map(usage.map((item) => [String(item._id), item.total]))

    return categories.map((category) => ({
      ...category,
      job_count: usageMap.get(String(category._id)) || 0
    }))
  }

  async createCategory(payload: JobCategoryPayload) {
    const normalized = normalizePayload(payload)
    const existing = await databaseService.jobCategories.findOne({ slug: normalized.slug })
    if (existing) throw new Error('Slug danh mục đã tồn tại')

    if (normalized.parent_id) {
      const parent = await databaseService.jobCategories.findOne({ _id: normalized.parent_id })
      if (!parent) throw new Error('Danh mục cha không tồn tại')
    }

    const category = new JobCategory(normalized)
    const result = await databaseService.jobCategories.insertOne(category)
    return { ...category, _id: result.insertedId, job_count: 0 }
  }

  async updateCategory(categoryId: ObjectId, payload: JobCategoryPayload) {
    const normalized = normalizePayload(payload)
    const current = await databaseService.jobCategories.findOne({ _id: categoryId })
    if (!current) throw new Error('Danh mục không tồn tại')

    const existing = await databaseService.jobCategories.findOne({ slug: normalized.slug, _id: { $ne: categoryId } })
    if (existing) throw new Error('Slug danh mục đã tồn tại')

    if (normalized.parent_id) {
      if (String(normalized.parent_id) === String(categoryId)) {
        throw new Error('Danh mục cha không được trùng chính nó')
      }

      // Check circular reference: parent_id cannot be a descendant of categoryId
      let checkParentId: ObjectId | null = normalized.parent_id
      while (checkParentId) {
        if (String(checkParentId) === String(categoryId)) {
          throw new Error('Không thể chọn danh mục con hoặc cháu làm danh mục cha')
        }
        const parentCat: any = await databaseService.jobCategories.findOne({ _id: checkParentId })
        checkParentId = parentCat?.parent_id ? new ObjectId(parentCat.parent_id) : null
      }

      const parent = await databaseService.jobCategories.findOne({ _id: normalized.parent_id })
      if (!parent) throw new Error('Danh mục cha không tồn tại')
    }

    const updatedAt = new Date()
    await databaseService.jobCategories.updateOne(
      { _id: categoryId },
      {
        $set: {
          ...normalized,
          updated_at: updatedAt
        }
      }
    )

    return databaseService.jobCategories.findOne({ _id: categoryId })
  }

  async toggleCategory(categoryId: ObjectId, isActive: boolean) {
    const updatedAt = new Date()
    await databaseService.jobCategories.updateOne(
      { _id: categoryId },
      {
        $set: {
          is_active: isActive,
          updated_at: updatedAt
        }
      }
    )

    return databaseService.jobCategories.findOne({ _id: categoryId })
  }
}

const adminJobCategoryService = new AdminJobCategoryService()
export default adminJobCategoryService
