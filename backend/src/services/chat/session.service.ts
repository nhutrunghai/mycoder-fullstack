import { ObjectId } from 'mongodb'
import databaseService from '~/configs/database.config'
import { ChatIntent } from '~/constants/chat-intent'
import UserMessages from '~/constants/messages/index'
import { AppError } from '~/errors/app-error'
import {
  ChatSessionDetail,
  ChatSessionDocument,
  ChatSessionSummary,
  ChatSessionTurnRole,
  ChatSource,
  SearchContext
} from '~/services/chat/types/chat.type'
import ChatSession from '~/models/schema/client/chatSessions.schema'
import { StatusCodes } from 'http-status-codes'

class SessionService {
  async loadOrCreateSession(sessionId: string | undefined, userId: string, initialMessage: string) {
    const userObjectId = new ObjectId(userId)

    if (sessionId && ObjectId.isValid(sessionId)) {
      const session = await databaseService.chatSessions.findOne({
        _id: new ObjectId(sessionId),
        user_id: userObjectId
      })

      if (session) {
        return session
      }

      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.CHAT_SESSION_NOT_FOUND
      })
    }

    const chatSession = new ChatSession({
      user_id: userObjectId,
      title: this.buildTitle(initialMessage)
    })
    const result = await databaseService.chatSessions.insertOne(chatSession)

    return {
      ...chatSession,
      _id: result.insertedId
    }
  }

  async appendMessage(sessionId: ObjectId, role: ChatSessionTurnRole, content: string, sources: ChatSource[] = []) {
    const turn = {
      role,
      content,
      created_at: new Date(),
      ...(role === 'assistant' && sources.length ? { sources } : {})
    }

    await databaseService.chatSessions.updateOne(
      { _id: sessionId },
      {
        $push: {
          turns: turn
        },
        $set: {
          updated_at: new Date()
        }
      }
    )
  }

  async saveState(
    sessionId: ObjectId,
    payload: { lastIntent: ChatIntent; jobIds: string[]; searchContexts?: SearchContext[] }
  ) {
    await databaseService.chatSessions.updateOne(
      { _id: sessionId },
      {
        $set: {
          last_intent: payload.lastIntent,
          last_retrieved_job_ids: payload.jobIds,
          ...(payload.searchContexts ? { search_contexts: payload.searchContexts } : {}),
          updated_at: new Date()
        }
      }
    )
  }

  async listSessions(userId: string): Promise<ChatSessionSummary[]> {
    const sessions = await databaseService.chatSessions
      .find({ user_id: new ObjectId(userId) })
      .sort({ updated_at: -1 })
      .project<ChatSessionDocument>({
        title: 1,
        turns: 1,
        last_intent: 1,
        created_at: 1,
        updated_at: 1
      })
      .toArray()

    return sessions.map((session) => this.toSessionSummary(session))
  }

  async getSessionById(sessionId: string, userId: string): Promise<ChatSessionDetail> {
    const session = await databaseService.chatSessions.findOne({
      _id: new ObjectId(sessionId),
      user_id: new ObjectId(userId)
    })

    if (!session) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.CHAT_SESSION_NOT_FOUND
      })
    }

    return {
      ...this.toSessionSummary(session),
      turns: session.turns
    }
  }

  async deleteSession(sessionId: string, userId: string) {
    const result = await databaseService.chatSessions.deleteOne({
      _id: new ObjectId(sessionId),
      user_id: new ObjectId(userId)
    })

    if (result.deletedCount === 0) {
      throw new AppError({
        statusCode: StatusCodes.NOT_FOUND,
        message: UserMessages.CHAT_SESSION_NOT_FOUND
      })
    }
  }

  getSessionId(session: ChatSessionDocument) {
    return String(session._id)
  }

  private toSessionSummary(session: ChatSessionDocument): ChatSessionSummary {
    const lastTurn = session.turns.at(-1)

    return {
      session_id: this.getSessionId(session),
      title: session.title || this.buildTitle(session.turns.find((turn) => turn.role === 'user')?.content || ''),
      last_message: lastTurn?.content || '',
      last_intent: session.last_intent,
      created_at: session.created_at,
      updated_at: session.updated_at
    }
  }

  private buildTitle(message: string) {
    const normalized = message.trim().replace(/\s+/g, ' ')

    if (normalized.length <= 80) {
      return normalized
    }

    return `${normalized.slice(0, 77)}...`
  }
}

const sessionService = new SessionService()
export default sessionService
