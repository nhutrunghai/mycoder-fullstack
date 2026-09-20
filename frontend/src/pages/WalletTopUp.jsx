import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import DashboardSidebar from '../components/DashboardSidebar.jsx'
import Toast from '../components/Toast.jsx'
import {
  createTopUpOrder,
  getTopUpOrder,
  getWallet,
  getWalletTransactions,
  readStoredTopUpSession,
  storeTopUpSession,
  validateTopUpAmount,
} from '../api/walletService.js'
import { queryKeys } from '../lib/queryKeys.js'

const POLL_INTERVAL_MS = 7000
const BANK_CODE_FALLBACK = 'BIDV'

function formatMoney(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })
}

function formatDateTime(value) {
  if (!value) return 'Ch\u01b0a c\u00f3'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ch\u01b0a c\u00f3'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getOrderCode(order, payment) {
  return order?.order_code || payment?.order_code || ''
}

function getTransferContent(order, payment) {
  return payment?.transfer_content || getOrderCode(order, payment)
}

function getPaymentAccount(payment) {
  return payment?.account_number || payment?.va_number || ''
}

function getBankCode(payment) {
  const bankName = String(payment?.bank_short_name || payment?.bank_name || '').trim()
  if (/^[A-Z0-9_]+$/i.test(bankName)) return bankName
  return BANK_CODE_FALLBACK
}

function buildQrSrc(order, payment) {
  const directQr = payment?.qr_code_url || payment?.qr_code
  if (directQr) {
    if (String(directQr).startsWith('http') || String(directQr).startsWith('data:image')) {
      return directQr
    }
    return `data:image/png;base64,${directQr}`
  }

  const account = getPaymentAccount(payment)
  const transferContent = getTransferContent(order, payment)
  const amount = payment?.amount || order?.amount
  if (!account || !transferContent || !amount) return ''

  const bank = getBankCode(payment)
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: transferContent,
    accountName: payment?.account_holder_name || '',
  })
  return `https://img.vietqr.io/image/${bank}-${account}-compact2.png?${params.toString()}`
}

function mapTopUpStatus(status) {
  if (status === 'paid') return { label: '\u0110\u00e3 thanh to\u00e1n', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'expired') return { label: '\u0110\u00e3 qu\u00e1 h\u1ea1n', className: 'bg-rose-100 text-rose-700' }
  if (status === 'cancelled') return { label: '\u0110\u00e3 h\u1ee7y', className: 'bg-slate-100 text-slate-600' }
  return { label: '\u0110ang ch\u1edd thanh to\u00e1n', className: 'bg-amber-100 text-amber-700' }
}

function mapTransactionStatus(status) {
  if (status === 'succeeded') return 'Th\u00e0nh c\u00f4ng'
  if (status === 'failed') return 'Th\u1ea5t b\u1ea1i'
  if (status === 'pending') return '\u0110ang x\u1eed l\u00fd'
  return status || '\u0110ang c\u1eadp nh\u1eadt'
}

function normalizeSession(data) {
  if (!data) return null
  const order = data.order || null
  const payment = data.payment || null
  const orderCode = getOrderCode(order, payment)
  if (!orderCode) return null
  return {
    order,
    payment,
    createdAt: data.createdAt || new Date().toISOString(),
  }
}

