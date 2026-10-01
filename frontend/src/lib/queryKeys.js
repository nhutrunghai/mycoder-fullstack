export const queryKeys = {
  profile: {
    me: ['profile', 'me'],
    detail: ['profile', 'detail'],
    public: (id) => ['profile', 'public', id],
  },
  jobs: {
    search: (filters) => ['jobs', 'search', filters],
    detail: (id) => ['jobs', 'detail', id],
  },
  wallet: {
    details: ['wallet', 'details'],
    transactions: ({ page, limit }) => ['wallet', 'transactions', { page, limit }],
  },
  dashboard: {
    candidate: ['dashboard', 'candidate'],
    admin: {
      summary: ['dashboard', 'admin', 'summary'],
      users: ['dashboard', 'admin', 'users'],
      companies: ['dashboard', 'admin', 'companies'],
      jobs: ['dashboard', 'admin', 'jobs'],
      blockedJobs: ['dashboard', 'admin', 'blocked-jobs'],
    },
  },
}
