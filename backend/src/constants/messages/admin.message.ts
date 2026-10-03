const AdminMessages = {
  ADMIN_LOGIN_SUCCESS: 'Đăng nhập admin thành công',
  ADMIN_LOGOUT_SUCCESS: 'Đăng xuất admin thành công',
  ADMIN_ME_SUCCESS: 'Lấy thông tin admin thành công',
  ADMIN_LOGIN_FAILED: 'Tài khoản hoặc mật khẩu không đúng',
  ADMIN_FORBIDDEN: 'Bạn không có quyền truy cập khu vực admin',
  ADMIN_ACCOUNT_DISABLED: 'Tài khoản admin đã bị vô hiệu hóa',
  ADMIN_SESSION_NOT_FOUND: 'Phiên đăng nhập admin không tồn tại',
  ADMIN_SESSION_EXPIRED: 'Phiên đăng nhập admin đã hết hạn',
  ADMIN_COMPANY_VERIFICATION_UPDATED_SUCCESS: 'Cập nhật trạng thái xác minh công ty thành công',
  ADMIN_SEPAY_CONNECTION_TEST_SUCCESS: 'Kiểm tra kết nối SePay thành công',
  ADMIN_RAG_CHAT_CONNECTION_TEST_SUCCESS: 'Kiểm tra kết nối RAG Chat thành công'
} as const

export default AdminMessages
