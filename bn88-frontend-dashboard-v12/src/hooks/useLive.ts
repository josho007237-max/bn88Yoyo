export function connectLive(base: string, tenant: string, onEvent:(t:string,d:any)=>void){
  const es = new EventSource(`${base}/api/live/${tenant}`);
  es.onopen = () => onEvent("live:open", { t: Date.now() });
  es.onerror = () => onEvent("live:error", { t: Date.now() });
  es.addEventListener("hb", e => onEvent("hb", JSON.parse((e as MessageEvent).data)));
  es.addEventListener("case:new", e => onEvent("case:new", JSON.parse((e as MessageEvent).data)));
  return es;
}
