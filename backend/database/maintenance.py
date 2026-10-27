"""Backup/restore adapter: never put the administrator password in argv/logs."""
import os
from pathlib import Path
import subprocess
import sys
import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo


def main():
    mode, filename = sys.argv[1:]
    if mode not in ('backup', 'restore'):
        raise ValueError('Ukjent vedlikeholdsoperasjon.')
    bin_dir = Path(os.environ.get('MBG_POSTGRES_BIN', '/usr/lib/postgresql/17/bin'))
    target = conninfo_to_dict(os.environ['MBG_ADMIN_DSN'])
    env = {k: v for k, v in os.environ.items() if not k.startswith('MBG_')}
    # libpq reads the secret from the process environment, protected by UID.
    if 'password' in target:
        env['PGPASSWORD'] = target.pop('password')
    if 'sslpassword' in target:
        raise ValueError('Kryptert klientnøkkel er utenfor det lokale oppsettet.')
    dsn = make_conninfo(**target)
    os.umask(0o077)
    if mode == 'backup':
        # Reserve the destination without clobbering existing backups.
        with open(filename, 'xb') as destination:
            result = subprocess.run([str(bin_dir/'pg_dump'), '--format=custom', '--dbname', dsn],
                                    env=env, stdout=destination, stderr=subprocess.PIPE)
        if result.returncode:
            raise RuntimeError('Sikkerhetskopiering feilet. Den nye filen er ufullstendig og må ikke brukes.')
        print('Sikkerhetskopi skrevet med privat filtilgang.')
    else:
        result = subprocess.run([str(bin_dir/'pg_restore'), '--exit-on-error', '--single-transaction',
                                 '--no-owner', '--dbname', dsn, filename],
                                env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode:
            raise RuntimeError('Gjenoppretting feilet. Målet skal være en separat tom database med nødvendige roller.')
        with psycopg.connect(os.environ['MBG_ADMIN_DSN'], connect_timeout=3) as conn:
            conn.execute('DELETE FROM app.sessions')
        print('Gjenopprettet. Sesjoner er slettet. Avklar kontoslettinger etter kopitidspunkt før åpning.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, RuntimeError, psycopg.Error):
        # Driver/subprocess exceptions can contain connection secrets or SQL.
        print('Vedlikehold feilet. Kontroller mål, rolle, fil og tilgjengelighet; ikke åpne tjenesten.', file=sys.stderr)
        raise SystemExit(1) from None
