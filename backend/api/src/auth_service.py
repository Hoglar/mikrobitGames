"""Passwords and account/session lifecycle; hashing happens outside DB locks."""
from datetime import timedelta
import re
import secrets
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerificationError, InvalidHashError
import database
from errors import ServiceError

_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1, type=Type.ID)
_dummy_hash = _hasher.hash(secrets.token_urlsafe(32))


def normalize_username(text):
    if not isinstance(text, str) or not re.fullmatch(r'[A-Za-z0-9_-]{3,32}', text):
        raise ValueError('Ugyldig brukernavn.')
    return text.lower()


def _aware(*times):
    if any(t.tzinfo is None or t.utcoffset() is None for t in times):
        raise ValueError('Tidspunkt må ha tidssone.')


def session_expiry(created_at, renewed_at):
    _aware(created_at, renewed_at)
    return min(renewed_at + timedelta(seconds=259200), created_at + timedelta(seconds=2592000))


def session_is_valid(expires_at, absolute_expires_at, now):
    _aware(expires_at, absolute_expires_at, now)
    return now < expires_at and now < absolute_expires_at


def _verify(encoded, password):
    try:
        return _hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def register(username, password):
    normalize_username(username)
    return database.register(username, _hasher.hash(password))


def login(username, password):
    row = database.login_material(normalize_username(username))
    valid = _verify(row['password_hash'] if row else _dummy_hash, password)
    if not row or not valid:
        raise ServiceError('INVALID_CREDENTIALS', 401)
    token = secrets.token_urlsafe(32)
    return database.create_session(row, database.token_hash(token)), token


def identity(token):
    return database.session(token)


def session(token):
    row = identity(token)
    return {'player': database.player_view(row), 'expires_at': row['expires_at'], 'absolute_expires_at': row['absolute_expires_at']}


def renew(token):
    return database.renew(token)


def logout(token):
    database.logout(token)


def change_password(token, current_password, new_password):
    row = identity(token)
    if not _verify(row['password_hash'], current_password):
        raise ServiceError('CURRENT_PASSWORD_INCORRECT', 403)
    new_hash = _hasher.hash(new_password)
    database.change_account(token, row['password_hash'], new_hash=new_hash)


def delete_account(token, current_password):
    row = identity(token)
    if not _verify(row['password_hash'], current_password):
        raise ServiceError('CURRENT_PASSWORD_INCORRECT', 403)
    database.change_account(token, row['password_hash'], delete=True)
