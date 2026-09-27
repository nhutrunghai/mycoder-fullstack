import { ClientSession, Collection, Db, MongoClient } from 'mongodb'
import env from './env.config.js'
import { setupDatabaseIndexes } from './database-indexes.config.js'
import Company from '~/models/schema/client/companies.schema.js'
import FavoriteJob from '~/models/schema/client/favoriteJobs.schema.js'
import JobApplication from '~/models/schema/client/jobApplications.schema.js'
import Job from '~/models/schema/client/jobs.schema.js'
import JobCategory from '~/models/schema/client/job-categories.schema.js'
import JobPromotion from '~/models/schema/client/jobPromotions.schema.js'
import JobPromotionPlan from '~/models/schema/client/jobPromotionPlans.schema.js'
import OtpCode from '~/models/schema/client/otpCodes.schema.js'
import Resume from '~/models/schema/client/resumes.schema.js'
import RefreshToken from '~/models/schema/client/refreshTokens.schema.js'
import User from '~/models/schema/client/user.schema.js'
import ChatSession from '~/models/schema/client/chatSessions.schema.js'
import Wallet from '~/models/schema/client/wallets.schema.js'
import WalletTopUpOrder from '~/models/schema/client/walletTopUpOrders.schema.js'
import WalletTransaction from '~/models/schema/client/walletTransactions.schema.js'
import Notification from '~/models/schema/client/notifications.schema.js'
import AdminAuditLog from '~/models/schema/admin/adminAuditLogs.schema.js'
import SystemSetting from '~/models/schema/system/systemSettings.schema.js'
import logger from './logger.config.js'

class DatabaseService {
  private client: MongoClient
  private db: Db

  constructor() {
    this.client = new MongoClient(env.DB_URL, { ignoreUndefined: true })
    this.db = this.client.db(env.DB_NAME)
  }

  async connect() {
    try {
      await this.db.command({ ping: 1 })
      logger.info({ database: env.DB_NAME }, 'MongoDB connected')
      await setupDatabaseIndexes(this.db)
    } catch (error) {
      logger.error({ err: error }, 'MongoDB connection error')
      throw error
    }
  }

  get users(): Collection<User> {
    return this.db.collection(env.DB_USER_NAME)
  }

  get companies(): Collection<Company> {
    return this.db.collection(env.DB_COMPANY_NAME)
  }

  get jobs(): Collection<Job> {
    return this.db.collection(env.DB_JOB_NAME)
  }

  get jobCategories(): Collection<JobCategory> {
    return this.db.collection(env.DB_JOB_CATEGORY_NAME)
  }

  get jobPromotions(): Collection<JobPromotion> {
    return this.db.collection(env.DB_JOB_PROMOTION_NAME)
  }

  get jobPromotionPlans(): Collection<JobPromotionPlan> {
    return this.db.collection(env.DB_JOB_PROMOTION_PLAN_NAME)
  }

  get wallets(): Collection<Wallet> {
    return this.db.collection(env.DB_WALLET_NAME)
  }

  get walletTransactions(): Collection<WalletTransaction> {
    return this.db.collection(env.DB_WALLET_TRANSACTION_NAME)
  }

  get walletTopUpOrders(): Collection<WalletTopUpOrder> {
    return this.db.collection(env.DB_WALLET_TOPUP_ORDER_NAME)
  }

  get notifications(): Collection<Notification> {
    return this.db.collection(env.DB_NOTIFICATION_NAME)
  }

  get adminAuditLogs(): Collection<AdminAuditLog> {
    return this.db.collection(env.DB_ADMIN_AUDIT_LOG_NAME)
  }

  get systemSettings(): Collection<SystemSetting> {
    return this.db.collection(env.DB_SYSTEM_SETTING_NAME)
  }

  get favoriteJobs(): Collection<FavoriteJob> {
    return this.db.collection(env.DB_FAVORITE_JOB_NAME)
  }

  get resumes(): Collection<Resume> {
    return this.db.collection(env.DB_RESUME_NAME)
  }

  get jobApplications(): Collection<JobApplication> {
    return this.db.collection(env.DB_JOB_APPLICATION_NAME)
  }

  get refreshTokens(): Collection<RefreshToken> {
    return this.db.collection(env.DB_REFRESH_TOKEN_NAME)
  }

  get otpCodes(): Collection<OtpCode> {
    return this.db.collection(env.DB_OTP_CODE_NAME)
  }

  get chatSessions(): Collection<ChatSession> {
    return this.db.collection(env.DB_CHAT_SESSION_NAME)
  }

  async withTransaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.client.startSession()

    try {
      return await session.withTransaction(() => callback(session))
    } finally {
      await session.endSession()
    }
  }
}

const databaseService = new DatabaseService()
export default databaseService
