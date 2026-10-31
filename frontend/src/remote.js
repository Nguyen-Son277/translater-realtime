export function invitationWarning({ protocol, hostname }) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || !host.includes('.') && !host.includes(':')
    || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
    || host === '::1' || host === '::' || /^(fc|fd|fe[89ab])[0-9a-f]*:/i.test(host);
  if (protocol !== 'https:' || local) return 'Địa chỉ hiện tại là HTTP hoặc địa chỉ nội bộ. Người ở mạng khác có thể không mở được lời mời. Hãy mở ứng dụng bằng URL HTTPS công khai rồi tạo liên kết mời từ URL đó.';
  return '';
}
