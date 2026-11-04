// Shared declarative score contract. Never execute a cartridge's comparison code.
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
export const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
export function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function scoreContract(definition){
  const fields=definition?.fields;if(!Array.isArray(fields)||!fields.length||fields.length>4)throw new TypeError('Ugyldige scorefelt.');
  const keys=new Set();let max=0n;
  fields.forEach((f,i)=>{if(!/^[a-z][a-zA-Z0-9]{0,31}$/.test(f.key)||keys.has(f.key)||!Number.isSafeInteger(f.min)||!Number.isSafeInteger(f.max)||f.min<0||f.min>f.max||!['higher_is_better','lower_is_better'].includes(f.direction)||!['integer','duration-ms'].includes(f.format))throw new TypeError('Ugyldig scorefelt.');keys.add(f.key);
    const width=BigInt(f.max)-BigInt(f.min)+1n,radix=f.radix===undefined?width:BigInt(f.radix);if(i>0&&(radix<width||radix>MAX)||(i===0&&f.radix!==undefined))throw new RangeError('Ugyldig radix.');max=i?max*radix+width-1n:width-1n;
  });
  const offset=definition.offset??0;if(!Number.isSafeInteger(offset)||offset<0||(fields.length===1&&(definition.offset!==undefined||fields[0].radix!==undefined)))throw new RangeError('Ugyldig scoreoffset.');
  if(fields.length===1)max=BigInt(fields[0].max);else max+=BigInt(offset);if(max>MAX)throw new RangeError('Scoregrensene er for store for sikker heltallslagring.');
  return {min:fields.length===1?fields[0].min:offset,max:Number(max),direction:fields[0].direction};
}
export function validateScore(def,score){if(!score||typeof score!=='object'||Array.isArray(score)||Object.keys(score).length!==def.fields.length)throw new TypeError('Ugyldig score.');for(const f of def.fields)if(!Number.isSafeInteger(score[f.key])||score[f.key]<f.min||score[f.key]>f.max)throw new RangeError('Score er utenfor grensene.');return score;}
export function encodeScore(def,score){validateScore(def,score);if(def.fields.length===1)return score[def.fields[0].key];const direction=def.fields[0].direction;let n=0n;def.fields.forEach((f,i)=>{const d=BigInt(f.direction===direction?score[f.key]-f.min:f.max-score[f.key]);n=i?n*BigInt(f.radix??(f.max-f.min+1))+d:d;});return Number(n+BigInt(def.offset??0));}
export function decodeScore(def,value){if(!Number.isSafeInteger(value)||value<0)throw new TypeError('Ugyldig kodet score.');if(def.fields.length===1)return validateScore(def,{[def.fields[0].key]:value});let n=BigInt(value)-BigInt(def.offset??0);if(n<0n)throw new RangeError('Ugyldig kodet score.');const out={},direction=def.fields[0].direction;for(let i=def.fields.length-1;i>=0;i--){const f=def.fields[i],r=BigInt(f.radix??(f.max-f.min+1)),d=Number(i?n%r:n);if(i)n/=r;out[f.key]=f.direction===direction?f.min+d:f.max-d;}return validateScore(def,out);}
export function compareScores(def,a,b){validateScore(def,a);validateScore(def,b);for(const f of def.fields)if(a[f.key]!==b[f.key])return (a[f.key]<b[f.key]?-1:1)*(f.direction==='lower_is_better'?1:-1);return 0;}
export function formatScoreObject(def,score){validateScore(def,score);return def.fields.map(f=>{const n=score[f.key];if(f.format==='duration-ms')return `${Math.floor(n/60000).toString().padStart(2,'0')}:${Math.floor(n/1000)%60<10?'0':''}${Math.floor(n/1000)%60}.${String(n%1000).padStart(3,'0')}`;return `${n.toLocaleString('nb-NO')}${f.unit?(f.unit.startsWith('.')?'':' ')+f.unit:''}`;}).join(' · ');}
export function boardKey(game){return `${game.packageId}/${game.mode.id}/${game.mode.rulesVersion}`;}
export function normalizeName(raw){if(typeof raw!=='string')throw new TypeError('Skriv et navn.');const displayName=raw.normalize('NFC').trim();if([...displayName].length<1||[...displayName].length>32||!/^[\p{L}\p{M}\p{N} _.-]+$/u.test(displayName))throw new TypeError('Navn må ha 1–32 tegn: bokstaver, tall, mellomrom, _, - eller .');return {displayName,nameKey:displayName.toLowerCase().normalize('NFC')};}
