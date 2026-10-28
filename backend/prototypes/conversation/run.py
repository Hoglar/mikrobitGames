"""Local, disposable direct-engine diagnostic. Bypasses API; no FoM run."""
import json
import os
from pathlib import Path
import signal
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'backend/verification'))
from harness import ADA, NORA, Environment, request
from chat import Conversation, Ollama
from data_tools import DataTools


def environment():
    for key in ('DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY'):
        os.environ.pop(key, None)
    local = ROOT / 'backend/check.local.json'
    settings = json.loads(local.read_text()) if local.exists() else {}
    config = {key: settings[key] for key in ('postgres_bin', 'model_directory', 'model') if key in settings}
    return Environment(config, real_model=True)


def prepare(e):
    e.start()
    e.require('db', 'ollama')
    # The existing adapter gets only the read-only role; never the admin DSN.
    os.environ['MBG_DATABASE_DSN'] = e.ai_dsn
    model = e.config.get('model', 'qwen3:4b-instruct-2507-q4_K_M')
    code, _, result = request(e.ollama_url+'/api/tags', timeout=5)
    if code != 200 or model not in {row['name'] for row in result.get('models', [])}:
        raise RuntimeError('Den avtalte modellen mangler. Ingen nedlasting startet.')
    return Ollama(e.ollama_url, model)


def main():
    e = environment()
    try:
        print('Starter separat samtaleprototype med syntetiske Ada/Nora-data …', flush=True)
        model = prepare(e)
        # Only the database and Ollama are used in interactive prototype mode.
        e.stop_service('api')
        e.stop_service('ai')
        name, game = 'Ada', 'Poengjakt'
        chat = Conversation(model, DataTools(ADA), name, game)
        last = None
        print('Klar. Du er Ada. Valgt spill: Poengjakt. Snakk fritt eller spør om rekorder.')
        print('Hukommelse: maks 20 utvekslinger, bare i denne økten; eldre meldinger kan glemmes tidligere ved plassmangel.')
        print('/ny = glem samtalen, /spiller ada|nora = bytt og glem, /spill navn = velg spill')
        print('/verktøy = vis siste dataoppslag, /avslutt = stopp og rydd opp. Ingen FoM.')
        while True:
            question = input(f'\n{name} / {game or "ingen"}> ').strip()
            if not question:
                continue
            command, _, value = question.partition(' ')
            if command == '/avslutt':
                break
            if command == '/ny':
                chat.clear()
                last = None
                print('Samtalen er glemt.')
            elif command == '/spiller' and value.lower() in ('ada', 'nora'):
                chat.clear()
                name = value.capitalize()
                chat = Conversation(model, DataTools({'Ada': ADA, 'Nora': NORA}[name]), name, game)
                last = None
                print('Byttet spiller. Tidligere samtale er glemt.')
            elif command == '/spill' and 1 <= len(value.strip()) <= 100:
                game = None if value.lower() == 'ingen' else value.strip()
                chat.game = game
            elif command == '/verktøy':
                print(json.dumps(last['tools'] if last else [], ensure_ascii=False, indent=2))
            elif command.startswith('/'):
                print('Ukjent kommando. Bruk /ny, /spiller ada|nora, /spill navn, /verktøy eller /avslutt.')
            else:
                print('Qwen arbeider …', flush=True)
                start = time.monotonic()
                try:
                    last = chat.ask(question)
                except ValueError as exc:
                    print(exc)
                    continue
                for notice in last['notices']:
                    print('Hukommelse:', notice)
                print(last['answer'])
                print(f'({time.monotonic()-start:.1f} s; {len(last["tools"])} dataoppslag)')
    except (EOFError, KeyboardInterrupt):
        print('\nAvslutter …')
    finally:
        e.close()
        os.environ.pop('MBG_DATABASE_DSN', None)
        print('Egne tjenester stoppet og testdatabase fjernet. Samtalen er ikke lagret.')


if __name__ == '__main__':
    def interrupted(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    main()
