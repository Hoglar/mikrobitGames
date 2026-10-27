"""Install only the selected preexisting Ollama manifest/blobs; never download."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

source, destination = map(Path, sys.argv[1:])
relative = Path('manifests/registry.ollama.ai/library/qwen3/4b-instruct-2507-q4_K_M')
manifest = json.loads((source / relative).read_text())
target = destination / relative
target.parent.mkdir(parents=True, exist_ok=True)
for item in [manifest['config'], *manifest['layers']]:
    digest = item['digest']
    if not digest.startswith('sha256:') or len(digest) != 71 or any(c not in '0123456789abcdef' for c in digest[7:]):
        raise ValueError('Unexpected model digest')
    name = 'sha256-' + digest[7:]
    original = source / 'blobs' / name
    copy = destination / 'blobs' / name
    copy.parent.mkdir(parents=True, exist_ok=True)
    if not copy.exists():
        shutil.copyfile(original, copy)
    with copy.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != digest[7:]:
            raise ValueError('Model blob checksum mismatch')
shutil.copyfile(source / relative, target)
print('Den avtalte modellens lokale filer er kopiert og kontrollert mot manifestets SHA-256.')
