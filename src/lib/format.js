export function formatViews(n) {
  if (n == null) return '0';
  const num = Number(n);
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace('.0', '').replace('.', ',') + 'K';
  }
  return num.toLocaleString('ru-RU');
}

export function formatViewsFull(n) {
  if (n == null) return '0 просмотров';
  return Number(n).toLocaleString('ru-RU') + ' просмотров';
}

export function formatDelta(n) {
  if (n === null || n === undefined || n === '') return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return null;

  const prefix = num > 0 ? '+' : '';
  if (Math.abs(num) >= 1_000_000) {
    return prefix + (num / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  if (Math.abs(num) >= 1_000) {
    return prefix + (num / 1_000).toFixed(1).replace('.', ',') + 'K';
  }
  return prefix + num.toLocaleString('ru-RU');
}

const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}
