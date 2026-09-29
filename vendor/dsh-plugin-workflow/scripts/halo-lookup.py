#!/usr/bin/env python3
"""Read published paper articles from the configured Halo category."""

import base64
import json
import re
import subprocess
import sys
import unicodedata
import urllib.request
from pathlib import Path
from urllib.parse import unquote, urljoin


def normalize_title(value):
    return ''.join(char for char in unicodedata.normalize('NFKC', value).casefold() if char.isalnum())


def paper_information(raw):
    match = re.search(r'(?im)^##\s*论文信息\s*$', raw)
    if not match:
        source = re.search(r'(?im)^##\s*(?:来源|参考资料|references)\s*$', raw)
        if source:
            remainder = raw[source.end():]
            next_section = re.search(r'(?m)^##\s+', remainder)
            section = remainder[:next_section.start()] if next_section else remainder
            lines = [line for line in section.splitlines()
                     if re.match(r'(?i)^\s*[-*]\s*(?:\*\*)?(?:论文|原文|paper)(?:：|:)', line)]
            if lines:
                return '\n'.join(lines)
        return raw[:2500]
    remainder = raw[match.end():]
    next_section = re.search(r'(?m)^##\s+', remainder)
    return remainder[:next_section.start()] if next_section else remainder[:3000]


def article_identity(raw):
    info = paper_information(raw)
    arxiv = set(re.findall(r'(?i)(?:arxiv\.org/(?:abs|pdf|html)/|arxiv\s*:\s*)(\d{4}\.\d{4,5})(?:v\d+)?', info))
    dois = {unquote(item).rstrip('.,;)]}').casefold() for item in re.findall(r'(?i)(?:doi\.org/|doi\s*:\s*)(10\.\d{4,9}/[^\s<>]+)', info)}
    title = re.search(r'(?im)^\s*[-*]?\s*(?:\*\*)?(?:题名|论文|title)(?:：|:)(?:\*\*)?\s*(.+?)\s*$', info)
    return arxiv, dois, normalize_title(title.group(1)) if title else ''


def main():
    if len(sys.argv) != 4:
        raise ValueError('lookup arguments')
    helper, category, encoded = sys.argv[1:]
    if not re.fullmatch(r'[a-z0-9-]+', category):
        raise ValueError('invalid category')
    identity = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
    kind, identifier = identity['kind'], identity['id']
    if kind not in ('arxiv', 'doi', 'title') or not isinstance(identifier, str) or len(identifier) > 240:
        raise ValueError('invalid paper identity')
    root = str(Path(helper).resolve().parent.parent)
    # Match the publisher's local API and public URL without exposing its credentials.
    config = subprocess.run(['bash', '-c',
        'source "$1/.env"; printf "%s\n%s" "${HALO_BASE_URL:-http://127.0.0.1:${HALO_PORT:-4147}}" "${HALO_PUBLIC_URL:-${HALO_EXTERNAL_URL:-}}"',
        'lookup', root], check=True, capture_output=True, text=True).stdout.splitlines()
    base, public_base = config[0].rstrip('/'), config[1].rstrip('/')
    if not re.match(r'^https?://', public_base):
        raise ValueError('public URL unavailable')
    matches = []
    page = 1
    while page <= 20:
        with urllib.request.urlopen(f'{base}/apis/api.content.halo.run/v1alpha1/posts?size=100&page={page}', timeout=20) as response:
            listed = json.load(response)
        for summary in listed.get('items', []):
            if category not in summary.get('spec', {}).get('categories', []) or summary.get('status', {}).get('phase') != 'PUBLISHED':
                continue
            post_id = summary.get('metadata', {}).get('name', '')
            if not re.fullmatch(r'[a-zA-Z0-9-]+', post_id):
                continue
            with urllib.request.urlopen(f'{base}/apis/api.content.halo.run/v1alpha1/posts/{post_id}', timeout=20) as response:
                post = json.load(response)
            arxiv, dois, title = article_identity(post.get('content', {}).get('raw', ''))
            if not ((kind == 'arxiv' and identifier in arxiv) or
                    (kind == 'doi' and identifier.casefold() in dois) or
                    (kind == 'title' and normalize_title(identifier) == title and title)):
                continue
            permalink = post.get('status', {}).get('permalink', '')
            if not permalink.startswith('/'):
                continue
            matches.append({'postId': post_id, 'slug': post.get('spec', {}).get('slug', ''),
                            'title': post.get('spec', {}).get('title', ''),
                            'url': urljoin(public_base + '/', permalink),
                            'createdAt': post.get('metadata', {}).get('creationTimestamp', '')})
        if not listed.get('hasNext'):
            break
        page += 1
    else:
        raise ValueError('article index exceeds lookup limit')
    matches.sort(key=lambda item: item['createdAt'], reverse=True)
    print(json.dumps({'matches': matches}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('HALO_LOOKUP_FAILED', file=sys.stderr)
        sys.exit(1)
