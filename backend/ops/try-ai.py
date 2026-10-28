"""Interactive, local AI diagnosis with disposable synthetic data; no FoM run."""
import argparse
import json
import os
from pathlib import Path
import signal
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/verification'))
from harness import ADA, NORA, POINTS, SPRINT, MODEL, Environment, request

PLAYERS = {'ada': ADA, 'nora': NORA}
GAMES = {'ingen': None, 'poengjakt': POINTS, 'sprint': SPRINT}
HELP = '''Skriv et spørsmål og trykk Enter. Samtalen husker opptil 20 utvekslinger.
/ny                            Slett denne innloggingens samtaleminne.
/spiller ada|nora               Velg hvem «jeg» betyr.
/spill ingen|poengjakt|sprint    Velg valgfri spillkontekst.
/data                          Vis fasiten fra testdatabasen.
/hjelp                         Vis disse kommandoene.
/avslutt                       Stopp og slett den midlertidige databasen.'''


def show_data(environment):
    print('Offentlig rekordhistorikk, eldste først (ikke alle spillforsøk):')
    rows = environment.rows('''SELECT p.username, g.name, r.value, g.score_unit,
        g.ranking_direction FROM ai_read.records r
        JOIN ai_read.players p ON p.id = r.player_id
        JOIN ai_read.games g ON g.id = r.game_id
        ORDER BY p.username, g.name, r.created_at''', role='ai')
    for player, game, value, unit, direction in rows:
        best = 'høyere er bedre' if direction == 'higher_is_better' else 'lavere er bedre'
        print(f'  {player}: {game}, {value} {unit} ({best})')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    # A terminal-only diagnostic must not forward GPU display discovery through
    # the caller's SSH X11/Wayland session. This affects this process and its
    # children only; it does not change the user's shell or disable GPU compute.
    for name in ('DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY'):
        os.environ.pop(name, None)
    local = ROOT / 'backend/check.local.json'
    settings = json.loads(local.read_text()) if local.exists() else {}
    # This manual diagnostic runs as the developer, without privileged launchers.
    # Database roles and the product's SQL policy still apply.
    config = {key: settings[key] for key in ('postgres_bin', 'model_directory', 'model') if key in settings}
    environment = Environment(config, real_model=True)
    player, game = 'ada', 'poengjakt'
    work = None
    pids = []
    try:
        print('Starter lokal prøve med syntetiske data. Ingen benchmark eller FoM.', flush=True)
        environment.start()
        work = environment.work
        pids = [process.pid for process in environment.processes.values()]
        pids.append(int((work / 'pg/postmaster.pid').read_text().splitlines()[0]))
        environment.require('db', 'api', 'ai', 'ollama')
        model = config.get('model', MODEL)
        code, _, models = request(environment.ollama_url + '/api/tags', timeout=5)
        if code != 200 or model not in {entry['name'] for entry in models.get('models', [])}:
            raise RuntimeError('Den konfigurerte modellen mangler. Ingen nedlasting startet.')
        if environment.api('GET', '/health')[0] != 200:
            raise RuntimeError('API-ets helsesjekk feilet.')
        print(f'Klar. Modell: {model}. Du er Ada, valgt spill er Poengjakt som i testen.')
        print('Kun lokal tilgang. Tjenestene kjører som din Linux-bruker i denne diagnosen.')
        print('Svar kan ta opptil 60 sekunder. Minnet ligger bare i RAM og kan tømmes med /ny.')
        print(HELP)
        while True:
            line = input(f'\n{player.capitalize()} / {game}> ').strip()
            if not line:
                continue
            command, _, value = line.lower().partition(' ')
            value = value.strip()
            if command == '/avslutt':
                break
            if command == '/hjelp':
                print(HELP)
            elif command == '/data':
                show_data(environment)
            elif command == '/ny':
                code, _, answer = environment.api('POST', '/ai/conversation/reset', {}, player=PLAYERS[player])
                print('Samtalen er slettet.' if code == 204 else f'Sletting mislyktes: HTTP {code}, {answer}')
            elif command == '/spiller' and value in PLAYERS:
                player = value
                print('Byttet spiller. Hver syntetiske innlogging har sitt eget minne; /ny sletter det.')
            elif command == '/spill' and value in GAMES:
                game = value
            elif line.startswith('/'):
                print('Ukjent kommando/verdi. Bruk /hjelp.')
            elif len(line) > 1000:
                print('Spørsmålet kan inneholde høyst 1000 tegn.')
            else:
                body = {'question': line, 'game_id': GAMES[game]}
                print('AI-en arbeider …', flush=True)
                started = time.monotonic()
                code, _, answer = environment.api('POST', '/ai/questions', body,
                    player=PLAYERS[player], validate_response=False)
                print(f'HTTP {code}, {time.monotonic() - started:.1f} sekunder')
                if code == 200:
                    for notice in answer.get('notices', []):
                        print('Hukommelse:', notice)
                    print(answer['answer'])
                else:
                    print(json.dumps(answer, ensure_ascii=False, indent=2))
    except (EOFError, KeyboardInterrupt):
        print('\nAvslutter …')
    finally:
        environment.close()
        if (work is not None and work.exists()) or any(Path(f'/proc/{pid}').exists() for pid in pids):
            raise RuntimeError('Oppryddingen kunne ikke bekreftes.')
        print('Midlertidige tjenester stoppet og database fjernet. Ingen FoM-rapport laget.')


def interrupted(signum, frame):
    raise KeyboardInterrupt


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, interrupted)
    main()
