import py_compile
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import SystemCheckError
from django.test import SimpleTestCase

from platform_core.boundaries import Violation, find_violations
from platform_core.checks import local_modules

BACKEND = Path(settings.BASE_DIR)
TEMPLATE = BACKEND / "platform_core" / "app_template"


def write(root: Path, relative: str, source: str = "") -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding="utf-8")


class BoundaryRuleTests(SimpleTestCase):
    def violations_for(self, files: dict[str, str]) -> set[tuple[str, str]]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, source in files.items():
                write(root, relative, source)
            found = find_violations(root, ["alpha", "beta", "platform_core"])
        return {(v.path.as_posix(), v.imported) for v in found}

    def test_services_and_selectors_are_the_only_doors(self):
        found = self.violations_for(
            {
                "alpha/models.py": "",
                "beta/services.py": (
                    "from alpha.services import create\n"
                    "from alpha.selectors import listing\n"
                    "from alpha import services, selectors\n"
                    "from platform_core.errors import ApiError\n"
                    "from . import models\n"
                    "import json\n"
                ),
                "beta/api/views.py": (
                    "from alpha.models import Thing\nimport alpha.api.views\nfrom alpha import models\nimport alpha\n"
                ),
            }
        )
        self.assertEqual(
            found,
            {
                ("beta/api/views.py", "alpha.models"),
                ("beta/api/views.py", "alpha.api.views"),
                ("beta/api/views.py", "alpha"),
            },
        )

    def test_the_kernel_depends_on_no_module(self):
        found = self.violations_for({"platform_core/errors.py": "from alpha.services import create\n"})
        self.assertEqual(found, {("platform_core/errors.py", "alpha.services")})

    def test_tests_and_migrations_are_exempt(self):
        found = self.violations_for(
            {
                "beta/tests/test_x.py": "from alpha.models import Thing\n",
                "beta/tests.py": "from alpha.models import Thing\n",
                "beta/migrations/0001_initial.py": "from alpha.models import Thing\n",
                "platform_core/tests/reference/models.py": "from alpha.models import Thing\n",
            }
        )
        self.assertEqual(found, set())

    def test_the_codebase_follows_the_rule(self):
        self.assertTrue({"accounts", "platform_core"} <= set(local_modules()))
        self.assertEqual(find_violations(BACKEND, local_modules()), [])

    def test_a_violation_fails_manage_py_check(self):
        violation = Violation(Path("beta/api/views.py"), 3, "beta", "alpha.models")
        with (
            patch("platform_core.checks.find_violations", return_value=[violation]),
            self.assertRaisesMessage(SystemCheckError, "platform_core.E001"),
        ):
            call_command("check", stdout=None, stderr=None)


class ModuleTemplateTests(SimpleTestCase):
    EXPECTED = {
        "__init__.py",
        "apps.py",
        "models.py",
        "services.py",
        "selectors.py",
        "policies.py",
        "events.py",
        "api/__init__.py",
        "api/serializers.py",
        "api/views.py",
        "api/urls.py",
        "migrations/__init__.py",
        "tests/__init__.py",
        "tests/test_module.py",
    }

    def test_startapp_produces_a_clean_module(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "fixtures_demo"
            target.mkdir()
            call_command("startapp", "fixtures_demo", str(target), template=str(TEMPLATE), verbosity=0)
            files = {p.relative_to(target).as_posix() for p in target.rglob("*.py")}
            self.assertEqual(files, self.EXPECTED)
            for path in target.rglob("*.py"):
                source = path.read_text(encoding="utf-8")
                self.assertNotIn("{{", source, path)
                py_compile.compile(str(path), doraise=True)
            self.assertIn("class FixturesDemoConfig(AppConfig):", (target / "apps.py").read_text(encoding="utf-8"))

            config = str(BACKEND / "pyproject.toml")
            for command in (["check"], ["format", "--check"]):
                result = subprocess.run(  # noqa: S603 - fixed arguments, our own tool
                    [sys.executable, "-m", "ruff", *command, "--config", config, str(target)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(find_violations(Path(directory), ["fixtures_demo", "platform_core"]), [])
