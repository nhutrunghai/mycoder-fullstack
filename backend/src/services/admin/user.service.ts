import { buildUploadThingFileUrl } from '~/utils/avatar.util.js'
import RedisService from '~/configs/redis.config.js'
import _ from 'lodash'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config.js'
import { UserRole, UserStatus, WalletStatus, WalletTopUpOrderStatus } from '~/constants/enums.js'

class AdminUserService {
  async getUsers({
    userId,
    role,
    status,
    keyword,
    page,
    limit
  }: {
    userId?: ObjectId
    role?: UserRole
    status?: UserStatus
    keyword?: string
    page: number
    limit: number
  }) {
    const query: {
      _id?: ObjectId
      role?: UserRole
      status?: UserStatus
      $or?: Array<{
        email?: { $regex: string; $options: string }
        username?: { $regex: string; $options: string }
        fullName?: { $regex: string; $options: string }
      }>
    } = {}

    if (userId) {
      query._id = userId
    }

    if (role !== undefined) {
      query.role = role
    }

    if (status !== undefined) {
      query.status = status
    }

    if (keyword) {
      const escapedKeyword = _.escapeRegExp(keyword)

      query.$or = [
        { email: { $regex: escapedKeyword, $options: 'i' } },
        { username: { $regex: escapedKeyword, $options: 'i' } },
        { fullName: { $regex: escapedKeyword, $options: 'i' } }
      ]
    }

    const [users, total, statsResult] = await Promise.all([
      databaseService.users
        .find(query, {
          projection: {
            password: 0
          }
        })
        .sort({ updated_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      databaseService.users.countDocuments(query),
      databaseService.users
        .aggregate<{
          total: number
          active: number
          banned: number
          deleted: number
          admins: number
          unverified: number
        }>([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$status', UserStatus.ACTIVE] }, 1, 0] } },
              banned: { $sum: { $cond: [{ $eq: ['$status', UserStatus.BANNED] }, 1, 0] } },
              deleted: { $sum: { $cond: [{ $eq: ['$status', UserStatus.DELETED] }, 1, 0] } },
              admins: { $sum: { $cond: [{ $eq: ['$role', UserRole.ADMIN] }, 1, 0] } },
              unverified: {
                $sum: {
                  $cond: [{ $or: [{ $eq: ['$is_verified', false] }, { $not: ['$is_verified'] }] }, 1, 0]
                }
              }
            }
          }
        ])
        .toArray()
    ])

    const stats = statsResult[0] || {
      total: 0,
      active: 0,
      banned: 0,
      deleted: 0,
      admins: 0,
      unverified: 0
    }

    return {
      users,
      stats: {
        total: stats.total || 0,
        active: stats.active || 0,
        banned: stats.banned || 0,
        deleted: stats.deleted || 0,
        admins: stats.admins || 0,
        unverified: stats.unverified || 0
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async updateUserStatus(userId: ObjectId, status: UserStatus) {
    const updatedUser = await databaseService.users.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          status,
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after',
        projection: {
          password: 0
        }
      }
    )

    const redis = RedisService.getInstance()
    const userKey = `blacklist:user:${userId.toString()}`

    if (status === UserStatus.BANNED || status === UserStatus.DELETED) {
      await databaseService.refreshTokens.deleteMany({ user_id: userId })
      await redis.set(userKey, '1', 'EX', 7 * 24 * 60 * 60)
    } else if (status === UserStatus.ACTIVE) {
      await redis.del(userKey)
    }

    return updatedUser
  }

  async updateUserRole(userId: ObjectId, role: UserRole) {
    const updatedUser = await databaseService.users.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          role,
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after',
        projection: {
          password: 0
        }
      }
    )

    await databaseService.refreshTokens.deleteMany({ user_id: userId })

    return updatedUser
  }

  async getUserWallet(userId: ObjectId) {
    const now = new Date()

    return databaseService.wallets.findOneAndUpdate(
      {
        user_id: userId
      },
      {
        $setOnInsert: {
          user_id: userId,
          balance: 0,
          currency: 'VND',
          status: WalletStatus.ACTIVE,
          created_at: now,
          updated_at: now
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
  }

  async getUserTopUpOrdersForAdmin({
    userId,
    status,
    page,
    limit
  }: {
    userId: ObjectId
    status?: WalletTopUpOrderStatus
    page: number
    limit: number
  }) {
    const query: {
      user_id: ObjectId
      status?: WalletTopUpOrderStatus
    } = {
      user_id: userId
    }

    if (status) {
      query.status = status
    }

    const [orders, total] = await Promise.all([
      databaseService.walletTopUpOrders
        .find(query)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      databaseService.walletTopUpOrders.countDocuments(query)
    ])

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }
  async getUserEmployerCompany(userId: ObjectId) {
    return databaseService.companies.findOne({ user_id: userId })
  }

  async getUserApplicationsForAdmin({
    userId,
    page = 1,
    limit = 20
  }: {
    userId: ObjectId
    page?: number
    limit?: number
  }) {
    const match = { candidate_id: userId }

    const [applications, total] = await Promise.all([
      databaseService.jobApplications
        .aggregate([
          { $match: match },
          {
            $lookup: {
              from: databaseService.jobs.collectionName,
              localField: 'job_id',
              foreignField: '_id',
              as: 'job'
            }
          },
          {
            $unwind: {
              path: '$job',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $lookup: {
              from: databaseService.companies.collectionName,
              localField: 'company_id',
              foreignField: '_id',
              as: 'company'
            }
          },
          {
            $unwind: {
              path: '$company',
              preserveNullAndEmptyArrays: true
            }
          },
          { $sort: { applied_at: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              job_id: 1,
              company_id: 1,
              candidate_id: 1,
              status: 1,
              applied_at: 1,
              updated_at: 1,
              job: {
                _id: '$job._id',
                title: '$job.title',
                slug: '$job.slug',
                status: '$job.status',
                moderation_status: '$job.moderation_status'
              },
              company: {
                _id: '$company._id',
                company_name: '$company.company_name',
                logo: '$company.logo',
                logo_file_key: '$company.logo_file_key',
                verified: '$company.verified'
              }
            }
          }
        ])
        .toArray(),
      databaseService.jobApplications.countDocuments(match)
    ])

    return {
      applications: applications.map((app: any) => ({
        ...app,
        company: app.company
          ? {
              ...app.company,
              logo: buildUploadThingFileUrl(app.company.logo_file_key) || app.company.logo || ''
            }
          : null
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }
}

const adminUserService = new AdminUserService()


export default adminUserService