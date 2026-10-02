import axios, { AxiosError } from 'axios'
import env from '~/configs/env.config.js'
import databaseService from '~/configs/database.config.js'
import { WalletTopUpOrderStatus } from '~/constants/enums.js'
import adminSystemSettingService from '~/services/admin/system-setting.service.js'
import { maskSecret } from '~/utils/systemSettingsSecret.util.js'

type SePayTransactionsResponse = {
  status?: string
  data?: unknown[]
}

class AdminSePayService {
  async getConfigStatus() {
    const sePayConfig = await adminSystemSettingService.getSePayConfig()
    const secretStatus = await adminSystemSettingService.getSePaySecretStatus()

    return {
      provider: 'sepay',
      api_token_configured: secretStatus.api_token_configured,
      api_token_source: secretStatus.api_token_source,
      api_token_preview: secretStatus.api_token_preview,
      bank_account_id_configured: Boolean(sePayConfig.bank_account_id),
      bank_account_id: sePayConfig.bank_account_id,
      bank_short_name: sePayConfig.bank_short_name,
      bank_account_number_configured: Boolean(sePayConfig.bank_account_number),
      bank_account_number_preview: maskSecret(sePayConfig.bank_account_number, 4),
      bank_account_holder_name: sePayConfig.bank_account_holder_name,
      webhook_secret_configured: secretStatus.webhook_secret_configured,
      webhook_secret_source: secretStatus.webhook_secret_source,
      webhook_secret_preview: secretStatus.webhook_secret_preview,
      webhook_path: '/api/v1/check-payment',
      webhook_url: `${env.FRONTEND_URL.replace(/\/$/, '')}/api/v1/check-payment`,
      editable_in_admin: true,
      secret_editable_in_admin: true
    }
  }

  async testConnection() {
    const sePayConfig = await adminSystemSettingService.getSePayConfig()
    const apiToken = await adminSystemSettingService.getSePayApiToken()

    if (!apiToken || !sePayConfig.bank_account_id) {
      return {
        connected: false,
        reason: 'missing_config',
        message: 'Thiếu SEPAY_API_TOKEN hoặc SEPAY_BANK_ACCOUNT_ID'
      }
    }

    try {
      const response = await axios.get<SePayTransactionsResponse>('https://userapi.sepay.vn/v2/transactions', {
        headers: {
          Authorization: `Bearer ${apiToken}`
        },
        params: {
          bank_account_id: sePayConfig.bank_account_id,
          limit: 1
        },
        timeout: 8000
      })

      return {
        connected: true,
        provider_status: response.data.status || null,
        sample_count: Array.isArray(response.data.data) ? response.data.data.length : 0,
        checked_at: new Date()
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>

      return {
        connected: false,
        reason: 'provider_error',
        status_code: axiosError.response?.status || null,
        message: axiosError.response?.data?.message || axiosError.message,
        checked_at: new Date()
      }
    }
  }

  async getDiagnostics({ recentLimit }: { recentLimit: number }) {
    const statusValues = [
      WalletTopUpOrderStatus.PENDING,
      WalletTopUpOrderStatus.PAID,
      WalletTopUpOrderStatus.FAILED,
      WalletTopUpOrderStatus.CANCELLED,
      WalletTopUpOrderStatus.EXPIRED
    ]
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      statusCounts,
      pendingOlderThanOneHour,
      paidLast24Hours,
      webhookReceivedLast24Hours,
      recentOrders,
      latestWebhookOrder
    ] = await Promise.all([
      databaseService.walletTopUpOrders
        .aggregate<{ _id: WalletTopUpOrderStatus; count: number }>([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ])
        .toArray(),
      databaseService.walletTopUpOrders.countDocuments({
        status: WalletTopUpOrderStatus.PENDING,
        created_at: { $lte: oneHourAgo }
      }),
      databaseService.walletTopUpOrders.countDocuments({
        status: WalletTopUpOrderStatus.PAID,
        paid_at: { $gte: oneDayAgo }
      }),
      databaseService.walletTopUpOrders.countDocuments({
        webhook_payload: { $exists: true },
        updated_at: { $gte: oneDayAgo }
      }),
      databaseService.walletTopUpOrders
        .aggregate([
          { $sort: { updated_at: -1 } },
          { $limit: recentLimit },
          {
            $lookup: {
              from: databaseService.users.collectionName,
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: {
              path: '$user',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              webhook_payload: 0,
              provider_payload: 0
            }
          },
          {
            $addFields: {
              user_id: {
                $cond: [
                  { $ifNull: ['$user._id', false] },
                  {
                    _id: '$user._id',
                    fullName: '$user.fullName',
                    username: '$user.username',
                    email: '$user.email'
                  },
                  '$user_id'
                ]
              }
            }
          }
        ])
        .toArray(),
      databaseService.walletTopUpOrders.findOne(
        {
          webhook_payload: { $exists: true }
        },
        {
          projection: {
            _id: 1,
            order_code: 1,
            status: 1,
            provider_transaction_id: 1,
            updated_at: 1,
            paid_at: 1
          },
          sort: {
            updated_at: -1
          }
        }
      )
    ])

    const countsByStatus = statusValues.reduce<Record<WalletTopUpOrderStatus, number>>(
      (result, status) => ({
        ...result,
        [status]: statusCounts.find((item) => item._id === status)?.count || 0
      }),
      {
        [WalletTopUpOrderStatus.PENDING]: 0,
        [WalletTopUpOrderStatus.PAID]: 0,
        [WalletTopUpOrderStatus.FAILED]: 0,
        [WalletTopUpOrderStatus.CANCELLED]: 0,
        [WalletTopUpOrderStatus.EXPIRED]: 0
      }
    )

    return {
      config: await this.getConfigStatus(),
      order_summary: {
        by_status: countsByStatus,
        pending_older_than_1h: pendingOlderThanOneHour,
        paid_last_24h: paidLast24Hours,
        webhook_received_last_24h: webhookReceivedLast24Hours
      },
      latest_webhook_order: latestWebhookOrder,
      recent_orders: recentOrders
    }
  }
}

const adminSePayService = new AdminSePayService()

export default adminSePayService
