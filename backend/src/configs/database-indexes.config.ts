import { CreateIndexesOptions, Db, IndexSpecification } from 'mongodb'
import env from './env.config.js'
import logger from './logger.config.js'

type DatabaseIndexDefinition = {
  collection: string
  key: IndexSpecification
  option: CreateIndexesOptions & { name: string }
}

const ttlIndexes = [
  { collection: env.DB_REFRESH_TOKEN_NAME, field: 'expires_at' },
  { collection: env.DB_OTP_CODE_NAME, field: 'expires_at' }
]

const indexes: DatabaseIndexDefinition[] = [
  {
    collection: env.DB_USER_NAME,
    key: { email: 1 },
    option: { unique: true, name: 'email', collation: { locale: 'en', strength: 2 } }
  },
  {
    collection: env.DB_USER_NAME,
    key: { username: 1 },
    option: { unique: true, name: 'username' }
  },
  {
    collection: env.DB_REFRESH_TOKEN_NAME,
    key: { user_id: 1, jti: 1 },
    option: { unique: true, name: 'jti_user_id' }
  },
  {
    collection: env.DB_OTP_CODE_NAME,
    key: { code: 1 },
    option: { unique: true, name: 'code' }
  },
  {
    collection: env.DB_OTP_CODE_NAME,
    key: { user_id: 1 },
    option: { name: 'user_id' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { company_id: 1, updated_at: -1 },
    option: { name: 'company_id_updated_at' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { company_id: 1, status: 1, updated_at: -1 },
    option: { name: 'company_id_status_updated_at' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { moderation_status: 1, updated_at: -1 },
    option: { name: 'moderation_status_updated_at' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { status: 1, moderation_status: 1, expired_at: 1 },
    option: { name: 'status_moderation_status_expired_at' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { status: 1, expired_at: 1 },
    option: { name: 'status_expired_at' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { status: 1, updated_at: -1 },
    option: { name: 'status_updated_at' }
  },
  {
    collection: env.DB_JOB_NAME,
    key: { category_ids: 1, status: 1, moderation_status: 1, expired_at: 1 },
    option: { name: 'category_ids_public_status' }
  },
  {
    collection: env.DB_JOB_CATEGORY_NAME,
    key: { slug: 1 },
    option: { unique: true, name: 'slug_unique_job_category' }
  },
  {
    collection: env.DB_JOB_CATEGORY_NAME,
    key: { parent_id: 1, sort_order: 1 },
    option: { name: 'parent_id_sort_order' }
  },
  {
    collection: env.DB_JOB_CATEGORY_NAME,
    key: { is_active: 1, sort_order: 1 },
    option: { name: 'is_active_sort_order' }
  },
  {
    collection: env.DB_JOB_PROMOTION_NAME,
    key: { type: 1, status: 1, starts_at: 1, ends_at: 1, priority: -1 },
    option: { name: 'type_status_time_priority' }
  },
  {
    collection: env.DB_JOB_PROMOTION_NAME,
    key: { company_id: 1, created_at: -1 },
    option: { name: 'company_id_created_at' }
  },
  {
    collection: env.DB_JOB_PROMOTION_NAME,
    key: { job_id: 1, type: 1, status: 1, ends_at: -1 },
    option: { name: 'job_type_status_ends_at' }
  },
  {
    collection: env.DB_JOB_PROMOTION_NAME,
    key: { plan_id: 1, status: 1, starts_at: 1, ends_at: 1 },
    option: { name: 'plan_status_time' }
  },
  {
    collection: env.DB_JOB_PROMOTION_PLAN_NAME,
    key: { code: 1 },
    option: { unique: true, name: 'promotion_plan_code_unique' }
  },
  {
    collection: env.DB_JOB_PROMOTION_PLAN_NAME,
    key: { is_active: 1, sort_order: 1 },
    option: { name: 'promotion_plan_active_sort_order' }
  },
  {
    collection: env.DB_WALLET_NAME,
    key: { user_id: 1 },
    option: { unique: true, name: 'user_id_unique' }
  },
  {
    collection: env.DB_WALLET_TRANSACTION_NAME,
    key: { user_id: 1, created_at: -1 },
    option: { name: 'user_id_created_at' }
  },
  {
    collection: env.DB_WALLET_TRANSACTION_NAME,
    key: { wallet_id: 1, created_at: -1 },
    option: { name: 'wallet_id_created_at' }
  },
  {
    collection: env.DB_WALLET_TRANSACTION_NAME,
    key: { reference_type: 1, reference_id: 1 },
    option: { unique: true, name: 'reference_type_reference_id' }
  },
  {
    collection: env.DB_WALLET_TOPUP_ORDER_NAME,
    key: { order_code: 1 },
    option: { unique: true, name: 'order_code_unique' }
  },
  {
    collection: env.DB_WALLET_TOPUP_ORDER_NAME,
    key: { user_id: 1, created_at: -1 },
    option: { name: 'user_id_created_at_topup_order' }
  },
  {
    collection: env.DB_WALLET_TOPUP_ORDER_NAME,
    key: { status: 1, created_at: -1 },
    option: { name: 'status_created_at_topup_order' }
  },
  {
    collection: env.DB_WALLET_TOPUP_ORDER_NAME,
    key: { provider_transaction_id: 1 },
    option: {
      unique: true,
      name: 'provider_transaction_id_unique',
      partialFilterExpression: {
        provider_transaction_id: { $exists: true }
      }
    }
  },
  {
    collection: env.DB_NOTIFICATION_NAME,
    key: { user_id: 1, is_read: 1, created_at: -1 },
    option: { name: 'user_id_is_read_created_at_notification' }
  },
  {
    collection: env.DB_NOTIFICATION_NAME,
    key: { user_id: 1, created_at: -1 },
    option: { name: 'user_id_created_at_notification' }
  },
  {
    collection: env.DB_ADMIN_AUDIT_LOG_NAME,
    key: { admin_id: 1, created_at: -1 },
    option: { name: 'admin_id_created_at_audit_log' }
  },
  {
    collection: env.DB_ADMIN_AUDIT_LOG_NAME,
    key: { action: 1, created_at: -1 },
    option: { name: 'action_created_at_audit_log' }
  },
  {
    collection: env.DB_ADMIN_AUDIT_LOG_NAME,
    key: { target_type: 1, target_id: 1, created_at: -1 },
    option: { name: 'target_created_at_audit_log' }
  },
  {
    collection: env.DB_ADMIN_AUDIT_LOG_NAME,
    key: { created_at: -1 },
    option: { name: 'created_at_audit_log' }
  },
  {
    collection: env.DB_SYSTEM_SETTING_NAME,
    key: { key: 1 },
    option: { unique: true, name: 'key_unique_system_setting' }
  },
  {
    collection: env.DB_FAVORITE_JOB_NAME,
    key: { user_id: 1, job_id: 1 },
    option: { unique: true, name: 'user_id_job_id_unique' }
  },
  {
    collection: env.DB_FAVORITE_JOB_NAME,
    key: { user_id: 1, created_at: -1 },
    option: { name: 'user_id_created_at' }
  },
  {
    collection: env.DB_FAVORITE_JOB_NAME,
    key: { job_id: 1 },
    option: { name: 'job_id' }
  },
  {
    collection: env.DB_RESUME_NAME,
    key: { candidate_id: 1, updated_at: -1 },
    option: { name: 'candidate_id_updated_at' }
  },
  {
    collection: env.DB_RESUME_NAME,
    key: { candidate_id: 1, is_default: 1 },
    option: { name: 'candidate_id_is_default' }
  },
  {
    collection: env.DB_RESUME_NAME,
    key: { candidate_id: 1, is_default: 1 },
    option: {
      name: 'candidate_default_active_unique',
      unique: true,
      partialFilterExpression: {
        is_default: true,
        status: 'active'
      }
    }
  },
  {
    collection: env.DB_JOB_APPLICATION_NAME,
    key: { job_id: 1, candidate_id: 1 },
    option: { unique: true, name: 'job_id_candidate_id' }
  },
  {
    collection: env.DB_JOB_APPLICATION_NAME,
    key: { job_id: 1, status: 1, applied_at: -1 },
    option: { name: 'job_id_status_applied_at' }
  },
  {
    collection: env.DB_JOB_APPLICATION_NAME,
    key: { company_id: 1, status: 1, applied_at: -1 },
    option: { name: 'company_id_status_applied_at' }
  },
  {
    collection: env.DB_JOB_APPLICATION_NAME,
    key: { candidate_id: 1, applied_at: -1 },
    option: { name: 'candidate_id_applied_at' }
  },
  {
    collection: env.DB_CHAT_SESSION_NAME,
    key: { user_id: 1, updated_at: -1 },
    option: { name: 'user_id_updated_at' }
  }
]

export const setupDatabaseIndexes = async (db: Db) => {
  await setupTtlIndexes(db)
  await setupCollectionIndexes(db)
}

const setupTtlIndexes = async (db: Db) => {
  for (const item of ttlIndexes) {
    const indexName = `${item.field}_ttl`
    const collection = db.collection(item.collection)
    const exists = await collection.indexExists(indexName).catch(() => false)

    if (!exists) {
      await collection.createIndex({ [item.field]: 1 }, { expireAfterSeconds: 0, name: indexName })
    }
  }

  logger.debug('TTL indexes initialized')
}

const setupCollectionIndexes = async (db: Db) => {
  for (const item of indexes) {
    const collection = db.collection(item.collection)
    const exists = await collection.indexExists(item.option.name).catch(() => false)

    if (!exists) {
      await collection.createIndex(item.key, item.option)
      logger.info({ collection: item.collection, index: item.option.name }, 'Database index created')
    }
  }

  logger.debug('Database indexes initialized')
}
