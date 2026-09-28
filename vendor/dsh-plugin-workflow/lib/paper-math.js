import katex from 'katex';
import { Resvg } from '@resvg/resvg-js';

globalThis.MathJax = {
  loader: {
    paths: { mathjax: 'mathjax' },
    load: ['input/tex', 'output/svg', 'adaptors/liteDOM'],
    require: file => import(file),
  },
  output: { font: 'mathjax-newcm' },
  svg: { fontCache: 'local' },
};
await import('mathjax/startup.js');
await globalThis.MathJax.startup.promise;

const mathjax = globalThis.MathJax;
const adaptor = mathjax.startup.adaptor;

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export async function renderPaperMath(tex, displayMode = false) {
  const source = tex.trim();
  katex.renderToString(source, { displayMode, output: 'mathml', throwOnError: true, trust: false, strict: 'warn' });
  const ex = displayMode ? 6.5 : 7;
  const node = await mathjax.tex2svgPromise(source, { display: displayMode, em: ex * 2, ex, containerWidth: 600 });
  const svg = adaptor.serializeXML(adaptor.tags(node, 'svg')[0]);
  const widthEx = Number(svg.match(/\bwidth="([\d.]+)ex"/)?.[1]);
  const heightEx = Number(svg.match(/\bheight="([\d.]+)ex"/)?.[1]);
  if (!Number.isFinite(widthEx) || !Number.isFinite(heightEx)) throw new Error('PAPER_MATH_SIZE_INVALID');
  const width = Math.max(1, Math.ceil(widthEx * ex));
  const height = Math.max(1, Math.ceil(heightEx * ex));
  const sizedSvg = svg.replace(/\bwidth="[\d.]+ex"/, `width="${width}px"`).replace(/\bheight="[\d.]+ex"/, `height="${height}px"`);
  const png = new Resvg(sizedSvg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng();
  const sourceImage = `data:image/png;base64,${png.toString('base64')}`;
  const label = escape(source);
  const inlineStyle = displayMode ? '' : ' style="display:inline-block;vertical-align:-0.18em;margin:0;max-width:100%;height:auto"';
  return `<img class="paper-math-image" src="${sourceImage}" width="${width}" height="${height}" alt="${label}" loading="lazy"${inlineStyle}>`;
}
