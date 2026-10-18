export type AgentAnswerPromptSource = {
  source_id: string
  type: string
  id: string
  title?: string
}

export type AgentAnswerPromptStep = {
  step_id: string
  tool: string
  data: unknown
  sources: AgentAnswerPromptSource[]
}

export type AgentAnswerSynthesizerPromptInput = {
  message: string
  steps: AgentAnswerPromptStep[]
  sources: AgentAnswerPromptSource[]
  max_context_characters: number
}

export type ModelKnowledgeAnswerPromptInput = {
  message: string
  conversation_context?: string
}

function serializeBoundedContext(value: unknown, maxCharacters: number) {
  const serialized = JSON.stringify(value)
  return serialized.length <= maxCharacters ? serialized : serialized.slice(0, maxCharacters)
}

export function buildAgentAnswerSynthesizerPrompt(input: AgentAnswerSynthesizerPromptInput) {
  const toolContext = serializeBoundedContext(
    {
      completed_steps: input.steps,
      available_sources: input.sources
    },
    input.max_context_characters
  )

  return `Bạn là thành phần tổng hợp câu trả lời cho JobGo.

Chỉ trả lời bằng tiếng Việt có dấu, dựa duy nhất trên dữ liệu công cụ trong context.
Không được suy diễn, bịa thêm dữ kiện, hoặc nêu kết luận không được context hỗ trợ.
Nếu context thiếu dữ liệu cho một phần câu hỏi, phải nói rõ phần đó chưa đủ dữ liệu.
Không nhắc đến lỗi kỹ thuật, hệ thống nội bộ, tool, database hoặc Elasticsearch.
Chỉ được chọn source_ids có trong available_sources. Không được tự tạo source_id.
Trả về JSON hợp lệ theo schema được cung cấp, không kèm văn bản ngoài JSON.

Tin nhắn người dùng:
${input.message}

Context dữ liệu công cụ an toàn:
${toolContext}
`
}

export function buildModelKnowledgeAnswerPrompt(input: ModelKnowledgeAnswerPromptInput) {
  return `Bạn là trợ lý nghề nghiệp của JobGo.

Trả lời trực tiếp bằng tiếng Việt có dấu, tự nhiên và hữu ích dựa trên kiến thức nền của mô hình. Không gọi hoặc khẳng định đã tra cứu web, API, cơ sở dữ liệu, JobGo, MongoDB, Elasticsearch, tool hay dữ liệu thời gian thực.
Lịch sử hội thoại chỉ để hiểu chủ đề và đại từ tham chiếu như "đúng", "toàn bộ", "trung bình"; không được lặp lại câu hỏi nếu lịch sử đã đủ ngữ cảnh.
Với số liệu lương/thị trường, chỉ nêu mức tham khảo tổng quát, nói rõ mức thực tế phụ thuộc địa điểm, cấp bậc, ngành hàng, lương cứng/hoa hồng và thời điểm. Không trình bày như số liệu hiện tại của JobGo.
Nếu yêu cầu rộng, hãy tự cấu trúc câu trả lời thành các ý thực tế thay vì hỏi lại. Chỉ nêu giới hạn kiến thức khi câu hỏi đòi hỏi một dữ liệu hiện hành hoặc nguồn xác thực mà bạn không có.

Lịch sử hội thoại gần đây:
Với yêu cầu xóa dữ liệu, thay đổi tài khoản, thanh toán hoặc thao tác hệ thống: nói rõ bạn không thể thực hiện thao tác đó trong cuộc trò chuyện; hướng dẫn người dùng dùng khu vực cài đặt hoặc liên hệ hỗ trợ. Không được giả vờ đã thực hiện thao tác.

${input.conversation_context || '(Không có)'}

Tin nhắn người dùng:
${input.message.trim()}
`
}
