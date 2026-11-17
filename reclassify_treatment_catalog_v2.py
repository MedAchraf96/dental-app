#!/usr/bin/env python3
"""
Reclassify the 146 existing TreatmentCatalog records into the approved
eight TreatmentCategory values.

SAFE BY DEFAULT:
  - Without --apply, this script performs a read-only dry run.
  - Applying requires --apply and --confirm RECLASSIFY-146.
  - A SQLite backup is created before any write.
  - Only treatment_catalog.category is updated.

The source fingerprint is specific to the uploaded patients.db snapshot.
If the database has changed since extraction, this script stops rather than
guessing. Review/update the fingerprint only after inspecting the differences.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

EXPECTED_COUNT = 146
EXPECTED_SOURCE_SHA256 = "949e2896a077cb4e3b2c3851a240c958aff54453cab28ce5f3f4ecc3a637f752"
CONFIRMATION = "RECLASSIFY-146"

# Approved database values are the StrEnum display values.
CATEGORIES = {
    "GENERAL": "General",
    "RESTORATIVE": "Dentisterie restauratrice",
    "ENDODONTICS": "Endodontie",
    "PERIODONTOLOGY": "Parodontologie",
    "ORAL_SURGERY": "Chirurgie orale",
    "PROSTHODONTICS": "Prothèse dentaire",
    "ORTHODONTICS": "Orthodontie",
    "PEDODONTICS": "Pédodontie",
}

# Explicit, reviewed mapping by TreatmentCatalog primary key.
# This intentionally avoids reclassifying based only on the old category.
ID_GROUPS = {
    "GENERAL": [
        1, 2, 3, 4, 5, 6, 58, 66, 96, 97, 137, 138, 140, 141, 142, 143
    ],
    "RESTORATIVE": [7, 8, 9, 10, 11, 12, 13, 18, 139],
    "ENDODONTICS": [14, 15, 16, 17, 42],
    "PERIODONTOLOGY": list(range(74, 88)),
    "ORAL_SURGERY": (list(range(19, 42)) + list(range(43, 58)) + list(range(59, 66)) + list(range(67, 74)) + [144, 145]),
    "PROSTHODONTICS": list(range(113, 137)) + [146],
    "ORTHODONTICS": list(range(98, 113)),
    "PEDODONTICS": list(range(88, 96)),
}

def make_mapping() -> dict[int, str]:
    mapping: dict[int, str] = {}
    for enum_name, ids in ID_GROUPS.items():
        value = CATEGORIES[enum_name]
        for item_id in ids:
            if item_id in mapping:
                raise RuntimeError(f"Duplicate mapping for catalog ID {item_id}")
            mapping[item_id] = value
    if len(mapping) != EXPECTED_COUNT:
        raise RuntimeError(
            f"Mapping contains {len(mapping)} IDs, expected {EXPECTED_COUNT}"
        )
    if set(mapping) != set(range(1, EXPECTED_COUNT + 1)):
        raise RuntimeError("Mapping does not cover exactly catalog IDs 1–146")
    return mapping

def source_fingerprint(rows: list[tuple]) -> str:
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def read_rows(conn: sqlite3.Connection) -> list[tuple]:
    return [tuple(row) for row in conn.execute(
        """
        SELECT id, name, category, code, cotation,
               CAST(default_price AS TEXT), target_type, is_active
        FROM treatment_catalog
        ORDER BY id
        """
    ).fetchall()]

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db", required=True, type=Path,
        help="Path to the SQLite database to update (e.g. instance/patients.db)"
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Apply the changes. Without this flag, only a dry run is performed."
    )
    parser.add_argument(
        "--confirm", default="",
        help=f"Required with --apply; must be exactly {CONFIRMATION}"
    )
    args = parser.parse_args()

    db_path = args.db.expanduser().resolve()
    if not db_path.is_file():
        print(f"ERROR: database file not found: {db_path}", file=sys.stderr)
        return 2

    if args.apply and args.confirm != CONFIRMATION:
        print(
            f"ERROR: applying requires --confirm {CONFIRMATION}",
            file=sys.stderr,
        )
        return 2

    mapping = make_mapping()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    try:
        table = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name='treatment_catalog'"
        ).fetchone()
        if not table:
            print("ERROR: treatment_catalog table not found.", file=sys.stderr)
            return 2

        rows = read_rows(conn)
        if len(rows) != EXPECTED_COUNT:
            print(
                f"ERROR: found {len(rows)} catalog records; expected "
                f"{EXPECTED_COUNT}. No changes made.",
                file=sys.stderr,
            )
            return 2

        actual_hash = source_fingerprint(rows)
        if actual_hash != EXPECTED_SOURCE_SHA256:
            print(
                "ERROR: database snapshot does not match the inspected source "
                "database fingerprint.\n"
                f"Expected: {EXPECTED_SOURCE_SHA256}\n"
                f"Actual:   {actual_hash}\n"
                "No changes made. Re-inspect the current catalog before applying.",
                file=sys.stderr,
            )
            return 2

        ids_in_db = {row[0] for row in rows}
        if ids_in_db != set(mapping):
            print("ERROR: catalog IDs differ from the approved mapping.", file=sys.stderr)
            return 2

        planned_counts = Counter(mapping.values())
        print(f"Database: {db_path}")
        print(f"Catalog records verified: {len(rows)}")
        print("Planned category counts:")
        for enum_name, value in CATEGORIES.items():
            print(f"  {value}: {planned_counts[value]}")

        if not args.apply:
            print("\nDRY RUN ONLY — no database changes were made.")
            print(
                f"To apply: python {Path(__file__).name} --db "
                f"\"{db_path}\" --apply --confirm {CONFIRMATION}"
            )
            return 0

        backup_path = db_path.with_name(
            f"{db_path.stem}.before_treatment_reclassification."
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}{db_path.suffix}"
        )
        backup_conn = sqlite3.connect(str(backup_path))
        try:
            conn.backup(backup_conn)
        finally:
            backup_conn.close()
        print(f"\nBackup created: {backup_path}")

        # Preserve all fields except category and verify this after the update.
        before_non_category = {
            row[0]: (row[1], row[3], row[4], row[5], row[6], row[7])
            for row in rows
        }

        try:
            conn.execute("BEGIN IMMEDIATE")
            for item_id, category in mapping.items():
                cursor = conn.execute(
                    "UPDATE treatment_catalog SET category = ? WHERE id = ?",
                    (category, item_id),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError(
                        f"Expected to update exactly one row for ID {item_id}; "
                        f"updated {cursor.rowcount}"
                    )

            after_rows = read_rows(conn)
            after_non_category = {
                row[0]: (row[1], row[3], row[4], row[5], row[6], row[7])
                for row in after_rows
            }
            if before_non_category != after_non_category:
                raise RuntimeError(
                    "Integrity check failed: a field other than category changed."
                )

            actual_categories = {row[0]: row[2] for row in after_rows}
            for item_id, expected_category in mapping.items():
                if actual_categories.get(item_id) != expected_category:
                    raise RuntimeError(
                        f"Category verification failed for catalog ID {item_id}"
                    )

            conn.commit()
        except Exception:
            conn.rollback()
            raise

        final_counts = Counter(row[2] for row in read_rows(conn))
        print("\nSUCCESS — all 146 categories updated and verified.")
        print("Final category counts:")
        for value in CATEGORIES.values():
            print(f"  {value}: {final_counts[value]}")
        print("Verified unchanged: names, codes, cotations, prices, target types, active status.")
        print("Only treatment_catalog.category was modified.")
        return 0

    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
