"""Module boundary rule, enforced as a Django system check (platform_core.checks).

Every backend module (a local Django app) keeps its tables and HTTP layer to
itself. Another module may import only its `services` (writes) and `selectors`
(reads):

    from competitions.services import create_competition     # allowed
    from competitions.selectors import competitions_for       # allowed
    from competitions.models import Competition               # violation
    from competitions.api.views import CompetitionList        # violation

The platform kernel (platform_core) may be imported by every module, and must
not import any module. Tests and migrations are exempt (fixtures may build
other modules' records directly).
"""

import ast
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

KERNEL = "platform_core"
PUBLIC_SUBMODULES = frozenset({"services", "selectors"})
_EXEMPT_DIRS = frozenset({"tests", "migrations", "app_template"})


@dataclass(frozen=True)
class Violation:
    path: Path
    line: int
    importer: str
    imported: str

    @property
    def message(self) -> str:
        if self.importer == KERNEL:
            return f"{self.path}:{self.line}: the platform kernel imports module code ({self.imported})."
        return (
            f"{self.path}:{self.line}: {self.importer} imports {self.imported}; "
            "other modules may use only their services and selectors."
        )


def _is_exempt(relative: Path) -> bool:
    if any(part in _EXEMPT_DIRS for part in relative.parts[:-1]):
        return True
    return relative.name == "tests.py" or relative.name.startswith("test_")


def _imported_names(tree: ast.AST) -> Iterator[tuple[int, str]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield node.lineno, alias.name
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if "." in node.module:
                yield node.lineno, node.module
            else:
                # `from competitions import models` reaches competitions.models.
                for alias in node.names:
                    yield node.lineno, f"{node.module}.{alias.name}"


def _violates(importer: str, imported: str, modules: frozenset[str]) -> bool:
    parts = imported.split(".")
    target = parts[0]
    if target not in modules or target == importer:
        return False
    if importer == KERNEL:
        return True
    if target == KERNEL:
        return False
    return len(parts) < 2 or parts[1] not in PUBLIC_SUBMODULES


def find_violations(base_dir: Path, modules: Iterable[str]) -> list[Violation]:
    """Every cross-module import in `base_dir`'s modules that breaks the rule."""
    module_set = frozenset(modules)
    violations: list[Violation] = []
    for module in sorted(module_set):
        root = base_dir / module
        for path in sorted(root.rglob("*.py")):
            relative = path.relative_to(base_dir)
            if _is_exempt(relative):
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(relative))
            violations.extend(
                Violation(relative, line, module, imported)
                for line, imported in _imported_names(tree)
                if _violates(module, imported, module_set)
            )
    return violations