export default function WalletTopUp() {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState('')
  const [transactionPage, setTransactionPage] = useState(1)
  const [session, setSession] = useState(() => normalizeSession(readStoredTopUpSession()))
  const [checking, setChecking] = useState(false)
  const [toast, setToast] = useState(null)
  const activeOrderCodeRef = useRef(getOrderCode(session?.order, session?.payment))
  const paidToastShownRef = useRef(new Set())

  const order = session?.order || null
  const payment = session?.payment || null
  const orderCode = getOrderCode(order, payment)
  const transferContent = getTransferContent(order, payment)
  const status = mapTopUpStatus(order?.status)
  const qrSrc = useMemo(() => buildQrSrc(order, payment), [order, payment])
  const walletQuery = useQuery({
    queryKey: queryKeys.wallet.details,
    queryFn: getWallet,
  })
  const transactionsQuery = useQuery({
    queryKey: queryKeys.wallet.transactions({ page: transactionPage, limit: 8 }),
    queryFn: () => getWalletTransactions({ page: transactionPage, limit: 8 }),
  })
  const createOrderMutation = useMutation({
    mutationFn: createTopUpOrder,
  })
  const wallet = walletQuery.data || null
  const transactions = transactionsQuery.data?.transactions || []
  const pagination = transactionsQuery.data?.pagination || {
    page: transactionPage,
    limit: 8,
    total: 0,
    total_pages: 1,
  }
  const loading = walletQuery.isPending || transactionsQuery.isPending || transactionsQuery.isFetching
  const creating = createOrderMutation.isPending

  useEffect(() => {
    activeOrderCodeRef.current = orderCode
  }, [orderCode])

  useEffect(() => {
    const error = walletQuery.error || transactionsQuery.error
    if (error) {
      setToast({ type: 'error', message: error.message || 'Kh\u00f4ng th\u1ec3 t\u1ea3i d\u1eef li\u1ec7u v\u00ed.' })
    }
  }, [transactionsQuery.error, walletQuery.error])

  const refreshWalletAndHistory = useCallback(async (page = transactionPage) => {
    if (page !== transactionPage) setTransactionPage(page)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.details }),
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions({ page, limit: 8 }) }),
    ])
  }, [queryClient, transactionPage])

  const checkOrderStatus = useCallback(async ({ silent = false } = {}) => {
    if (!orderCode) return null

    const requestedOrderCode = orderCode
    if (!silent) setChecking(true)
    try {
      const nextOrder = await getTopUpOrder(requestedOrderCode)

      if (activeOrderCodeRef.current !== requestedOrderCode) {
        return nextOrder
      }

      const nextSession = normalizeSession({
        ...session,
        order: nextOrder || order,
        payment,
      })
      setSession(nextSession)
      storeTopUpSession(nextSession)

      if (nextOrder?.status === 'paid') {
        storeTopUpSession(null)
        await refreshWalletAndHistory(1)

        if (!paidToastShownRef.current.has(requestedOrderCode)) {
          paidToastShownRef.current.add(requestedOrderCode)
          setToast({ type: 'success', message: 'N\u1ea1p ti\u1ec1n th\u00e0nh c\u00f4ng. S\u1ed1 d\u01b0 v\u00ed \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt.' })
        }
      }

      return nextOrder
    } catch (error) {
      if (!silent) {
        setToast({ type: 'error', message: error.message || 'Kh\u00f4ng th\u1ec3 ki\u1ec3m tra tr\u1ea1ng th\u00e1i thanh to\u00e1n.' })
      }
      return null
    } finally {
      if (!silent) setChecking(false)
    }
  }, [order, orderCode, payment, refreshWalletAndHistory, session])

  useEffect(() => {
    if (!orderCode || order?.status === 'paid') return undefined

    checkOrderStatus({ silent: true })
    const intervalId = window.setInterval(() => {
      checkOrderStatus({ silent: true })
    }, POLL_INTERVAL_MS)

    const handleFocus = () => {
      checkOrderStatus({ silent: true })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkOrderStatus({ silent: true })
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [checkOrderStatus, orderCode, order?.status])

  const handleAmountChange = (event) => {
    const nextValue = event.target.value.replace(/[^\d]/g, '')
    setAmount(nextValue)
    if (amountError) setAmountError('')
  }

  const handleCreateOrder = async (event) => {
    event.preventDefault()
    const validationMessage = validateTopUpAmount(Number(amount))
    if (validationMessage) {
      setAmountError(validationMessage)
      return
    }

    try {
      const data = await createOrderMutation.mutateAsync(Number(amount))
      const nextSession = normalizeSession({
        ...data,
        createdAt: new Date().toISOString(),
      })
      activeOrderCodeRef.current = getOrderCode(nextSession?.order, nextSession?.payment)
      setChecking(false)
      setSession(nextSession)
      storeTopUpSession(nextSession)
      setToast({ type: 'success', message: '\u0110\u00e3 t\u1ea1o l\u1ec7nh n\u1ea1p. Vui l\u00f2ng chuy\u1ec3n kho\u1ea3n \u0111\u00fang th\u00f4ng tin hi\u1ec3n th\u1ecb.' })
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Kh\u00f4ng th\u1ec3 t\u1ea1o l\u1ec7nh n\u1ea1p ti\u1ec1n.' })
    }
  }

  const handleCopy = async (value, label) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setToast({ type: 'success', message: `\u0110\u00e3 sao ch\u00e9p ${label}.` })
    } catch {
      setToast({ type: 'error', message: `Kh\u00f4ng th\u1ec3 sao ch\u00e9p ${label}.` })
    }
  }

  const handleNewOrder = () => {
    activeOrderCodeRef.current = ''
    setChecking(false)
    setSession(null)
    storeTopUpSession(null)
    setAmount('')
    setAmountError('')
  }

  const handleChangePage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.total_pages) return
    if (nextPage === transactionPage) {
      void refreshWalletAndHistory(nextPage)
      return
    }
    setTransactionPage(nextPage)
  }

  return (
    <div className="wallet-top-up min-h-screen bg-[#f6f8fb] text-slate-900">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <DashboardSidebar activeKey="wallet" />
      <main className="min-h-screen p-4 lg:ml-64 lg:p-5">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100">
              <span className="material-symbols-outlined !text-[20px]">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-[26px] font-semibold text-slate-900 sm:text-[31px]">{'N\u1ea1p ti\u1ec1n v\u00ed'}</h1>
              <p className="text-sm font-medium text-slate-500">{'T\u1ea1o l\u1ec7nh n\u1ea1p, qu\u00e9t QR v\u00e0 theo d\u00f5i tr\u1ea1ng th\u00e1i t\u1ef1 \u0111\u1ed9ng.'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{'S\u1ed1 d\u01b0 hi\u1ec7n t\u1ea1i'}</p>
            <p className="mt-1 text-2xl font-extrabold text-blue-600">{formatMoney(wallet?.balance)}</p>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{'T\u1ea1o l\u1ec7nh n\u1ea1p'}</h2>
                <p className="text-sm font-medium text-slate-500">{'Nh\u1eadp s\u1ed1 ti\u1ec1n mu\u1ed1n n\u1ea1p v\u00e0o v\u00ed.'}</p>
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">{'S\u1ed1 ti\u1ec1n n\u1ea1p'}</span>
                <div className="wallet-amount-control mt-2 flex items-center border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-blue-400 focus-within:bg-white">
                  <input
                    value={amount}
                    onChange={handleAmountChange}
                    inputMode="numeric"
                    placeholder={'V\u00ed d\u1ee5: 100000'}
                    className="wallet-amount-input min-w-0 flex-1 bg-transparent text-base font-bold text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <span className="text-sm font-extrabold text-slate-500">VND</span>
                </div>
                {amountError && <span className="mt-2 block text-sm font-semibold text-rose-600">{amountError}</span>}
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[50000, 100000, 200000].map((quickAmount) => (
                  <button
                    key={quickAmount}
                    type="button"
                    onClick={() => {
                      setAmount(String(quickAmount))
                      setAmountError('')
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                  >
                    {formatMoney(quickAmount).replace(/\s?₫/, '')}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={creating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <span className="material-symbols-outlined !text-[19px]">{creating ? 'progress_activity' : 'add_card'}</span>
                {creating ? '\u0110ang t\u1ea1o l\u1ec7nh...' : 'T\u1ea1o l\u1ec7nh n\u1ea1p'}
              </button>
            </form>

            {session && (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-sm font-bold text-amber-800">{'C\u00f3 phi\u00ean n\u1ea1p \u0111ang l\u01b0u'}</p>
                <p className="mt-1 text-sm leading-6 text-amber-700">
                  {'N\u1ebfu b\u1ea1n r\u1eddi trang r\u1ed3i quay l\u1ea1i, h\u1ec7 th\u1ed1ng v\u1eabn gi\u1eef m\u00e3 \u0111\u01a1n g\u1ea7n nh\u1ea5t v\u00e0 ti\u1ebfp t\u1ee5c ki\u1ec3m tra tr\u1ea1ng th\u00e1i.'}
                </p>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{'Th\u00f4ng tin chuy\u1ec3n kho\u1ea3n'}</h2>
                <p className="text-sm font-medium text-slate-500">{'Kh\u00f4ng c\u1ea7n x\u00e1c nh\u1eadn th\u1ee7 c\u00f4ng. Backend s\u1ebd \u0111\u1ed1i so\u00e1t v\u00e0 c\u1eadp nh\u1eadt v\u00ed.'}</p>
              </div>
              {order && <span className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold ${status.className}`}>{status.label}</span>}
            </div>

            {order ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
                <div className="rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 shadow-sm">
                  {qrSrc ? (
                    <img src={qrSrc} alt={'QR thanh to\u00e1n n\u1ea1p ti\u1ec1n'} className="aspect-square w-full rounded-[1.5rem] bg-white object-contain p-2 shadow-inner" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white text-center text-sm font-semibold text-slate-500">
                      {'Ch\u01b0a c\u00f3 QR thanh to\u00e1n'}
                    </div>
                  )}
                  <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-blue-500">{'Qu\u00e9t QR \u0111\u1ec3 chuy\u1ec3n kho\u1ea3n'}</p>
                </div>

                <div className="space-y-2">
                  <PaymentInfoRow label={'Ng\u00e2n h\u00e0ng'} value={payment?.bank_name || '\u0110ang c\u1eadp nh\u1eadt'} />
                  <PaymentInfoRow
                    label={'S\u1ed1 t\u00e0i kho\u1ea3n'}
                    value={getPaymentAccount(payment) || '\u0110ang c\u1eadp nh\u1eadt'}
                    onCopy={() => handleCopy(getPaymentAccount(payment), 's\u1ed1 t\u00e0i kho\u1ea3n')}
                  />
                  <PaymentInfoRow label={'Ch\u1ee7 t\u00e0i kho\u1ea3n'} value={payment?.account_holder_name || '\u0110ang c\u1eadp nh\u1eadt'} />
                  <PaymentInfoRow label={'S\u1ed1 ti\u1ec1n'} value={formatMoney(payment?.amount || order?.amount)} highlight />
                  <PaymentInfoRow
                    label={'N\u1ed9i dung chuy\u1ec3n kho\u1ea3n'}
                    value={transferContent}
                    onCopy={() => handleCopy(transferContent, 'n\u1ed9i dung chuy\u1ec3n kho\u1ea3n')}
                    highlight
                  />
                  <PaymentInfoRow label={'M\u00e3 \u0111\u01a1n n\u1ea1p'} value={orderCode} onCopy={() => handleCopy(orderCode, 'm\u00e3 \u0111\u01a1n n\u1ea1p')} />
                  <PaymentInfoRow label={'H\u1ebft h\u1ea1n'} value={formatDateTime(payment?.expired_at || order?.provider_expired_at)} />

                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => checkOrderStatus()}
                      disabled={checking || order?.status === 'paid'}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <span className="material-symbols-outlined !text-[19px]">{checking ? 'progress_activity' : 'sync'}</span>
                      {checking ? '\u0110ang ki\u1ec3m tra...' : 'T\u00f4i \u0111\u00e3 chuy\u1ec3n kho\u1ea3n'}
                    </button>
                    <button
                      type="button"
                      onClick={handleNewOrder}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined !text-[19px]">refresh</span>
                      {'T\u1ea1o l\u1ec7nh m\u1edbi'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
                <span className="material-symbols-outlined text-[44px] text-slate-300">qr_code_2</span>
                <p className="mt-3 text-base font-extrabold text-slate-700">{'Ch\u01b0a c\u00f3 l\u1ec7nh n\u1ea1p'}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{'T\u1ea1o l\u1ec7nh n\u1ea1p \u0111\u1ec3 hi\u1ec3n th\u1ecb QR, s\u1ed1 t\u00e0i kho\u1ea3n v\u00e0 n\u1ed9i dung chuy\u1ec3n kho\u1ea3n.'}</p>
              </div>
            )}
          </article>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{'L\u1ecbch s\u1eed giao d\u1ecbch v\u00ed'}</h2>
              <p className="text-sm font-medium text-slate-500">{'Giao d\u1ecbch n\u1ea1p ti\u1ec1n s\u1ebd xu\u1ea5t hi\u1ec7n sau khi backend ghi nh\u1eadn th\u00e0nh c\u00f4ng.'}</p>
            </div>
            <button
              type="button"
              onClick={() => handleChangePage(1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined !text-[18px]">refresh</span>
              {'L\u00e0m m\u1edbi'}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            {transactions.length ? (
              <div className="divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <article key={transaction._id || `${transaction.created_at}-${transaction.amount}`} className="grid gap-2 bg-white px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="text-sm font-extrabold text-slate-800">{transaction.description || 'Giao d\u1ecbch v\u00ed'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {formatDateTime(transaction.created_at)} {'\u00b7'} {mapTransactionStatus(transaction.status)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={transaction.direction === 'debit' ? 'text-base font-extrabold text-rose-600' : 'text-base font-extrabold text-emerald-600'}>
                        {transaction.direction === 'debit' ? '-' : '+'}
                        {formatMoney(transaction.amount)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{'S\u1ed1 d\u01b0 sau: '}{formatMoney(transaction.balance_after)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 px-4 py-10 text-center">
                <p className="text-sm font-bold text-slate-500">{loading ? '\u0110ang t\u1ea3i l\u1ecbch s\u1eed...' : 'Ch\u01b0a c\u00f3 giao d\u1ecbch v\u00ed.'}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">
              {'Trang'} {pagination.page || 1}/{pagination.total_pages || 1}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleChangePage((pagination.page || 1) - 1)}
                disabled={(pagination.page || 1) <= 1}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {'Tr\u01b0\u1edbc'}
              </button>
              <button
                type="button"
                onClick={() => handleChangePage((pagination.page || 1) + 1)}
                disabled={(pagination.page || 1) >= (pagination.total_pages || 1)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {'Sau'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function PaymentInfoRow({ label, value, onCopy, highlight = false }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className={`mt-0.5 break-words text-[13px] font-extrabold leading-5 ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</p>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-extrabold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
        >
          <span className="material-symbols-outlined !text-[14px]">content_copy</span>
          {'Sao ch\u00e9p'}
        </button>
      )}
    </div>
  )
}
