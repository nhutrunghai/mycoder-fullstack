import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { JobModerationStatus, JobStatus } from '~/constants/enums.js'
import { AdminJobLocals } from '~/types/http/response.type.js'
import adminJobService from '~/services/admin/job.service.js'

export const getAdminJobsController = async (req: Request, res: Response) => {
  const companyId = (typeof req.query.companyId === 'string' && req.query.companyId) || (typeof req.query.company_id === 'string' && req.query.company_id) || undefined
  const categoryId = (typeof req.query.categoryId === 'string' && req.query.categoryId) || (typeof req.query.category_id === 'string' && req.query.category_id) || undefined
  const status = req.query.status as JobStatus | undefined
  const moderationStatus = req.query.moderation_status as JobModerationStatus | undefined
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)

  const result = await adminJobService.getJobs({
    companyId: companyId ? new ObjectId(companyId) : undefined,
    categoryId: categoryId ? new ObjectId(categoryId) : undefined,
    status,
    moderationStatus,
    keyword,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      jobs: result.jobs.map((job) => ({
        _id: job._id,
        title: job.title,
        location: job.location,
        job_type: job.job_type,
        level: job.level,
        salary: job.salary,
        status: job.status,
        moderation_status: job.moderation_status,
        blocked_reason: job.blocked_reason ?? null,
        published_at: job.published_at,
        expired_at: job.expired_at,
        created_at: job.created_at,
        updated_at: job.updated_at,
        company: {
          _id: job.company._id,
          company_name: job.company.company_name,
          verified: job.company.verified
        }
      })),
      stats: result.stats,
      pagination: result.pagination
    }
  })
}

export const getAdminJobDetailController = async (
  req: Request,
  res: Response<unknown, AdminJobLocals>
) => {
  const job = res.locals.adminJob

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      _id: job._id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits,
      salary: job.salary,
      location: job.location,
      job_type: job.job_type,
      level: job.level,
      category_ids: job.category_ids,
      skills: job.skills,
      quantity: job.quantity,
      status: job.status,
      moderation_status: job.moderation_status,
      blocked_reason: job.blocked_reason ?? null,
      blocked_at: job.blocked_at ?? null,
      blocked_by: job.blocked_by ?? null,
      published_at: job.published_at,
      expired_at: job.expired_at,
      created_at: job.created_at,
      updated_at: job.updated_at,
      company: {
        _id: job.company._id,
        company_name: job.company.company_name,
        verified: job.company.verified,
        logo: job.company.logo,
        website: job.company.website,
        address: job.company.address
      }
    }
  })
}

export const updateAdminJobModerationStatusController = async (
  req: Request<any, any, { moderation_status: JobModerationStatus; blocked_reason?: string }>,
  res: Response<unknown, AdminJobLocals>
) => {
  const targetJob = res.locals.adminJob
  const moderationStatus = req.body.moderation_status
  const blockedReason = req.body.blocked_reason?.trim()
  const currentAdmin = req.user

  const updatedJob =
    targetJob.moderation_status === moderationStatus
      ? {
          _id: targetJob._id,
          moderation_status: targetJob.moderation_status,
          blocked_reason: targetJob.blocked_reason,
          blocked_at: targetJob.blocked_at,
          blocked_by: targetJob.blocked_by,
          updated_at: targetJob.updated_at
        }
      : await adminJobService.updateModerationStatus({
          jobId: targetJob._id,
          moderationStatus,
          blockedReason,
          adminUserId: currentAdmin!._id as ObjectId
        })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Cap nhat trang thai moderation cua job thanh cong',
    data: {
      _id: updatedJob?._id,
      moderation_status: updatedJob?.moderation_status,
      blocked_reason: updatedJob?.blocked_reason ?? null,
      blocked_at: updatedJob?.blocked_at ?? null,
      blocked_by: updatedJob?.blocked_by ?? null,
      updated_at: updatedJob?.updated_at
    }
  })
}

export const getAdminJobApplicationsController = async (req: Request, res: Response) => {
  const jobId = new ObjectId(req.params.jobId as string)
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 20)

  const result = await adminJobService.getJobApplicationsForAdmin({
    jobId,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: result
  })
}
