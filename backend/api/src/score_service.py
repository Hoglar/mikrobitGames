"""Public catalog/records and owner-only attempts."""
import database
import score_rules
from errors import ServiceError


def submit(token, game_id, body):
    def validate(*args):
        try:
            score_rules.validate_attempt(*args)
        except (TypeError, ValueError):
            raise ServiceError('INVALID_RESULT', 400) from None
    return database.submit(token, game_id, body['attempt_id'], body['status'], body['value'], validate, score_rules.is_improvement)


def games(page, page_size, include_inactive=False):
    return database.games(page, page_size, include_inactive)


def game(game_id):
    return database.game(game_id)


def player(player_id):
    return database.player(player_id)


def leaderboard(game_id, page, page_size):
    return database.leaderboard(game_id, page, page_size)


def player_records(player_id, page, page_size):
    return database.player_records(player_id, page, page_size)


def history(player_id, game_id, page, page_size):
    return database.public_records(player_id, game_id, page, page_size)


def attempts(token, page, page_size, game_id=None):
    return database.attempts(token, page, page_size, game_id)


def attempt(token, attempt_id):
    return database.attempts(token, attempt_id=attempt_id)
