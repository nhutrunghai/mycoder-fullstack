import { ObjectId } from 'mongodb'

export type PolicyDocumentStatus = 'active' | 'archived'

export type PolicyDocumentType = {
  _id?: ObjectId
  title: string
  content: string
  source_url?: string
  status?: PolicyDocumentStatus
  version?: string
  created_at?: Date
  updated_at?: Date
}

export default class PolicyDocument {
  _id?: ObjectId
  title: string
  content: string
  source_url?: string
  status: PolicyDocumentStatus
  version?: string
  created_at: Date
  updated_at: Date

  constructor(document: PolicyDocumentType) {
    const now = new Date()

    this._id = document._id
    this.title = document.title
    this.content = document.content
    this.source_url = document.source_url
    this.status = document.status || 'active'
    this.version = document.version
    this.created_at = document.created_at || now
    this.updated_at = document.updated_at || now
  }
}
