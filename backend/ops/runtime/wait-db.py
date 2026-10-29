import time
import psycopg
for _ in range(100):
    try:
        with psycopg.connect(host='/run/mbg-db', port=5433, user='mbg-db', dbname='postgres', connect_timeout=1):
            break
    except psycopg.OperationalError:
        time.sleep(.1)
else:
    raise SystemExit('PostgreSQL ble ikke klar innen oppstartsfristen.')
