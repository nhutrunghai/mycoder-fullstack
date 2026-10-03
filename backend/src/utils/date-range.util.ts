export function parseDateFilter(query: { dateRange?: any; fromDate?: any; toDate?: any }) {
  let fromDate: Date | undefined
  let toDate: Date | undefined

  if (query.dateRange && typeof query.dateRange === 'string') {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    switch (query.dateRange) {
      case 'today':
        fromDate = todayStart
        toDate = todayEnd
        break
      case '7days':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
        toDate = todayEnd
        break
      case '30days':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0)
        toDate = todayEnd
        break
      case 'this_month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        toDate = todayEnd
        break
      case 'last_month':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
        toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        break
    }
  }

  if (query.fromDate && typeof query.fromDate === 'string') {
    const parsed = new Date(query.fromDate)
    if (!isNaN(parsed.getTime())) {
      fromDate = parsed
    }
  }

  if (query.toDate && typeof query.toDate === 'string') {
    const parsed = new Date(query.toDate)
    if (!isNaN(parsed.getTime())) {
      toDate = parsed
      if (!query.toDate.includes('T')) {
        toDate.setUTCHours(23, 59, 59, 999)
      }
    }
  }

  return { fromDate, toDate }
}
