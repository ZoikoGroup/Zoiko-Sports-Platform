from django.apps import apps
from django.test import SimpleTestCase


class ModuleSetupTests(SimpleTestCase):
    def test_module_is_installed(self):
        # Add "activity" to INSTALLED_APPS in config/settings.py.
        self.assertTrue(apps.is_installed("activity"))
