import { StatusCodes } from 'http-status-codes'
import axios from 'axios'
import { ClientSession, ObjectId } from 'mongodb'
import crypto from 'node:crypto'
import databaseService from '~/configs/database.config.js'
import {
  NotificationType,
  WalletTopUpOrderStatus,
  WalletTransactionDirection,
  WalletTransactionReferenceType,
  WalletTransactionStatus,
  WalletTransactionType
} from '~/constants/enums.js'
import UserMessages from '~/constants/messages/index.js'
import { AppError } from '~/errors/app-error.js'
import Notification from '~/models/schema/client/notifications.schema.js'
import WalletTopUpOrder from '~/models/schema/client/walletTopUpOrders.schema.js'
import WalletTransaction from '~/models/schema/client/walletTransactions.schema.js'
import adminSystemSettingService from '~/services/admin/system-setting.service.js'
import walletService from '~/services/client/wallet.service.js'
import logger from '~/configs/logger.config.js'

type SePayWebhookPayload = Record<string, unknown>

type SePayTransactionsResponse = {
  status?: string
  data?: SePayWebhookPayload[]
}

type NormalizedWebhookPayload = {
  transaction_id?: string
  reference_code?: string
  transfer_type?: string
  transfer_amount?: number
  code?: string
  content?: string
  gateway?: string
  account_number?: string
  transaction_date?: string
  raw: SePayWebhookPayload
}

