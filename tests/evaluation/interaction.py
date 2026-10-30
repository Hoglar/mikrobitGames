"""Guided Norwegian input for an application evaluation; never invent UX scores."""
from scoring import validate_feedback


class DeferredInput(Exception):
    """The reviewer explicitly chose to finish another time."""


def _answer(prompt, allow_defer=False):
    value = input(prompt).strip()
    if allow_defer and value.casefold() == 'senere':
        raise DeferredInput
    return value


def _required(prompt, allow_defer=False):
    while True:
        value = _answer(prompt, allow_defer)
        if value:
            return value
        print('Fyll ut et svar før du fortsetter.')


def prompt_session(label=None):
    """Ask for run context before starting; cancellation propagates to the CLI."""
    print('\nFelles appevaluering: automatiske tester og gruppens brukervurdering.')
    label = (label or '').strip() or _required('Navn på iterasjonen (f.eks. 01 – baseline): ')
    reviewer = _required('Vurderer eller gruppenavn: ')
    context = _answer('Testkontekst: oppsett, enhet og eventuelle avgrensninger (valgfritt): ')
    return {'label': label, 'reviewer': reviewer, 'context': context}


def prompt_review(reviewer=''):
    """Ask only for an experience description and a score, preserving partial input."""
    review = {'status': 'deferred', 'reviewer': reviewer.strip() or 'Ikke oppgitt'}
    print('\nBrukervurdering: prøv den samme kodeversjonen som nettopp ble testet.')
    print('Skriv «senere» ved et spørsmål for å utsette resten. Automatiske resultater beholdes.')
    try:
        review['comment'] = _required('1. Hvordan var brukeropplevelsen? ', True)
        while True:
            answer = _answer('2. Hvilken skår gir dere brukeropplevelsen (1–10)? ', True)
            if not answer:
                raise DeferredInput
            try:
                score = float(answer.replace(',', '.'))
                validate_feedback(score, review['comment'], review['reviewer'])
            except ValueError:
                print('UX-skår må være et endelig tall fra 1 til 10.')
                continue
            review.update(status='complete', score=score)
            return review
    except DeferredInput:
        print('Brukervurderingen er utsatt; innsamlede svar beholdes uten en samlet UX-skår.')
    except (EOFError, KeyboardInterrupt):
        review['status'] = 'interrupted'
        print('\nBrukervurderingen ble avbrutt; innsamlede svar beholdes uten en samlet UX-skår.')
    return review
