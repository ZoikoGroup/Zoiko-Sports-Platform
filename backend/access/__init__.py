"""The access module.

Layout (platform kernel convention, see platform_core/boundaries.py):
  api/          HTTP only: serializers, views, urls; no business rules
  services.py   writes; the only entry point other modules may use to change data
  selectors.py  reads; the only entry point other modules may use to query data
  policies.py   permission rules for this module's actions
  events.py     events this module publishes
  models.py     tables, built on platform_core.models
  tests/
"""
