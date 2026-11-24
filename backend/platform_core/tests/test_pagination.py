from urllib.parse import parse_qs, urlparse

from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from platform_core.tests.reference.models import ReferenceItem

from .helpers import ITEMS, REFERENCE_URLS, STARTS_AT, make_user, signed_in_client


def bulk_items(owner, count, *, created_at=STARTS_AT, title="Item", status="draft"):
    ReferenceItem.objects.bulk_create(
        [
            ReferenceItem(
                owner=owner,
                title=f"{title} {n}",
                status=status,
                starts_at=STARTS_AT,
                time_zone="UTC",
                created_at=created_at,
            )
            for n in range(count)
        ]
    )


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class CursorPaginationTests(TestCase):
    client: APIClient

    def setUp(self):
        self.user = make_user()
        self.client = signed_in_client(self.user)

    def walk(self, url, direction="next"):
        """Every id reached by following `direction` links, and the number of pages."""
        ids: list[str] = []
        pages = 0
        while url:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, response.content)
            ids.extend(item["id"] for item in response.data["results"])
            pages += 1
            url = response.data[direction]
        return ids, pages

    def test_every_row_exactly_once_even_when_timestamps_are_shared(self):
        bulk_items(self.user, 1000)  # identical created_at for all rows
        ids, pages = self.walk(f"{ITEMS}?page_size=100")
        self.assertEqual(pages, 10)
        self.assertEqual(len(ids), 1000)
        self.assertEqual(len(set(ids)), 1000)
        expected = {str(public_id) for public_id in ReferenceItem.objects.values_list("public_id", flat=True)}
        self.assertEqual(set(ids), expected)

    def test_walking_back_returns_the_same_rows(self):
        bulk_items(self.user, 95)
        forward, _ = self.walk(f"{ITEMS}?page_size=20")
        last_page_url = None
        url = f"{ITEMS}?page_size=20"
        while url:
            last_page_url = url
            url = self.client.get(url).data["next"]
        backward, _ = self.walk(last_page_url, direction="previous")
        self.assertEqual(sorted(backward), sorted(forward))
        self.assertEqual(len(set(backward)), 95)

    def test_newest_first(self):
        old = ReferenceItem.objects.create(owner=self.user, title="Old", starts_at=STARTS_AT, time_zone="UTC")
        new = ReferenceItem.objects.create(owner=self.user, title="New", starts_at=STARTS_AT, time_zone="UTC")
        ids = [item["id"] for item in self.client.get(ITEMS).data["results"]]
        self.assertEqual(ids, [str(new.public_id), str(old.public_id)])

    def test_default_and_maximum_page_size(self):
        bulk_items(self.user, 150)
        self.assertEqual(len(self.client.get(ITEMS).data["results"]), 25)
        self.assertEqual(len(self.client.get(f"{ITEMS}?page_size=5000").data["results"]), 100)
        for invalid in ["0", "-3", "abc"]:
            with self.subTest(page_size=invalid):
                self.assertEqual(len(self.client.get(f"{ITEMS}?page_size={invalid}").data["results"]), 25)

    @override_settings(API_PAGE_SIZE=10, API_MAX_PAGE_SIZE=20)
    def test_page_sizes_come_from_settings(self):
        bulk_items(self.user, 50)
        self.assertEqual(len(self.client.get(ITEMS).data["results"]), 10)
        self.assertEqual(len(self.client.get(f"{ITEMS}?page_size=50").data["results"]), 20)

    def test_tampered_cursor_is_400(self):
        bulk_items(self.user, 30)
        next_url = self.client.get(ITEMS).data["next"]
        cursor = parse_qs(urlparse(next_url).query)["cursor"][0]
        for bad in ["garbage", cursor[:-4] + "AAAA", "%%%"]:
            with self.subTest(cursor=bad):
                response = self.client.get(ITEMS, {"cursor": bad})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"]["code"], "invalid_cursor")

    def test_query_count_does_not_grow_with_the_table(self):
        def queries_for_first_and_deep_page():
            counts = []
            url = f"{ITEMS}?page_size=50"
            for _ in range(2):
                with CaptureQueriesContext(connection) as queries:
                    response = self.client.get(url)
                counts.append(len(queries))
                url = response.data["next"]
            return counts

        bulk_items(self.user, 100)
        small = queries_for_first_and_deep_page()
        bulk_items(self.user, 2000, title="More")
        large = queries_for_first_and_deep_page()
        self.assertEqual(small, large)

    def test_lists_only_the_callers_rows(self):
        bulk_items(make_user("raj@example.com"), 5)
        self.assertEqual(self.client.get(ITEMS).data["results"], [])


@override_settings(ROOT_URLCONF=REFERENCE_URLS)
class FilteringTests(TestCase):
    client: APIClient

    def setUp(self):
        self.user = make_user()
        self.client = signed_in_client(self.user)
        bulk_items(self.user, 3, title="Metro Cup", status="active")
        bulk_items(self.user, 2, title="Harbour League", status="draft")

    def titles(self, params):
        response = self.client.get(ITEMS, params)
        self.assertEqual(response.status_code, 200, response.content)
        return sorted(item["title"].rsplit(" ", 1)[0] for item in response.data["results"])

    def test_search_and_named_filters(self):
        self.assertEqual(self.titles({"q": "metro"}), ["Metro Cup"] * 3)
        self.assertEqual(self.titles({"status": "draft"}), ["Harbour League"] * 2)
        self.assertEqual(self.titles({"q": "  harbour  ", "status": "draft"}), ["Harbour League"] * 2)
        self.assertEqual(self.titles({"q": "harbour", "status": "active"}), [])

    def test_pagination_parameters_are_always_accepted(self):
        response = self.client.get(ITEMS, {"page_size": "2", "q": "metro"})
        self.assertEqual(len(response.data["results"]), 2)
        self.assertIsNotNone(response.data["next"])

    def test_unknown_parameters_are_rejected(self):
        response = self.client.get(ITEMS, {"colour": "blue", "statuss": "draft"})
        self.assertEqual(response.status_code, 400)
        error = response.json()["error"]
        self.assertEqual(error["code"], "validation_error")
        self.assertEqual(set(error["fields"]), {"colour", "statuss"})

    def test_a_single_value_parameter_given_twice_is_rejected(self):
        response = self.client.get(f"{ITEMS}?status=draft&status=active")
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json()["error"]["fields"])

    def test_invalid_values_are_validation_errors(self):
        for params, field in [({"status": "deleted"}, "status"), ({"q": "x" * 201}, "q")]:
            with self.subTest(params=params):
                response = self.client.get(ITEMS, params)
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["error"]["fields"])
