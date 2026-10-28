/**
 * @typedef {'disconnected'|'connecting'|'connected'} Connection
 * @typedef {{input:'a'|'b'|'logo', count:number}} PressEvent
 * @typedef {{sensors:ReadonlyArray<string>, outputs:{ledDisplay:ReadonlyArray<string>,
 *   speaker:ReadonlyArray<string>, builtInSounds:ReadonlyArray<string>}}} Capabilities
 * @typedef {{type:'deviceInfo', protocolVersion:1, board:'microbit-v2',
 *   snapshotIntervalMs:20, capabilities:Capabilities}} DeviceInfo
 * @typedef {{n:number,u:number,a:number,b:number,ac:number,bc:number,x:number,y:number,z:number,
 *   t:number,l:number,m:number,q:number,qc:number}} Snapshot
 * @typedef {{connection:Connection,inputAvailable:boolean,board:'microbit-v2'|null,
 *   buttons:{aPressed:boolean,bPressed:boolean},tilt:{x:number,y:number},
 *   accelerometer:{xMg:number,yMg:number,zMg:number,strengthMg:number,gesture:'shake'|null}|null,
 *   temperatureC:number|null,lightLevel:number|null,
 *   microphone:{soundLevel:number,soundEvent:'quiet'|'loud'}|null,
 *   touch:{logoPressed:boolean|null}} InputState
 * @typedef {{frequencyHz:number,durationMs:number}} Note
 * @typedef {{now:()=>number,setTimeout:(callback:()=>void,ms:number)=>unknown,
 *   clearTimeout:(id:unknown)=>void}} Clock
 * @typedef {{kind:string,message:string,protocolCode?:string,commandId?:number}} InputError
 */
export {};
