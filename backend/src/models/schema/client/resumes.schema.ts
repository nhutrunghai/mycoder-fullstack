import { ObjectId } from 'mongodb'
import { ResumeStatus } from '~/constants/enums'

export type ResumeIndexingStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ResumeIndexing {
  status: ResumeIndexingStatus
  chunks_indexed: number
  error?: string
  started_at?: Date
  completed_at?: Date
  updated_at: Date
}

export interface ResumeType {
  _id?: ObjectId
  candidate_id: ObjectId
  title: string
  cv_url: string
  resume_file_key?: string
  is_default?: boolean
  status?: ResumeStatus
  indexing?: ResumeIndexing
  created_at?: Date
  updated_at?: Date
}

export default class Resume {
  _id?: ObjectId
  candidate_id: ObjectId
  title: string
  cv_url: string
  resume_file_key?: string
  is_default: boolean
  status: ResumeStatus
  indexing?: ResumeIndexing
  created_at: Date
  updated_at: Date

  constructor(resume: ResumeType) {
    const date = new Date()

    this._id = resume._id
    this.candidate_id = resume.candidate_id
    this.title = resume.title
    this.cv_url = resume.cv_url
    this.resume_file_key = resume.resume_file_key
    this.is_default = resume.is_default || false
    this.status = resume.status || ResumeStatus.ACTIVE
    this.indexing =
      resume.indexing ||
      (resume._id
        ? undefined
        : {
            status: 'queued',
            chunks_indexed: 0,
            updated_at: date
          })
    this.created_at = resume.created_at || date
    this.updated_at = resume.updated_at || date
  }
}
