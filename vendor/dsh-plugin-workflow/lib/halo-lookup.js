import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fail } from './definition.js';

export function paperIdentity(request) {
  const text = typeof request === 'string' ? request
    : typeof request?.text === 'string' ? request.text
      : typeof request?.request === 'string' ? request.request : '';
  const filenames = (request?.attachments ?? []).map(item => item?.attachment?.name ?? item?.name ?? '').join(' ');
  const material = `${text} ${filenames}`;
  const arxiv = material.match(/(?:arxiv\.org\/(?:abs|pdf|html)\/|arxiv\s*:\s*|\b)(\d{4}\.\d{4,5})(?:v\d+)?\b/i);
  if (arxiv) return { kind: 'arxiv', id: arxiv[1] };
  const doi = material.match(/(?:doi\.org\/|doi\s*:\s*)(10\.\d{4,9}\/[^\s<>]+)/i);
  if (doi) {
    let id = doi[1];
    try { id = decodeURIComponent(id); } catch {}
    return { kind: 'doi', id: id.replace(/[.,;)}\]]+$/, '').toLowerCase() };
  }
  const titled = text.match(/(?:论文标题|题名|title)\s*[:：]\s*([^\n]{5,220})/i);
  if (titled) return { kind: 'title', id: titled[1].trim() };
  if (text.length >= 12 && text.length <= 220 && !/[\n。？！]|https?:\/\//.test(text) && !/请|帮我|解读|精读/.test(text))
    return { kind: 'title', id: text.trim() };
  if (request?.attachments?.length === 1) {
    const title = filenames.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
    if (title.length >= 12 && !/^(?:paper|document|论文)$/i.test(title)) return { kind: 'title', id: title };
  }
  return null;
}

export async function lookupHaloPaper(input, configPath, signal) {
  const identity = paperIdentity(input.request ?? input);
  if (!identity) fail('PAPER_IDENTITY_REQUIRED', '提供 arXiv 链接、DOI 或论文标题后再检索已有解读');
  let destination;
  try { destination = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { fail('HALO_DESTINATION_REQUIRED'); }
  if (!/^[a-zA-Z0-9_.@-]+$/.test(destination.sshHost ?? '') ||
      !/^\/[a-zA-Z0-9_./-]+$/.test(destination.helper ?? '') ||
      !/^[a-z0-9-]+$/.test(destination.category ?? '')) fail('HALO_DESTINATION_INVALID');
  const code = await readFile(new URL('../scripts/halo-lookup.py', import.meta.url), 'utf8');
  const encoded = Buffer.from(JSON.stringify(identity)).toString('base64url');
  const result = await new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', destination.sshHost,
      `python3 - ${destination.helper} ${destination.category} ${encoded}`], { signal, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', chunk => { out += chunk; if (out.length > 128000) child.kill(); });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => reject(new Error('HALO_LOOKUP_UNAVAILABLE')));
    child.on('close', code => {
      if (code !== 0) return reject(new Error('HALO_LOOKUP_FAILED'));
      try { resolve(JSON.parse(out)); }
      catch { reject(new Error('HALO_LOOKUP_RESPONSE_INVALID')); }
    });
    child.stdin.end(code);
  });
  const matches = result?.matches;
  if (!Array.isArray(matches) || matches.length > 30 || matches.some(item =>
    typeof item.title !== 'string' || typeof item.slug !== 'string' ||
    typeof item.postId !== 'string' || !/^https?:\/\//.test(item.url ?? '')))
    fail('HALO_LOOKUP_RESPONSE_INVALID');
  const linksText = matches.map((item, index) => `${index + 1}. ${item.title}：${item.url}`).join('\n');
  return { found: matches.length > 0, status: matches.length ? 'found' : 'not_found',
    identity, matches, linksText, url: matches[0]?.url ?? null };
}

export function publicationTarget(input) {
  const matches = input.matches;
  if (!Array.isArray(matches) || matches.length !== 1) fail('PUBLICATION_TARGET_AMBIGUOUS');
  const match = matches[0];
  if (!/^[a-zA-Z0-9-]+$/.test(match.postId ?? '') ||
      !/^[a-z0-9][a-z0-9-]{2,100}$/.test(match.slug ?? ''))
    fail('PUBLICATION_TARGET_INVALID');
  return { mode: 'update', publication: { postId: match.postId, slug: match.slug }, url: match.url };
}
