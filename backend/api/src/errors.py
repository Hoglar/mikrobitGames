"""Safe domain errors: never include query text, credentials or submitted values."""


class ServiceError(Exception):
    def __init__(self, code, status=400, message=None, retry_after=None):
        self.code = code
        self.status = status
        self.message = message or {
            'AUTH_REQUIRED': 'Logg inn for å fortsette.',
            'INVALID_CREDENTIALS': 'Feil brukernavn eller passord.',
            'CURRENT_PASSWORD_INCORRECT': 'Gjeldende passord er feil.',
            'NOT_FOUND': 'Fant ikke oppføringen.',
            'OUTCOME_UNKNOWN': 'Utfallet er ukjent. Kontroller tilstanden før nytt forsøk.',
            'SERVICE_UNAVAILABLE': 'Tjenesten er midlertidig utilgjengelig.',
            'USERNAME_TAKEN': 'Brukernavnet er opptatt.',
            'RATE_LIMITED': 'For mange forsøk. Prøv igjen senere.',
        }.get(code, 'Forespørselen kunne ikke behandles.')
        self.retry_after = retry_after
        super().__init__(code)
