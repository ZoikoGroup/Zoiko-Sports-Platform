"""Validate the implementation tracker (backend/docs) and refresh its generated indexes.

    python manage.py check_tracker            # CI: fail on any problem, change nothing
    python manage.py check_tracker --write    # rewrite ROADMAP.md and decisions/README.md, then check

The rules are listed in platform_core.tracker; backend/docs/handover.md explains the format.
"""

from pathlib import Path
from typing import Any

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from platform_core.tracker import check


def backend_modules(base_dir: Path) -> list[Path]:
    """Folders of the installed backend modules: apps that are direct children of backend/.

    Third-party apps (even inside backend/.venv) and test-only modules are excluded.
    """
    paths = (Path(config.path).resolve() for config in apps.get_app_configs())
    return sorted(path for path in paths if path.parent == base_dir)


class Command(BaseCommand):
    help = "Check the implementation tracker in backend/docs (and optionally regenerate its indexes)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--write",
            action="store_true",
            help="Rewrite the generated files (ROADMAP.md, decisions/README.md) before checking.",
        )
        parser.add_argument("--docs", type=Path, default=None, help="Tracker folder (default: backend/docs).")

    def handle(self, *args: Any, **options: Any) -> None:
        base_dir = Path(settings.BASE_DIR).resolve()
        docs_dir: Path = (options["docs"] or base_dir / "docs").resolve()
        if not (docs_dir / "roadmap").is_dir():
            raise CommandError(f"No tracker found: {docs_dir / 'roadmap'} does not exist.")
        modules = backend_modules(base_dir)
        result = check(docs_dir, base_dir.parent, modules)

        stale: list[str] = []
        for path, content in self._generated(docs_dir, result.roadmap, result.decision_index).items():
            current = path.read_text(encoding="utf-8").replace("\r\n", "\n") if path.exists() else None
            if current == content:
                continue
            name = path.relative_to(docs_dir).as_posix()
            if options["write"]:
                path.write_text(content, encoding="utf-8", newline="\n")
                self.stdout.write(f"Rewrote {name}")
            else:
                stale.append(f"{name} is out of date: run python manage.py check_tracker --write")
        if options["write"]:
            # Links may point at the files just written: check again against the new state.
            result = check(docs_dir, base_dir.parent, modules)
        problems = result.problems + stale

        if problems:
            for problem in problems:
                self.stderr.write(f"  {problem}")
            raise CommandError(f"The tracker has {len(problems)} problem(s); see backend/docs/handover.md.")
        self.stdout.write(self.style.SUCCESS("Tracker OK: phases, work packages, decisions and links are consistent."))

    @staticmethod
    def _generated(docs_dir: Path, roadmap: str, decision_index: str) -> dict[Path, str]:
        return {docs_dir / "ROADMAP.md": roadmap, docs_dir / "decisions" / "README.md": decision_index}
