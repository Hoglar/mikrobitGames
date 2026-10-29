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
export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toast(message) {
  const node = document.querySelector('#toast'); node.textContent = message; node.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 6500);
}
