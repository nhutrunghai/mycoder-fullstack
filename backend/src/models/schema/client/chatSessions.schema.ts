import { ObjectId } from 'mongodb'
import { ChatIntent } from '~/constants/chat-intent'
import { ChatSessionDocument, ChatSessionTurn, SearchContext } from '~/services/chat/types/chat.type'

type ChatSessionSchemaType = {
  _id?: ObjectId
  user_id?: ObjectId
  title?: string
  turns?: ChatSessionTurn[]
  last_intent?: ChatIntent
  last_retrieved_job_ids?: string[]
  search_contexts?: SearchContext[]
  created_at?: Date
  updated_at?: Date
}

export default class ChatSession implements ChatSessionDocument {
  _id?: ObjectId
  user_id?: ObjectId
  title?: string
  turns: ChatSessionTurn[]
  last_intent?: ChatIntent
  last_retrieved_job_ids: string[]
  search_contexts?: SearchContext[]
  created_at: Date
  updated_at: Date

  constructor(session: ChatSessionSchemaType = {}) {
    const date = new Date()

    this._id = session._id
    this.user_id = session.user_id
    this.title = session.title
    this.turns = session.turns || []
    this.last_intent = session.last_intent
    this.last_retrieved_job_ids = session.last_retrieved_job_ids || []
    this.search_contexts = session.search_contexts
    this.created_at = session.created_at || date
    this.updated_at = session.updated_at || date
  }
}
