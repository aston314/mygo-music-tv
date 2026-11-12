import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

try:
    from . import sync_plugin_catalog as sync
except ImportError:
    import sync_plugin_catalog as sync

CARD = '''<article><h2>Music</h2><span class="plugin-stars">999</span><p>在线 <b>音乐</b></p><div><a href="mygo-music://install-plugin?repo=Author/Music">安装</a><a href="https://github.com/Author/Music">GitHub</a></div></article>'''


class CatalogSyncTests(unittest.TestCase):
    def test_titles_descriptions_and_unique_install_repositories(self):
        parser = sync.DirectoryParser()
        parser.feed(CARD + CARD.replace('Author/Music', 'author/music'))
        self.assertEqual(parser.entries, [{'repository': 'Author/Music', 'name': 'Music', 'description': '在线 音乐'}])
        self.assertEqual(parser.links, parser.seen)

    def test_invalid_install_repository_fails_closed(self):
        with self.assertRaises(ValueError):
            sync.DirectoryParser().feed(CARD.replace('Author/Music', '../escape'))

    def test_fetch_rejects_empty_or_structurally_partial_pages(self):
        class Response:
            def __init__(self, text): self.text = text
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, _): return self.text.encode()
        for text in ['<html>challenge</html>', CARD + '<a href="mygo-music://install-plugin?repo=Other/Missing">install</a>']:
            with self.subTest(text=text), patch.object(sync.urllib.request, 'urlopen', return_value=Response(text)), self.assertRaises(ValueError):
                sync.fetch()

    def test_network_or_large_shrink_preserves_previous_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'catalog.json'
            original = json.dumps({'entries': [{}] * 10})
            path.write_text(original)
            for result in [OSError('offline'), [{'repository': 'A/B', 'name': 'B', 'description': ''}]]:
                with patch('sys.argv', ['sync', '--output', str(path)]), patch.object(sync, 'fetch', side_effect=result if isinstance(result, Exception) else None, return_value=result), self.assertRaises((OSError, ValueError)):
                    sync.main()
                self.assertEqual(path.read_text(), original)

    def test_complete_snapshot_replaces_file_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'catalog.json'
            entries = [{'repository': 'A/B', 'name': 'B', 'description': ''}]
            with patch('sys.argv', ['sync', '--output', str(path)]), patch.object(sync, 'fetch', return_value=entries):
                sync.main()
            snapshot = json.loads(path.read_text())
            self.assertEqual(snapshot['schema'], 1)
            self.assertEqual(snapshot['source'], sync.SOURCE)
            self.assertEqual(snapshot['entries'], entries)
            self.assertFalse(path.with_suffix('.json.part').exists())


if __name__ == '__main__':
    unittest.main()
