"""Seed fictional golden-event organizations and sign-in accounts.

All names are synthetic: the golden event (backend/docs/golden-event.md) with
Riverside Invitational, Northfield Arena, Clubs A and B, and Club C, which is never
invited to anything (the permission tests' negative case).
The shared password comes from ZS_DEMO_PASSWORD and is never printed. Runs only
with DEBUG on, or when ZS_ALLOW_DEMO_SEED=true is set explicitly (e.g. the local
Docker demo stack).
"""

import os

from django.conf import settings
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from organizations.services import ensure_organization, grant_membership

ORGANIZATIONS = {
    "organizer": ("Riverside Invitational", "organizer"),
    "venue": ("Northfield Arena", "venue"),
    "club": ("Club A", "club"),
    "club_b": ("Club B", "club"),
    "club_c": ("Club C", "club"),
}

# email -> (full name, [(organization key, role)])
USERS = {
    "demo@zoikosports.test": (
        "Demo Operator",
        [("organizer", "competition_director"), ("venue", "venue_manager"), ("club", "club_coordinator")],
    ),
    "organizer@zoikosports.test": ("Olivia Organizer", [("organizer", "competition_director")]),
    "venue@zoikosports.test": ("Victor Venue", [("venue", "venue_manager")]),
    "club@zoikosports.test": ("Casey Club", [("club", "club_coordinator")]),
    "clubb@zoikosports.test": ("Bea Club B", [("club_b", "club_coordinator")]),
    "clubc@zoikosports.test": ("Cam Club C", [("club_c", "club_coordinator")]),
    "individual@zoikosports.test": ("Indra Individual", []),
}


class Command(BaseCommand):
    help = "Create fictional demo organizations and accounts (password from ZS_DEMO_PASSWORD)."

    def handle(self, *args, **options):
        if not (settings.DEBUG or os.environ.get("ZS_ALLOW_DEMO_SEED", "").lower() == "true"):
            raise CommandError("seed_demo runs only with DJANGO_DEBUG on or ZS_ALLOW_DEMO_SEED=true.")

        password = os.environ.get("ZS_DEMO_PASSWORD", "")
        if not password:
            raise CommandError("Set ZS_DEMO_PASSWORD to the password the demo accounts should use.")
        try:
            password_validation.validate_password(password)
        except ValidationError as exc:
            raise CommandError("ZS_DEMO_PASSWORD is too weak: " + " ".join(exc.messages)) from exc

        orgs = {}
        for key, (name, kind) in ORGANIZATIONS.items():
            # Created verified: demo organizations are usable straight away.
            orgs[key] = ensure_organization(name=name, kind=kind, jurisdiction="US-CA")

        for email, (full_name, memberships) in USERS.items():
            user = User.objects.filter(email=email).first() or User(email=email)
            user.full_name = full_name
            user.is_active = True
            user.set_password(password)
            user.save()
            for org_key, role in memberships:
                grant_membership(user=user, organization=orgs[org_key], role=role)
            self.stdout.write(f"  {email}")

        self.stdout.write(self.style.SUCCESS("Demo accounts ready (password from ZS_DEMO_PASSWORD)."))
