"""Event types: the contract between a module that publishes and the modules that react (P4).

Each module declares its events in its own `events.py`:

    INVITATION_ACCEPTED = EventType(
        "invitation.accepted", 1,
        fields=("invitation_id", "organization_id", "membership_id", "user_id", "role"),
        description="Someone accepted an invitation and became a member.",
    )

and publishes them through `outbox.services.publish()` in the same transaction as
the change. Rules (D-041):

- Names are `<thing>.<past-tense verb>`, lower case; a published name keeps its meaning.
- Adding an optional payload field is compatible. Renaming or removing a field,
  or changing its meaning, is a new version: declare `EventType(name, 2, ...)`
  next to version 1 and publish both until no consumer needs version 1.
- Payloads carry IDs and codes, never personal data such as emails or names
  (consumers look those up when they need them).
- Consumers must tolerate duplicates and events arriving out of order.

Every declared type is registered here; `manage.py event_catalogue` writes the
catalogue (backend/docs/contracts/events.md) from this registry.
"""

import re
import sys
from collections.abc import Iterable
from dataclasses import dataclass, field

NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$")
FIELD_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


class EventContractError(ValueError):
    """An event type or payload breaks the contract rules."""


@dataclass(frozen=True)
class EventType:
    name: str
    version: int
    fields: tuple[str, ...]
    description: str
    optional: tuple[str, ...] = field(default=())
    # The module that publishes it (filled in from where the type is declared).
    module: str = ""

    def __post_init__(self) -> None:
        if not NAME_PATTERN.match(self.name):
            raise EventContractError(f"Event name {self.name!r} must look like 'thing.happened'.")
        if self.version < 1:
            raise EventContractError(f"{self.name}: versions start at 1.")
        names = list(self.fields) + list(self.optional)
        if len(set(names)) != len(names) or not all(FIELD_PATTERN.match(n) for n in names):
            raise EventContractError(f"{self.name}: payload fields must be unique snake_case names.")
        if not self.module:
            # Frames: __post_init__ <- generated __init__ <- the declaring module.
            declaring = sys._getframe(2).f_globals.get("__name__", "")
            object.__setattr__(self, "module", str(declaring).split(".")[0])
        register(self)

    @property
    def key(self) -> str:
        return f"{self.name}.v{self.version}"

    def validate(self, payload: dict[str, object]) -> None:
        """Required fields present, nothing undeclared."""
        missing = [name for name in self.fields if name not in payload]
        unknown = sorted(set(payload) - set(self.fields) - set(self.optional))
        if missing or unknown:
            raise EventContractError(f"{self.key}: missing {missing or 'nothing'}, undeclared {unknown or 'nothing'}.")


_REGISTRY: dict[str, EventType] = {}


def register(event_type: EventType) -> None:
    existing = _REGISTRY.get(event_type.key)
    if existing is not None and existing != event_type:
        raise EventContractError(f"{event_type.key} is declared twice with different contents.")
    _REGISTRY[event_type.key] = event_type


def registered(event_types: Iterable[str] | None = None) -> list[EventType]:
    """Every declared event type (or the named keys), sorted by name and version."""
    types = _REGISTRY.values() if event_types is None else [_REGISTRY[key] for key in event_types]
    return sorted(types, key=lambda t: (t.name, t.version))


def get(key: str) -> EventType | None:
    """The event type for `name.vN`, or None."""
    return _REGISTRY.get(key)
