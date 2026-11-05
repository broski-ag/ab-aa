import type { HeroElementDef } from './heroControls';

/** the live DOM nodes of one hero element (a testimonial is several nodes moved together) */
export function resolveNodes(def: HeroElementDef): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const sel of def.targets) {
    const node = document.querySelector<HTMLElement>(sel);
    if (node) out.push(node);
  }
  return out;
}

function firstText(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) {
    if (n.textContent && n.textContent.trim()) return n as Text;
    n = walker.nextNode();
  }
  return null;
}

/** where a full-size, object-fit: contain image is actually drawn */
function containRect(img: HTMLImageElement, box: DOMRect): DOMRect {
  if (!img.naturalWidth || !img.naturalHeight || !box.width || !box.height) return box;
  const k = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  return new DOMRect(box.left + (box.width - w) / 2, box.top + (box.height - h) / 2, w, h);
}

/**
 * On-screen box of what the visitor actually sees. The exported text boxes are tiny
 * (56px tall for a 700px headline), so text is measured from its glyph line, not the box.
 */
export function visualRect(nodes: HTMLElement[]): DOMRect | null {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;

  for (const node of nodes) {
    let rect: DOMRect | null = null;
    const text = node.id.startsWith('text_') ? firstText(node) : null;
    if (text) {
      const range = document.createRange();
      range.selectNodeContents(text);
      rect = range.getBoundingClientRect();
    } else {
      const img = node instanceof HTMLImageElement ? node : node.querySelector('img');
      const box = node.getBoundingClientRect();
      rect = img && (node.classList.contains('hero-rig-figure') || node.classList.contains('hero-me2') || node === img)
        ? containRect(img, img.getBoundingClientRect().width ? img.getBoundingClientRect() : box)
        : box;
    }
    if (!rect || (rect.width === 0 && rect.height === 0)) continue;
    l = Math.min(l, rect.left);
    t = Math.min(t, rect.top);
    r = Math.max(r, rect.right);
    b = Math.max(b, rect.bottom);
  }
  return Number.isFinite(l) ? new DOMRect(l, t, r - l, b - t) : null;
}
