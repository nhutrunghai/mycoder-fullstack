import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config'
import { JobApplicationStatus, NotificationType } from '~/constants/enums'
import UserMessages from '~/constants/messages/index'
import {
  ApplyJobLocals,
  CompanyApplicationLocals,
  CompanyApplicationDetailLocals,
  CompanyLocals,
  JobLocals
} from '~/types/http/response.type'
import JobApplication from '~/models/schema/client/jobApplications.schema'
import jobApplicationService from '~/services/client/job-application.service'
import notificationService from '~/services/client/notification.service'

const applicationStatusLabelMap: Record<JobApplicationStatus, string> = {
  [JobApplicationStatus.SUBMITTED]: 'Đã nộp hồ sơ',
  [JobApplicationStatus.REVIEWING]: 'Đang xem xét',
  [JobApplicationStatus.SHORTLISTED]: 'Phù hợp',
  [JobApplicationStatus.INTERVIEWING]: 'Mời phỏng vấn',
  [JobApplicationStatus.HIRED]: 'Trúng tuyển',
  [JobApplicationStatus.REJECTED]: 'Từ chối',
  [JobApplicationStatus.WITHDRAWN]: 'Đã rút hồ sơ'
}

type ApplyJobBody = {
  cv_id: string
  cover_letter?: string
  full_name?: string
  email?: string
  phone?: string
}

type UpdateCompanyApplicationStatusBody = {
  status: JobApplicationStatus
}

export const applyJobController = async (
  req: Request<Record<string, string>, unknown, ApplyJobBody>,
  res: Response<unknown, ApplyJobLocals>
) => {
  const userId = new ObjectId(req.decodeToken?.userId as string)
  const job = res.locals.applyJob as NonNullable<ApplyJobLocals['applyJob']>
  const resume = res.locals.applyResume as NonNullable<ApplyJobLocals['applyResume']>
  const existingApplication = res.locals.existingApplication
  const candidate = await databaseService.users.findOne(
    { _id: userId },
    { projection: { fullName: 1, email: 1, phone: 1, skills: 1 } }
  )
  const resumeSnapshot = {
    full_name: req.body.full_name || candidate?.fullName,
    email: req.body.email || candidate?.email,
    phone: req.body.phone || candidate?.phone,
    cv_url: resume.cv_url,
    skills: candidate?.skills
  }

  if (existingApplication?._id && existingApplication.status === JobApplicationStatus.WITHDRAWN) {
    const result = await jobApplicationService.reapplyWithdrawnJobApplication({
      applicationId: existingApplication._id,
      resumeSnapshot,
      coverLetter: req.body.cover_letter
    })

    const company = await databaseService.companies.findOne({ _id: job.company_id }, { projection: { user_id: 1 } })

    if (company?.user_id && result?._id) {
      await notificationService.create({
        userId: company.user_id,
        type: NotificationType.JOB_APPLICATION_SUBMITTED,
        title: 'Có ứng viên ứng tuyển lại',
        content: `${candidate?.fullName || 'Một ứng viên'} đã ứng tuyển lại vào tin tuyển dụng của bạn.`,
        data: {
          job_id: String(job._id),
          company_id: String(job.company_id),
          application_id: String(result._id),
          candidate_id: String(userId)
        }
      })
    }

    return res.status(StatusCodes.OK).json({
      status: 'success',
      message: UserMessages.JOB_APPLIED_SUCCESS,
      data: {
        _id: result?._id,
        job_id: result?.job_id,
        company_id: result?.company_id,
        candidate_id: result?.candidate_id,
        status: result?.status,
        applied_at: result?.applied_at,
        updated_at: result?.updated_at
      }
    })
  }

  const newApplication = new JobApplication({
    job_id: job._id,
    company_id: job.company_id,
    candidate_id: userId,
    resume_snapshot: resumeSnapshot,
    cover_letter: req.body.cover_letter
  })

  const result = await jobApplicationService.createJobApplication(newApplication)
  const company = await databaseService.companies.findOne({ _id: job.company_id }, { projection: { user_id: 1 } })

  if (company?.user_id) {
    await notificationService.create({
      userId: company.user_id,
      type: NotificationType.JOB_APPLICATION_SUBMITTED,
      title: 'Có ứng viên mới',
      content: `${candidate?.fullName || 'Một ứng viên'} vừa ứng tuyển vào tin tuyển dụng của bạn.`,
      data: {
        job_id: String(job._id),
        company_id: String(job.company_id),
        application_id: String(result.insertedId),
        candidate_id: String(userId)
      }
    })
  }

  return res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: UserMessages.JOB_APPLIED_SUCCESS,
    data: {
      _id: result.insertedId,
      job_id: newApplication.job_id,
      company_id: newApplication.company_id,
      candidate_id: newApplication.candidate_id,
      status: newApplication.status,
      applied_at: newApplication.applied_at,
      updated_at: newApplication.updated_at
    }
  })
}

