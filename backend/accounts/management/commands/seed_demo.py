"""Seed fictional golden-event organizations and sign-in accounts.

All names are synthetic (Riverside Invitational / Northfield Arena / Club A).
The shared password comes from ZS_DEMO_PASSWORD and is never printed. Runs only
with DEBUG on, or when ZS_ALLOW_DEMO_SEED=true is set explicitly (e.g. the local
Docker demo stack).
"""

import os

from django.conf import settings
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Membership, Organization, User

ORGANIZATIONS = {
    "organizer": ("Riverside Invitational", Organization.Kind.ORGANIZER),
    "venue": ("Northfield Arena", Organization.Kind.VENUE),
    "club": ("Club A", Organization.Kind.CLUB),
}

# email -> (full name, [(organization key, role)])
USERS = {
    "demo@zoikosports.test": ("Demo Operator", [("organizer", "competition_director"), ("venue", "venue_manager"), ("club", "club_coordinator")]),
    "organizer@zoikosports.test": ("Olivia Organizer", [("organizer", "competition_director")]),
    "venue@zoikosports.test": ("Victor Venue", [("venue", "venue_manager")]),
    "club@zoikosports.test": ("Casey Club", [("club", "club_coordinator")]),
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
            raise CommandError("ZS_DEMO_PASSWORD is too weak: " + " ".join(exc.messages))

        orgs = {}
        for key, (name, kind) in ORGANIZATIONS.items():
            orgs[key], _ = Organization.objects.get_or_create(name=name, kind=kind, defaults={"jurisdiction": "US-CA"})

        for email, (full_name, memberships) in USERS.items():
            user = User.objects.filter(email=email).first() or User(email=email)
            user.full_name = full_name
            user.is_active = True
            user.set_password(password)
            user.save()
            for org_key, role in memberships:
                Membership.objects.update_or_create(
                    user=user, organization=orgs[org_key], defaults={"role": role, "status": Membership.Status.ACTIVE}
                )
            self.stdout.write(f"  {email}")

        self.stdout.write(self.style.SUCCESS("Demo accounts ready (password from ZS_DEMO_PASSWORD)."))
