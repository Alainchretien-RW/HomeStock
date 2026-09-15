document.addEventListener('DOMContentLoaded', () => {
  const user = document.querySelector('.actions');
  if (!user || !window.HomeStockOnline?.enabled) return;
  const badge = document.createElement('span');
  badge.textContent = '● Online';
  badge.style.cssText = 'font-size:12px;font-weight:700;color:#18815b;margin-right:10px;';
  user.prepend(badge);
});
