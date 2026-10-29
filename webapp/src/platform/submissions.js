import { validateResult } from '../app/api.js';
// Attempts remain only in memory and never change owner or request body.
export function createSubmissionQueue({api, getPlayer}) {
  const entries=new Map();
  return {
    list(){return [...entries.values()];},
    add(attempt){if(!entries.has(attempt.attemptId))entries.set(attempt.attemptId,{attempt,state:'unconfirmed',data:null,error:null});return entries.get(attempt.attemptId);},
    send(id){
      const entry=entries.get(id);if(!entry)return Promise.reject(new Error('Ukjent forsøk.'));
      if(entry.operation)return entry.operation;
      if(entry.state==='saved')return Promise.resolve(entry.data);
      if(getPlayer()?.id!==entry.attempt.playerId)return Promise.reject(new Error('Logg inn med samme konto som startet forsøket.'));
      const a=entry.attempt;entry.state='saving';entry.error=null;
      entry.operation=(async()=>{
        try{const response=await api(`/games/${a.gameId}/results`,{method:'POST',body:{attempt_id:a.attemptId,status:a.status,value:a.value}});
          if(![200,201].includes(response.status))throw new Error('Uventet status ved lagring.');
          const data=validateResult(response.data,a);entry.data=data;entry.state='saved';return data;
        }catch(error){entry.error=error;entry.state=error.code==='ATTEMPT_CONFLICT'?'conflict':'unconfirmed';throw error;}
        finally{entry.operation=null;}
      })();return entry.operation;
    }
  };
}
