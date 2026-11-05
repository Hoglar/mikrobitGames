export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
export const button = (text, onClick, cls = 'button') => el('button', { class: cls, type: 'button', onClick }, text);
export const link = (text, href, cls = 'button secondary') => el('a', { href, class: cls }, text);
export const field = (label, input) => el('label', { class: 'field' }, el('span', {}, label), input);
export const heading = (eyebrow, title, description) => el('div', { class: 'page-heading' }, el('p', { class: 'eyebrow' }, eyebrow), el('h1', {}, title), description && el('p', { class: 'muted' }, description));
export const errorBox = message => el('p', { class: 'notice error', role: 'alert' }, message);
// Native confirm() blocks serial reads and timers while the player decides.
export function confirmDialog(message, {owner=document.body,signal}={}) {
  if(signal?.aborted)return Promise.resolve(false);
  return new Promise(resolve=>{
    const id='confirmation-'+crypto.randomUUID();let settled=false;
    const dialog=el('dialog',{class:'confirmation-dialog','aria-modal':'true','aria-labelledby':id,'aria-describedby':id+'-message'},
      el('h2',{id},'Bekreft'),el('p',{id:id+'-message'},message),
      el('form',{method:'dialog',class:'actions'},
        el('button',{type:'submit',value:'cancel',class:'button secondary',autofocus:true},'Avbryt'),
        el('button',{type:'submit',value:'confirm',class:'button light'},'Ja, fortsett')));
    const finish=value=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);dialog.remove();resolve(value);};
    const abort=()=>{dialog.close();finish(false);};
    dialog.addEventListener('close',()=>finish(dialog.returnValue==='confirm'),{once:true});
    signal?.addEventListener('abort',abort,{once:true});
    owner.append(dialog);dialog.showModal();
  });
}
export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toast(message) {
  const node = document.querySelector('#toast'); node.textContent = message; node.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 6500);
}
