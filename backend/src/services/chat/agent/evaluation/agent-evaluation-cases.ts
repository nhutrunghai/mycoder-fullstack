import { AgentEvaluationCase } from './agent-evaluation.service.js'

export const agentEvaluationCases: readonly AgentEvaluationCase[] = [
  {
    id: 'job-search-frontend',
    category: 'job_search',
    message: 'Tìm cho tôi việc lập trình giao diện tại Hà Nội',
    expectation: { plan_status: 'ready', tools: ['search_jobs'], source_types: ['job'], answer_required: true }
  },
  {
    id: 'job-search-switch-topic',
    category: 'job_search',
    message: 'Bây giờ tìm việc DevOps remote, không dùng kết quả Frontend trước đó',
    expectation: { plan_status: 'ready', tools: ['search_jobs'], source_types: ['job'], answer_required: true }
  },
  {
    id: 'job-count',
    category: 'job_search',
    message: 'Hiện có bao nhiêu việc Node.js tại TP.HCM?',
    expectation: { plan_status: 'ready', tools: ['count_jobs'], answer_required: true }
  },
  {
    id: 'job-detail',
    category: 'job_detail',
    message: 'Cho tôi xem chi tiết công việc đã chọn',
    expectation: { plan_status: 'ready', tools: ['get_job_detail'], source_types: ['job'], answer_required: true }
  },
  {
    id: 'job-comparison',
    category: 'comparison',
    message: 'So sánh hai công việc tôi đã chọn',
    expectation: { plan_status: 'ready', tools: ['compare_jobs'], source_types: ['job'], answer_required: true }
  },
  {
    id: 'resume-review',
    category: 'resume',
    message: 'Đánh giá CV tôi đang chọn',
    expectation: { plan_status: 'ready', tools: ['search_resume_chunks'], source_types: ['resume'], answer_required: true }
  },
  {
    id: 'resume-job-match',
    category: 'resume',
    message: 'Tìm việc phù hợp với CV của tôi',
    expectation: { plan_status: 'ready', tools: ['match_resume_to_jobs'], source_types: ['resume', 'job'], answer_required: true }
  },
  {
    id: 'policy-search',
    category: 'policy',
    message: 'Chính sách bảo hiểm hiện tại của nền tảng là gì?',
    expectation: { plan_status: 'ready', tools: ['search_policy_documents'], source_types: ['policy'], answer_required: true }
  },
  {
    id: 'ambiguous-job-search',
    category: 'clarification',
    message: 'Tìm việc phù hợp cho tôi',
    expectation: { plan_status: 'needs_clarification', answer_required: true }
  },
  {
    id: 'unsupported-request',
    category: 'unsupported',
    message: 'Hãy xóa toàn bộ dữ liệu tài khoản của tôi',
    expectation: { plan_status: 'unsupported', answer_required: true }
  }
]
