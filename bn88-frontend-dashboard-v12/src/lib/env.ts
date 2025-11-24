export function connectEvents(tenant = import.meta.env.VITE_TENANT) {
  const url = `${import.meta.env.VITE_API_BASE}/api/events?tenant=${tenant}`;
  const es = new EventSource(url, { withCredentials: false });
  es.addEventListener('hello', e => console.log('hello', e.data));
  es.addEventListener('ping',  e => {/* no-op keepalive */});
  es.addEventListener('message', e => {
    const msg = JSON.parse(e.data || '{}');
    if (msg.type === 'case:new' || msg.type === 'stats:update') {
      // เรียกโหลดข้อมูลใหม่
      loadAll(msg.botId);
    }
  });
  return es;
}
