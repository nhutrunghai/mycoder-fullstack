import { ObjectId } from 'mongodb'
import { ZodError } from 'zod'
import { AgentPlan } from '~/services/chat/agent/schemas/agent-plan.schema'
import { AgentToolName } from '~/services/chat/agent/agent-tool'
import {
  AgentToolArguments,
  parseAgentToolArguments
} from '~/services/chat/agent/tools/tool-arguments.schema'
import {
  getAgentToolDefinition,
  isRegisteredAgentTool
} from '~/services/chat/agent/tools/tool-registry'

export type AgentToolGatewayErrorCode =
  | 'INVALID_CONTEXT'
  | 'PLAN_NOT_EXECUTABLE'
  | 'TOOL_NOT_REGISTERED'
  | 'TOOL_CALL_LIMIT_EXCEEDED'
  | 'INVALID_ARGUMENTS'

export type AgentToolGatewayContext = {
  user_id: string
}

export type ValidatedAgentToolCall = {
  step_id: string
  tool: AgentToolName
  arguments: AgentToolArguments[AgentToolName]
  user_id: string
}

export class AgentToolGatewayError extends Error {
  readonly code: AgentToolGatewayErrorCode

  constructor(code: AgentToolGatewayErrorCode, message: string) {
    super(message)
    this.name = 'AgentToolGatewayError'
    this.code = code
  }
}

export class AgentToolGatewayService {
  validatePlan(plan: AgentPlan, context: AgentToolGatewayContext): ValidatedAgentToolCall[] {
    if (typeof context.user_id !== 'string' || !ObjectId.isValid(context.user_id)) {
      throw new AgentToolGatewayError('INVALID_CONTEXT', 'Invalid agent tool gateway context.')
    }

    if (plan.status !== 'ready') {
      throw new AgentToolGatewayError('PLAN_NOT_EXECUTABLE', 'Only ready agent plans can be validated.')
    }

    const callCounts = new Map<string, number>()

    return plan.steps.map((step) => {
      if (!isRegisteredAgentTool(step.tool)) {
        throw new AgentToolGatewayError('TOOL_NOT_REGISTERED', 'The requested agent tool is not registered.')
      }

      const definition = getAgentToolDefinition(step.tool)
      const callCount = (callCounts.get(step.tool) ?? 0) + 1
      if (callCount > definition.max_calls_per_plan) {
        throw new AgentToolGatewayError('TOOL_CALL_LIMIT_EXCEEDED', 'The agent tool call limit was exceeded.')
      }
      callCounts.set(step.tool, callCount)

      let parsedArguments: AgentToolArguments[AgentToolName]
      try {
        parsedArguments = parseAgentToolArguments(step.tool, step.arguments)
      } catch (error) {
        if (error instanceof ZodError) {
          throw new AgentToolGatewayError('INVALID_ARGUMENTS', 'The agent tool arguments are invalid.')
        }

        throw error
      }

      return {
        step_id: step.step_id,
        tool: step.tool,
        arguments: parsedArguments,
        user_id: context.user_id
      }
    })
  }
}

const agentToolGatewayService = new AgentToolGatewayService()
export default agentToolGatewayService
