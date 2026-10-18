import { Router } from 'express'
import adminAuditLogRouter from './audit-log.router.js'
import adminAuthRouter from './auth.router.js'
import adminCompanyRouter from './company.router.js'
import adminDashboardRouter from './dashboard.router.js'
import adminJobCategoryRouter from './job-category.router.js'
import adminJobRouter from './job.router.js'
import adminJobPromotionRouter from './job-promotion.router.js'
import adminJobPromotionPlanRouter from './job-promotion-plan.router.js'
import adminRagChatRouter from './rag-chat.router.js'
import adminSePayRouter from './sepay.router.js'
import adminUserRouter from './user.router.js'
import adminWalletTransactionRouter from './wallet-transaction.router.js'
import adminPolicyDocumentRouter from './policy-document.router.js'

const adminRouter = Router()

adminRouter.use('/audit-logs', adminAuditLogRouter)
adminRouter.use('/auth', adminAuthRouter)
adminRouter.use('/companies', adminCompanyRouter)
adminRouter.use('/dashboard', adminDashboardRouter)
adminRouter.use('/job-categories', adminJobCategoryRouter)
adminRouter.use('/jobs', adminJobRouter)
adminRouter.use('/job-promotions', adminJobPromotionRouter)
adminRouter.use('/job-promotion-plans', adminJobPromotionPlanRouter)
adminRouter.use('/rag-chat', adminRagChatRouter)
adminRouter.use('/sepay', adminSePayRouter)
adminRouter.use('/users', adminUserRouter)
adminRouter.use('/wallet-transactions', adminWalletTransactionRouter)
adminRouter.use('/policy-documents', adminPolicyDocumentRouter)

export default adminRouter
