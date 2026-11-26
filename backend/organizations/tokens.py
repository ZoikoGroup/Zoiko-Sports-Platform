"""Invitation tokens: 256 random bits, emailed once, stored only as a SHA-256 hash.

A database leak therefore exposes no usable invitation link. SHA-256 (not a
slow password hash) is right here: the token is random and long, so it cannot
be guessed or brute-forced from its hash.
"""

import hashlib
import secrets

TOKEN_BYTES = 32


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