export const getCompanyJobApplicationsController = async (
  req: Request,
  res: Response<unknown, CompanyLocals & JobLocals>
) => {
  const job = res.locals.job!
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const status = req.query.status as JobApplicationStatus | undefined

  const result = await jobApplicationService.getCompanyJobApplications({
    jobId: job._id!,
    status,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      applications: await Promise.all(result.applications.map(async (application) => {
        const candidate = await databaseService.users.findOne(
          { _id: application.candidate_id },
          { projection: { email: 1 } },
        )
        const snapshot = application.resume_snapshot || {}
        return {
          _id: application._id,
          candidate_id: application.candidate_id,
          resume_snapshot: {
            full_name: snapshot.full_name,
            email: snapshot.email || candidate?.email,
            phone: snapshot.phone,
            cv_url: snapshot.cv_url
          },
          status: application.status,
          applied_at: application.applied_at,
          updated_at: application.updated_at
        }
      })),
      pagination: result.pagination
    }
  })
}

export const getCompanyApplicationDetailController = async (
  req: Request,
  res: Response<unknown, CompanyApplicationDetailLocals>
) => {
  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: res.locals.companyApplication
  })
}

export const updateCompanyApplicationStatusController = async (
  req: Request<Record<string, string>, unknown, UpdateCompanyApplicationStatusBody>,
  res: Response<unknown, CompanyApplicationLocals>
) => {
  const application = res.locals.companyApplication!
  const result = await jobApplicationService.updateCompanyApplicationStatus({
    applicationId: application._id!,
    status: req.body.status
  })
  const job = await databaseService.jobs.findOne({ _id: application.job_id }, { projection: { title: 1 } })

  const readableStatus = applicationStatusLabelMap[req.body.status] || req.body.status

  await notificationService.create({
    userId: application.candidate_id,
    type: NotificationType.JOB_APPLICATION_STATUS_UPDATED,
    title: 'Hồ sơ ứng tuyển đã được cập nhật',
    content: `Trạng thái hồ sơ cho vị trí "${job?.title || 'đã ứng tuyển'}" đã chuyển sang "${readableStatus}".`,
    data: {
      application_id: String(application._id),
      job_id: String(application.job_id),
      company_id: String(application.company_id),
      status: req.body.status
    }
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.APPLICATION_STATUS_UPDATED_SUCCESS,
    data: {
      _id: result?._id,
      status: result?.status,
      updated_at: result?.updated_at
    }
  })
}

export const getMyAppliedJobsController = async (req: Request, res: Response) => {
  const candidateId = new ObjectId(req.decodeToken?.userId as string)
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const status = req.query.status as JobApplicationStatus | undefined

  const result = await jobApplicationService.getMyAppliedJobs({
    candidateId,
    status,
    page,
    limit
  })

  return res.status(StatusCodes.OK).json({
    status: 'success',
    data: result
  })
}

export const withdrawMyJobApplicationController = async (
  req: Request,
  res: Response<unknown, CompanyApplicationLocals>
) => {
  const application = res.locals.companyApplication!
  const result = await jobApplicationService.withdrawMyJobApplication(application._id!)

  return res.status(StatusCodes.OK).json({
    status: 'success',
    message: UserMessages.APPLICATION_WITHDRAWN_SUCCESS,
    data: {
      _id: result?._id,
      job_id: result?.job_id,
      status: result?.status,
      updated_at: result?.updated_at
    }
  })
}

