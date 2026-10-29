"""Publish an already-built, self-contained frontend directory atomically."""
import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import sys
from urllib.request import urlopen


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('build', type=Path, help='Frontend build, normally webapp/dist')
    args=p.parse_args()
    if os.geteuid()!=0: p.error('Kjør med sudo /usr/bin/python3.')
    source=args.build.resolve()
    if not source.is_dir() or not (source/'index.html').is_file():p.error('Bygget mangler index.html.')
    for path in source.rglob('*'):
        if path.is_symlink() or any(part.startswith('.') for part in path.relative_to(source).parts):
            p.error('Byggmappen må bare inneholde publiserbare filer, uten symlinker/skjulte filer.')
        if path.suffix in ('.pem','.key','.dump') or (not path.is_file() and not path.is_dir()):
            p.error('Uventet filtype i byggmappen.')
    root=Path('/var/www/mikrobit-games')
    if not (root/'current').is_symlink():p.error('Kjør driftsoppsettet først.')
    folder=root/'releases'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    shutil.copytree(source,folder)
    for path in [folder,*folder.rglob('*')]:path.chmod(0o755 if path.is_dir() else 0o644)
    previous=(root/'current').resolve()
    for name,target in (('previous',previous),('current',folder)):
        temporary=root/(name+'.new')
        if temporary.is_symlink():temporary.unlink()
        temporary.symlink_to(target);os.replace(temporary,root/name)
    try:
        with urlopen('http://127.0.0.1:8080/',timeout=5) as response:
            if response.status!=200:raise RuntimeError('Webinngangen svarte ikke 200.')
    except Exception:
        temporary=root/'current.new';temporary.symlink_to(previous);os.replace(temporary,root/'current')
        raise RuntimeError('Webkontrollen feilet; forrige publisering er gjenopprettet.') from None
    print('Publisert:',folder)
    print('Forrige bygg er beholdt:',previous)


if __name__=='__main__':
    try:main()
    except (OSError,RuntimeError) as exc:sys.exit(str(exc))
