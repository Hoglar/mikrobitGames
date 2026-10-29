export class ApiError extends Error {
  constructor(message, { status=0, code='NETWORK_ERROR', requestId=null, retryAfter=null }={}) { super(message);this.name='ApiError';Object.assign(this,{status,code,requestId,retryAfter}); }
}
export function createApi(fetcher=(...args)=>fetch(...args)) {
  return async (path,{method='GET',body,timeoutMs=15000}={})=>{
    if(!path.startsWith('/')||path.startsWith('//')||path.includes('://'))throw new TypeError('Ugyldig API-sti.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetcher(`/api/v1${path}`,{method,credentials:'same-origin',headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json','X-MBG-Request':'1'}:{})},...(method==='POST'?{body:JSON.stringify(body??{})}:{}),signal:controller.signal});
      const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}
      const meta={status:response.status,requestId:response.headers.get('X-Request-ID')??data?.request_id??null,retryAfter:response.headers.get('Retry-After')};
      if(!response.ok)throw new ApiError(data?.error?.message??`Tjenesten svarte HTTP ${response.status}.`,{...meta,code:data?.error?.code??'HTTP_ERROR'});
      if(response.status!==204 && (!data||typeof data!=='object'))throw new ApiError('Serveren svarte med et ugyldig format.',{...meta,code:'INVALID_RESPONSE'});
      return {...meta,data};
    }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(controller.signal.aborted?'Ventetiden er utløpt. Utfallet kan være ukjent.':'Kunne ikke kontakte serveren.',{code:controller.signal.aborted?'CLIENT_TIMEOUT':'NETWORK_ERROR'});}finally{clearTimeout(timer);}
  };
}
export const api=createApi();
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function validateSession(data) {
  if(!uuid(data?.player?.id)||typeof data.player.username!=='string'||!Number.isFinite(Date.parse(data.expires_at))||!Number.isFinite(Date.parse(data.absolute_expires_at)))throw new ApiError('Ugyldig sesjonssvar.',{code:'INVALID_RESPONSE'});
  return data;
}
export function validateResult(data,attempt) {
  const a=data?.attempt, record=data?.record, current=data?.current_record;
  const validRecord=r=>r&&uuid(r.id)&&r.player_id===attempt.playerId&&r.game_id===attempt.gameId&&Number.isSafeInteger(r.value)&&r.value>=attempt.min_value&&r.value<=attempt.max_value&&Number.isFinite(Date.parse(r.created_at));
  const outcome=a?.record_outcome;
  if(!a||a.id!==attempt.attemptId||a.player_id!==attempt.playerId||a.game_id!==attempt.gameId||a.status!==attempt.status||a.value!==attempt.value||!Number.isFinite(Date.parse(a.created_at))||data.outcome!==outcome||!['created','already_recorded','not_improved','not_eligible'].includes(outcome))throw new ApiError('Lagring er ikke bekreftet: ugyldig resultatsvar.',{code:'INVALID_RESPONSE'});
  if(attempt.status==='incomplete' ? outcome!=='not_eligible' : outcome==='not_eligible')throw new ApiError('Motstridende resultatstatus.',{code:'INVALID_RESPONSE'});
  if(['created','already_recorded'].includes(outcome) ? !validRecord(record)||a.record_id!==record.id||record.value!==attempt.value||!validRecord(current) : record!==null||a.record_id!==null)throw new ApiError('Ugyldig rekordbekreftelse.',{code:'INVALID_RESPONSE'});
  if(current!==null&&!validRecord(current)||outcome==='not_improved'&&!validRecord(current))throw new ApiError('Ugyldig gjeldende rekord.',{code:'INVALID_RESPONSE'});
  return data;
}
