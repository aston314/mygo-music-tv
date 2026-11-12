#!/usr/bin/env python3
"""Refresh public plugin metadata from the upstream install-link directory."""
import argparse
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SOURCE = 'https://music.egoist.dev/zh/plugins'
REPOSITORY = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$')


class DirectoryParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.card = None
        self.capture = None
        self.entries = []
        self.seen = set()
        self.links = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'article':
            self.card = {'repository': '', 'name': '', 'description': ''}
        if tag == 'a':
            link = urlparse(attrs.get('href', ''))
            if link.scheme == 'mygo-music' and link.netloc == 'install-plugin':
                repo = parse_qs(link.query).get('repo', [''])[0]
                if not REPOSITORY.fullmatch(repo) or '..' in repo:
                    raise ValueError('Invalid upstream repository')
                self.links.add(repo.lower())
                if self.card is not None:
                    self.card['repository'] = repo
        if self.card is None:
            return
        if tag in ('h2', 'h3'):
            self.capture = 'name'
        elif tag == 'p':
            self.capture = 'description'

    def handle_data(self, text):
        if self.card is not None and self.capture:
            self.card[self.capture] += text + ' '

    def handle_endtag(self, tag):
        if tag in ('h2', 'h3', 'p'):
            self.capture = None
        if tag == 'article' and self.card is not None:
            entry = {key: ' '.join(value.split()) for key, value in self.card.items()}
            repo = entry['repository']
            if repo and repo.lower() not in self.seen:
                entry['name'] = entry['name'] or repo.split('/')[1]
                entry['name'] = entry['name'][:200]
                entry['description'] = entry['description'][:320]
                self.entries.append(entry)
                self.seen.add(repo.lower())
            self.card = None
            self.capture = None


def fetch():
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'MyMusicPlus-Catalog-Sync/1'})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read((8 << 20) + 1)
    if len(body) > 8 << 20:
        raise ValueError('Upstream directory exceeds size limit')
    parser = DirectoryParser()
    parser.feed(body.decode('utf-8'))
    if not parser.entries or len(parser.entries) > 2000 or parser.links != parser.seen:
        raise ValueError('Upstream directory is empty or invalid; preserving previous snapshot')
    return parser.entries


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--output', type=Path, default=Path('plugin-catalog.json'))
    args = cli.parse_args()
    entries = fetch()
    if args.output.exists():
        old = json.loads(args.output.read_text())
        old_count = len(old.get('entries', []))
        if old_count and len(entries) < old_count * 0.7:
            raise ValueError('Large unexpected directory shrink; preserving previous snapshot')
    snapshot = {'schema': 1, 'source': SOURCE,
                'updatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'entries': entries}
    temporary = args.output.with_suffix('.json.part')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(args.output)
    print(f'Synchronized {len(entries)} public plugin entries')


if __name__ == '__main__':
    main()
