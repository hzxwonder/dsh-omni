import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fail } from './definition.js';
import { renderPaperOverview } from './paper-overview.js';
import { insertPaperOverview, renderPaperMarkdown, renderWechatPage } from './paper-render.js';

export async function publishHalo(input, configPath, signal) {
  let destination;
  try { destination = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { fail('HALO_DESTINATION_REQUIRED'); }
  if (!/^[a-zA-Z0-9_.@-]+$/.test(destination.sshHost ?? '') || !/^\/[a-zA-Z0-9_./-]+$/.test(destination.helper ?? '')) fail('HALO_DESTINATION_INVALID');
  const article = input.article;
  if (!article || typeof article.text !== 'string' || !article.text.trim() || typeof article.title !== 'string' || !/^[a-z0-9][a-z0-9-]{2,100}$/.test(article.slug ?? '')) fail('PUBLISH_ARTICLE_INVALID');
  if (!Number.isFinite(input.review?.score) || input.review.score < 85) fail('PUBLISH_REVIEW_REQUIRED');
  const publication = input.publication ?? input.request?.publication;
  if (publication?.slug && article.slug !== publication.slug) fail('PUBLISH_TARGET_MISMATCH');
  if (publication?.postId && !/^[a-zA-Z0-9-]+$/.test(publication.postId)) fail('PUBLISH_TARGET_INVALID');
  let overview;
  let rendered;
  let publishText = article.text;
  if (article.overview) {
    overview = await renderPaperOverview(article.overview);
    const digest = createHash('sha256').update(overview.svg).digest('hex').slice(0, 12);
    overview.file = `${article.slug}-${digest}.svg`;
    publishText = insertPaperOverview(publishText, `/lab/assets/paper-overviews/${overview.file}`);
    rendered = await renderPaperMarkdown(publishText);
  }
  const payload = JSON.stringify({ title: article.title, slug: article.slug, text: publishText, renderedHtml: rendered?.html,
    overview: overview ? { file: overview.file, svg: overview.svg } : undefined,
    category: destination.category, expectedPostId: publication?.postId, dryRun: Boolean(input.dryRun) });
  if (Buffer.byteLength(payload) > 4 * 1024 * 1024) fail('PUBLISH_SIZE_LIMIT');
  const result = await new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', destination.sshHost, `python3 ${destination.helper}`], { signal, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; if (out.length > 65536) child.kill(); });
    // Remote diagnostics may contain private server data; expose only a stable error code.
    child.stderr.resume();
    child.on('error', () => reject(new Error('HALO_CONNECTION_FAILED')));
    child.stdin.on('error', () => {});
    child.on('close', code => {
      if (code !== 0) return reject(new Error('HALO_PUBLISH_FAILED'));
      try {
        const result = JSON.parse(out);
        if (result.status !== (input.dryRun ? 'validated' : 'published') || (!input.dryRun && !/^https?:\/\//.test(result.url ?? ''))) throw Error();
        resolve(result);
      } catch { reject(new Error('HALO_RESPONSE_INVALID')); }
    });
    child.stdin.end(payload);
  });
  if (overview && !input.dryRun) {
    const folder = join(dirname(configPath), 'exports', article.slug);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const svg = join(folder, overview.file);
    const source = join(folder, `${article.slug}.excalidraw`);
    const wechat = join(folder, 'wechat.html');
    await Promise.all([
      writeFile(svg, overview.svg, { mode: 0o600 }),
      writeFile(source, JSON.stringify(overview.scene, null, 2) + '\n', { mode: 0o600 }),
      writeFile(wechat, renderWechatPage({ title: article.title, html: rendered.html, overviewSvg: overview.svg }), { mode: 0o600 }),
    ]);
    return { ...result, wechatFile: wechat, wechatUrl: pathToFileURL(wechat).href, overviewSvg: svg, overviewSource: source };
  }
  return result;
}