class WalletTopUpService {
  async createTopUpOrder({ userId, amount }: { userId: ObjectId; amount: number }) {
    if (amount <= 0) {
      throw new AppError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: UserMessages.WALLET_AMOUNT_INVALID
      })
    }

    const wallet = await walletService.getOrCreateWallet(userId)

    if (!wallet || wallet.status !== 'active') {
      throw new AppError({
        statusCode: StatusCodes.FORBIDDEN,
        message: UserMessages.WALLET_LOCKED
      })
    }

    const orderCode = this.generateOrderCode()
    const paymentInfo = await this.getFixedBankPaymentInfo({ amount, orderCode })
    const sePayConfig = await adminSystemSettingService.getSePayConfig()

    const order = new WalletTopUpOrder({
      user_id: userId,
      wallet_id: wallet._id as ObjectId,
      order_code: orderCode,
      amount,
      currency: wallet.currency,
      status: WalletTopUpOrderStatus.PENDING,
      provider: 'sepay',
      provider_bank_account_id: sePayConfig.bank_account_id || undefined,
      provider_bank_name: paymentInfo.bank_name,
      provider_account_number: paymentInfo.account_number,
      provider_account_holder_name: paymentInfo.account_holder_name,
      provider_qr_code_url: paymentInfo.qr_code_url,
      provider_payload: paymentInfo as unknown as Record<string, unknown>
    })

    const result = await databaseService.walletTopUpOrders.insertOne(order)

    return {
      order: {
        ...order,
        _id: result.insertedId
      },
      payment: {
        provider: 'sepay',
        bank_name: paymentInfo.bank_name,
        bank_short_name: paymentInfo.bank_short_name,
        account_number: paymentInfo.account_number,
        account_holder_name: paymentInfo.account_holder_name,
        amount: paymentInfo.amount,
        order_code: paymentInfo.order_code,
        transfer_content: paymentInfo.transfer_content,
        qr_code_url: paymentInfo.qr_code_url,
        expired_at: null
      }
    }
  }

  async getTopUpOrderByCode({ userId, orderCode }: { userId: ObjectId; orderCode: string }) {
    let order = await databaseService.walletTopUpOrders.findOne({
      user_id: userId,
      order_code: orderCode
    })

    if (!order) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.WALLET_TOP_UP_ORDER_NOT_FOUND
      })
    }

    if (order.status === WalletTopUpOrderStatus.PENDING) {
      await this.syncPendingOrderFromSePay(order)
      order = await databaseService.walletTopUpOrders.findOne({
        user_id: userId,
        order_code: orderCode
      })
    }

    return order
  }

  async processWebhook(rawPayload: SePayWebhookPayload) {
    const payload = this.normalizeWebhookPayload(rawPayload)

    if (!payload.transfer_type || !['in', 'credit'].includes(payload.transfer_type)) {
      return {
        success: true,
        processed: false,
        reason: 'ignored_transfer_type'
      }
    }

    if (!payload.code) {
      return {
        success: true,
        processed: false,
        reason: 'missing_order_code'
      }
    }

    const order = await databaseService.walletTopUpOrders.findOne({
      order_code: payload.code
    })

    if (!order) {
      return {
        success: true,
        processed: false,
        reason: 'order_not_found'
      }
    }

    if (order.status === WalletTopUpOrderStatus.PAID) {
      return {
        success: true,
        processed: false,
        reason: 'already_paid'
      }
    }

    if (!payload.transfer_amount || payload.transfer_amount < order.amount) {
      await databaseService.walletTopUpOrders.updateOne(
        { _id: order._id },
        {
          $set: {
            webhook_payload: payload.raw,
            updated_at: new Date()
          }
        }
      )

      return {
        success: true,
        processed: false,
        reason: 'amount_mismatch'
      }
    }

    await this.completeOrderPayment(order, payload)

    return {
      success: true,
      processed: true,
      reason: 'wallet_credited'
    }
  }

  private async completeOrderPayment(order: WalletTopUpOrder, payload: NormalizedWebhookPayload) {
    try {
      await databaseService.withTransaction(async (session) => {
        await this.completeOrderPaymentInSession(order, payload, session)
      })
    } catch (error) {
      if (!this.isTransactionUnsupportedError(error)) {
        throw error
      }

      await this.completeOrderPaymentWithoutTransaction(order, payload)
    }
  }

  private async syncPendingOrderFromSePay(order: WalletTopUpOrder) {
    const sePayConfig = await adminSystemSettingService.getSePayConfig()
    const apiToken = await adminSystemSettingService.getSePayApiToken()

    if (!apiToken || !sePayConfig.bank_account_id) {
      return
    }

    try {
      const transactions = await this.fetchRecentSePayTransactions()
      const matchedTransaction = transactions.find((transaction) => this.isMatchingSePayTransaction(order, transaction))

      if (!matchedTransaction) {
        return
      }

      await this.processWebhook(matchedTransaction)
    } catch (error) {
      logger.warn({ err: error, order_code: order.order_code }, 'SePay pending order sync failed')
    }
  }

  private async fetchRecentSePayTransactions() {
    const sePayConfig = await adminSystemSettingService.getSePayConfig()
    const apiToken = await adminSystemSettingService.getSePayApiToken()

    const response = await axios.get<SePayTransactionsResponse>('https://userapi.sepay.vn/v2/transactions', {
      headers: {
        Authorization: `Bearer ${apiToken}`
      },
      params: {
        bank_account_id: sePayConfig.bank_account_id,
        limit: 20
      },
      timeout: 8000
    })

    return Array.isArray(response.data.data) ? response.data.data : []
  }

  private isMatchingSePayTransaction(order: WalletTopUpOrder, transaction: SePayWebhookPayload) {
    const payload = this.normalizeWebhookPayload(transaction)

    return (
      payload.code === order.order_code &&
      Boolean(payload.transfer_amount && payload.transfer_amount >= order.amount) &&
      Boolean(payload.transfer_type && ['in', 'credit'].includes(payload.transfer_type))
    )
  }

  private async completeOrderPaymentInSession(
    order: WalletTopUpOrder,
    payload: NormalizedWebhookPayload,
    session: ClientSession
  ) {
    const paidAt = this.parseWebhookDate(payload.transaction_date) || new Date()

    const claimedOrder = await databaseService.walletTopUpOrders.findOneAndUpdate(
      {
        _id: order._id,
        status: WalletTopUpOrderStatus.PENDING
      },
      {
        $set: {
          status: WalletTopUpOrderStatus.PAID,
          paid_at: paidAt,
          provider_transaction_id: payload.transaction_id,
          provider_reference_code: payload.reference_code,
          webhook_payload: payload.raw,
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after',
        session
      }
    )

    if (!claimedOrder) {
      return
    }

    const updatedWallet = await databaseService.wallets.findOneAndUpdate(
      {
        _id: order.wallet_id
      },
      {
        $inc: {
          balance: order.amount
        },
        $set: {
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after',
        session
      }
    )

    if (!updatedWallet) {
      throw new AppError({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: UserMessages.SERVER_ERROR
      })
    }

    const transaction = new WalletTransaction({
      wallet_id: order.wallet_id,
      user_id: order.user_id,
      type: WalletTransactionType.TOP_UP,
      direction: WalletTransactionDirection.CREDIT,
      amount: order.amount,
      currency: order.currency,
      balance_before: updatedWallet.balance - order.amount,
      balance_after: updatedWallet.balance,
      status: WalletTransactionStatus.SUCCEEDED,
      reference_type: WalletTransactionReferenceType.PAYMENT,
      reference_id: order._id,
      description: `Nap tien vi qua SePay - ${order.order_code}`,
      created_at: paidAt,
      updated_at: paidAt
    })

    await databaseService.walletTransactions.insertOne(transaction, {
      session
    })

    const notification = new Notification({
      user_id: order.user_id,
      type: NotificationType.WALLET_TOPUP_SUCCEEDED,
      title: 'Nạp tiền thành công',
      content: `Bạn đã nạp thành công ${order.amount} ${order.currency} vào ví.`,
      data: {
        order_id: String(order._id),
        order_code: order.order_code,
        wallet_id: String(order.wallet_id)
      },
      created_at: paidAt,
      updated_at: paidAt
    })

    await databaseService.notifications.insertOne(notification, {
      session
    })
  }

  private async completeOrderPaymentWithoutTransaction(order: WalletTopUpOrder, payload: NormalizedWebhookPayload) {
    const paidAt = this.parseWebhookDate(payload.transaction_date) || new Date()
    const claimedOrder = await databaseService.walletTopUpOrders.findOneAndUpdate(
      {
        _id: order._id,
        status: WalletTopUpOrderStatus.PENDING
      },
      {
        $set: {
          status: WalletTopUpOrderStatus.PAID,
          paid_at: paidAt,
          provider_transaction_id: payload.transaction_id,
          provider_reference_code: payload.reference_code,
          webhook_payload: payload.raw,
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    )

    if (!claimedOrder) {
      return
    }

    const updatedWallet = await databaseService.wallets.findOneAndUpdate(
      {
        _id: order.wallet_id
      },
      {
        $inc: {
          balance: order.amount
        },
        $set: {
          updated_at: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    )

    if (!updatedWallet) {
      throw new AppError({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: UserMessages.SERVER_ERROR
      })
    }

    const transaction = new WalletTransaction({
      wallet_id: order.wallet_id,
      user_id: order.user_id,
      type: WalletTransactionType.TOP_UP,
      direction: WalletTransactionDirection.CREDIT,
      amount: order.amount,
      currency: order.currency,
      balance_before: updatedWallet.balance - order.amount,
      balance_after: updatedWallet.balance,
      status: WalletTransactionStatus.SUCCEEDED,
      reference_type: WalletTransactionReferenceType.PAYMENT,
      reference_id: order._id,
      description: `Nap tien vi qua SePay - ${order.order_code}`,
      created_at: paidAt,
      updated_at: paidAt
    })

    await databaseService.walletTransactions.insertOne(transaction)

    const notification = new Notification({
      user_id: order.user_id,
      type: NotificationType.WALLET_TOPUP_SUCCEEDED,
      title: 'Nạp tiền thành công',
      content: `Bạn đã nạp thành công ${order.amount} ${order.currency} vào ví.`,
      data: {
        order_id: String(order._id),
        order_code: order.order_code,
        wallet_id: String(order.wallet_id)
      },
      created_at: paidAt,
      updated_at: paidAt
    })

    await databaseService.notifications.insertOne(notification)
  }

  private normalizeWebhookPayload(payload: SePayWebhookPayload): NormalizedWebhookPayload {
    const transferType =
      this.pickString(payload.transferType) || this.mapTransferType(this.pickString(payload.transfer_type))
    const transferAmountRaw = payload.transferAmount ?? payload.amount ?? payload.amount_in
    const content = this.pickString(payload.content) || this.pickString(payload.transaction_content)
    const code =
      this.pickString(payload.code) || this.pickString(payload.payment_code) || this.extractOrderCode(content)
    const transactionId = this.pickString(payload.id) || this.pickString(payload.transaction_id)
    const referenceCode =
      this.pickString(payload.referenceCode) ||
      this.pickString(payload.reference_code) ||
      this.pickString(payload.reference_number)
    const accountNumber = this.pickString(payload.accountNumber) || this.pickString(payload.account_number)
    const transactionDate = this.pickString(payload.transactionDate) || this.pickString(payload.transaction_date)

    return {
      transaction_id: transactionId,
      reference_code: referenceCode,
      transfer_type: transferType,
      transfer_amount: this.toNumber(transferAmountRaw),
      code,
      content,
      gateway: this.pickString(payload.gateway),
      account_number: accountNumber,
      transaction_date: transactionDate,
      raw: payload
    }
  }

  private generateOrderCode() {
    const suffix = crypto.randomBytes(5).toString('hex').toUpperCase()
    return `TOPUP${Date.now()}${suffix}`.slice(0, 32)
  }

  private async getFixedBankPaymentInfo({ amount, orderCode }: { amount: number; orderCode: string }) {
    const sePayConfig = await adminSystemSettingService.getSePayConfig()
    const bankShortName = sePayConfig.bank_short_name
    const accountNumber = sePayConfig.bank_account_number
    const accountHolderName = sePayConfig.bank_account_holder_name

    if (!accountNumber || !accountHolderName) {
      throw new AppError({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: UserMessages.SERVER_ERROR
      })
    }

    const qrParams = new URLSearchParams({
      amount: String(amount),
      addInfo: orderCode,
      accountName: accountHolderName
    })

    return {
      bank_name: bankShortName,
      bank_short_name: bankShortName,
      account_number: accountNumber,
      account_holder_name: accountHolderName,
      amount,
      order_code: orderCode,
      transfer_content: orderCode,
      qr_code_url: `https://img.vietqr.io/image/${bankShortName}-${accountNumber}-compact2.png?${qrParams.toString()}`
    }
  }

  private extractOrderCode(content?: string) {
    if (!content) {
      return undefined
    }

    const match = content.toUpperCase().match(/TOPUP[A-Z0-9]{8,32}/)
    return match?.[0]
  }

  private parseOptionalDate(value?: string | null) {
    if (!value) {
      return null
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private parseWebhookDate(value?: string) {
    if (!value) {
      return null
    }

    const normalized = value.replace(' ', 'T')
    const date = new Date(normalized)

    return Number.isNaN(date.getTime()) ? null : date
  }

  private pickString(value: unknown) {
    if (typeof value === 'string') {
      return value.trim() || undefined
    }

    if (typeof value === 'number') {
      return String(value)
    }

    return undefined
  }

  private toNumber(value: unknown) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }

    return undefined
  }

  private mapTransferType(value?: string) {
    if (!value) {
      return undefined
    }

    if (value === 'credit') {
      return 'in'
    }

    if (value === 'debit') {
      return 'out'
    }

    return value
  }

  private isTransactionUnsupportedError(error: unknown) {
    if (!(error instanceof Error)) {
      return false
    }

    const message = error.message.toLowerCase()
    return (
      message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
      message.includes('transactions are not supported')
    )
  }
}

const walletTopUpService = new WalletTopUpService()
export default walletTopUpService
