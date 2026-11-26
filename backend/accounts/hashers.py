"""Password hashing: Argon2id with OWASP's recommended minimum cost.

Django's default Argon2 parameters use 100 MiB of memory per hash with 8 lanes.
With several app-server workers verifying passwords at once that is hundreds of
megabytes, and when the memory cannot be allocated argon2 reports a
verification error, which Django treats as a wrong password: valid sign-ins fail
under load. OWASP's Password Storage Cheat Sheet recommends m=19 MiB, t=2, p=1
as the minimum Argon2id configuration; it keeps the same resistance class at a
fifth of the memory.

The algorithm name stays "argon2", so existing Argon2 hashes still verify; a
hash made with other parameters is re-hashed with these at its owner's next
successful sign-in (Django's must_update).
"""

from django.contrib.auth.hashers import Argon2PasswordHasher


class Argon2idHasher(Argon2PasswordHasher):
    time_cost = 2
    memory_cost = 19 * 1024  # KiB
    parallelism = 1
