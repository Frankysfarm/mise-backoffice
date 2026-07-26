#!/usr/bin/env python3
"""Strict result validation for the two-session T02 race fixtures."""

import json
import pathlib
import sys


def fail(message: str) -> None:
    raise AssertionError(message)


def read_result(path: str) -> dict:
    source = pathlib.Path(path)
    values = []
    for line_number, raw_line in enumerate(source.read_text().splitlines(), 1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            fail(f"{source}:{line_number}: non-JSON output: {error}")
        if not isinstance(value, dict):
            fail(f"{source}:{line_number}: expected a JSON object")
        values.append(value)
    if len(values) != 1:
        fail(f"{source}: expected exactly one JSON object, found {len(values)}")
    return values[0]


def is_ok(value: dict) -> bool:
    return value.get("ok") is True


def normalized_replay(value: dict) -> dict:
    normalized = dict(value)
    normalized.pop("idempotent_replay", None)
    return normalized


def validate(mode: str, values: list[dict]) -> None:
    if len(values) != 2:
        fail(f"{mode}: expected exactly two session results")

    successes = [value for value in values if is_ok(value)]
    failures = [value for value in values if value.get("ok") is False]

    if mode == "writer":
        if len(successes) != 1 or len(failures) != 1:
            fail("writer: expected exactly one winner and one guarded loser")
        if failures[0].get("reason_code") != "TENANT_WRITER_ALREADY_ACTIVE":
            fail(f"writer: unexpected loser result: {failures[0]}")
        return

    if mode == "assignment":
        if len(successes) != 1 or len(failures) != 1:
            fail("assignment: expected exactly one winner and one guarded loser")
        if successes[0].get("state") != "assigned":
            fail(f"assignment: winner is not assigned: {successes[0]}")
        if failures[0].get("reason_code") != "ORDER_NOT_ASSIGNABLE":
            fail(f"assignment: unexpected loser result: {failures[0]}")
        return

    if mode == "same-key":
        if len(successes) != 2:
            fail("same-key: both calls must return the canonical success")
        replay_flags = sorted(
            value.get("idempotent_replay") for value in values
        )
        if replay_flags != [False, True]:
            fail(f"same-key: expected one write and one replay: {replay_flags}")
        if normalized_replay(values[0]) != normalized_replay(values[1]):
            fail("same-key: canonical payloads differ outside idempotent_replay")
        return

    if mode == "fingerprint":
        if len(successes) != 1 or len(failures) != 1:
            fail("fingerprint: expected exactly one winner and one conflict")
        if failures[0].get("reason_code") != (
            "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST"
        ):
            fail(f"fingerprint: unexpected conflict result: {failures[0]}")
        return

    if mode == "cancel-assign":
        if len(successes) not in (1, 2):
            fail("cancel-assign: assignment must succeed")
        assignment = values[0]
        cancellation = values[1]
        if not is_ok(assignment) or assignment.get("state") != "assigned":
            fail(f"cancel-assign: assignment result is invalid: {assignment}")
        if is_ok(cancellation):
            if cancellation.get("state") != "cancelled":
                fail(f"cancel-assign: invalid cancellation success: {cancellation}")
        elif cancellation.get("ok") is not False or cancellation.get(
            "reason_code"
        ) != "ACTIVE_ASSIGNMENT_NOT_FOUND":
            fail(f"cancel-assign: unexpected cancellation loser: {cancellation}")
        return

    if mode == "delivery-reassign":
        completion = values[0]
        reassignment = values[1]
        if not is_ok(completion) or completion.get("state") != "completed":
            fail(f"delivery-reassign: completion did not win: {completion}")
        if reassignment.get("ok") is not False or reassignment.get(
            "reason_code"
        ) not in {
            "POST_PICKUP_REASSIGNMENT_NOT_SUPPORTED",
            "ACTIVE_ASSIGNMENT_NOT_FOUND",
        }:
            fail(f"delivery-reassign: unsafe reassignment result: {reassignment}")
        return

    fail(f"unknown validation mode: {mode}")


def main() -> None:
    if len(sys.argv) != 4:
        fail("usage: parse-276-race-json.py MODE SESSION_A SESSION_B")
    validate(sys.argv[1], [read_result(path) for path in sys.argv[2:]])


if __name__ == "__main__":
    main()
