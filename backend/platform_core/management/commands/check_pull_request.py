"""Check that a pull request names its work package and updates the tracker (D-038).

GitHub runs it on every pull request (.github/workflows/tracker.yml). Run it yourself
before pushing, from backend/:

    git diff --name-only main...HEAD | python manage.py check_pull_request --title "[P3.2] Policy engine"

The rules are in platform_core.tracker.check_pull_request.
"""

import sys
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from platform_core.tracker import check_pull_request


class Command(BaseCommand):
    help = "Check a pull request's title and tracker updates against the changed files."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--title", required=True, help='The pull request title, e.g. "[P3.2] Policy engine".')
        parser.add_argument(
            "--changed-files",
            default="-",
            help="File listing the changed paths, one per line, relative to the repository root "
            "(default: read them from standard input).",
        )
        parser.add_argument("--docs", type=Path, default=None, help="Tracker folder (default: backend/docs).")

    def handle(self, *args: Any, **options: Any) -> None:
        base_dir = Path(settings.BASE_DIR).resolve()
        docs_dir: Path = (options["docs"] or base_dir / "docs").resolve()
        source: str = options["changed_files"]
        if source == "-":
            changed = sys.stdin.read().splitlines()
        else:
            try:
                changed = Path(source).read_text(encoding="utf-8").splitlines()
            except OSError as exc:
                raise CommandError(f"Cannot read the changed-files list: {exc}") from exc

        problems = check_pull_request(options["title"], changed, docs_dir, base_dir.parent)
        if problems:
            for problem in problems:
                self.stderr.write(f"  {problem}")
            raise CommandError("The pull request does not update the tracker; see backend/docs/handover.md.")
        self.stdout.write(self.style.SUCCESS("Pull request OK: it names its work and updates the tracker."))
