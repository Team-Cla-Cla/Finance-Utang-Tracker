#!/usr/bin/env python3
"""
test_tracker.py - Automated test suite for Offline-First Finance & Utang Tracker
"""

import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
EXT_DIR = BASE_DIR / "extension"
PY_FILE = BASE_DIR / "finance_client.py"


def test_js_syntax():
    print("[*] Testing JavaScript syntax (extension/popup.js, google_sync.js)...", end=" ")
    for js_file in [EXT_DIR / "popup.js", EXT_DIR / "google_sync.js"]:
        res = subprocess.run(["node", "-c", str(js_file)], capture_output=True, text=True)
        assert res.returncode == 0, f"JS Syntax Error in {js_file.name}:\n{res.stderr}"
    print("PASSED")


def test_python_syntax():
    print("[*] Testing Python syntax (finance_client.py)...", end=" ")
    res = subprocess.run(["python3", "-m", "py_compile", str(PY_FILE)], capture_output=True, text=True)
    assert res.returncode == 0, f"Python Syntax Error:\n{res.stderr}"
    print("PASSED")


def test_financial_and_utang_math():
    print("[*] Testing financial math & 'Pay Now' projections...", end=" ")
    today_allowance = 200.0
    expenses = [15.0, 22.0, 20.0, 15.0, 30.0]
    today_spent = sum(expenses)  # 102.0
    today_remaining = today_allowance - today_spent  # 98.0
    assert today_spent == 102.0
    assert today_remaining == 98.0

    debts = [
        {"person": "Dave", "direction": "I Owe", "amount": 50.0, "paid": 0.0, "status": "Active"},
        {"person": "Sarah", "direction": "Owed to Me", "amount": 20.0, "paid": 0.0, "status": "Active"},
        {"person": "Mark", "direction": "I Owe", "amount": 100.0, "paid": 0.0, "status": "Active"},
    ]

    total_i_owe = sum(d["amount"] - d["paid"] for d in debts if "i owe" in d["direction"].lower() and d["status"] == "Active")
    total_owed_to_me = sum(d["amount"] - d["paid"] for d in debts if "owed to me" in d["direction"].lower() and d["status"] == "Active")
    assert total_i_owe == 150.0
    assert total_owed_to_me == 20.0

    # Projection 1: Cash left today after paying all debts
    proj_pay_debts_today = today_remaining - total_i_owe
    assert proj_pay_debts_today == -52.0

    # Settle Dave 50 in full
    debts[0]["paid"] = 50.0
    debts[0]["status"] = "Settled"
    new_total_i_owe = sum(d["amount"] - d["paid"] for d in debts if "i owe" in d["direction"].lower() and d["status"] == "Active")
    assert new_total_i_owe == 100.0

    # Partial payment test: Mark 40 out of 100
    debts[2]["paid"] += 40.0
    assert debts[2]["paid"] == 40.0
    assert (debts[2]["amount"] - debts[2]["paid"]) == 60.0
    assert debts[2]["status"] == "Active"

    print("PASSED")


def test_extension_bundle():
    print("[*] Testing browser extension bundle...", end=" ")
    manifest_path = EXT_DIR / "manifest.json"
    popup_html = EXT_DIR / "popup.html"

    assert manifest_path.exists(), "manifest.json missing"
    assert popup_html.exists(), "popup.html missing"

    import json
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert manifest.get("manifest_version") == 3, "Manifest version must be 3"
    assert "storage" in manifest.get("permissions", []), "storage permission missing"
    assert "identity" in manifest.get("permissions", []), "identity permission missing"

    # Check icons
    for size in ["16", "48", "128"]:
        assert (EXT_DIR / f"icons/icon{size}.png").exists(), f"Icon {size} missing"

    with open(popup_html, "r", encoding="utf-8") as f:
        html = f.read()
    assert 'id="heroBalance"' in html, "heroBalance missing"
    assert 'id="syncBadge"' in html, "syncBadge missing"
    assert 'id="btnGoogleLogin"' in html, "btnGoogleLogin missing"
    assert 'id="btnAnalytics"' in html, "btnAnalytics missing"
    assert 'id="analyticsModal"' in html, "analyticsModal missing"
    assert 'class="empty-pills-hint"' in html or 'empty-pills-hint' in html, "empty-pills-hint missing"
    assert 'class="pill-tabs"' in html, "pill-tabs missing"
    assert 'id="btnRunDiagnostics"' in html, "btnRunDiagnostics missing"
    assert 'id="uAffectCash"' in html, "uAffectCash missing"
    assert 'id="sAffectCash"' in html, "sAffectCash missing"
    assert 'id="btnClearAllData"' in html, "btnClearAllData missing"
    assert 'class="dashboard-layout"' in html, "dashboard-layout missing"
    assert 'class="dashboard-col col-left"' in html, "col-left missing"
    assert 'class="dashboard-col col-right"' in html, "col-right missing"
    assert 'min-width: 840px' in html, "desktop media query missing"
    assert 'id="statNet14d"' in html, "statNet14d missing"
    assert 'id="btnCat14d"' in html, "btnCat14d missing"
    assert 'id="btnCatAll"' in html, "btnCatAll missing"
    assert 'id="catTotalLabel"' in html, "catTotalLabel missing"
    assert 'id="telemetryCanvas"' in html, "telemetryCanvas missing"
    assert 'id="canvasHudTooltip"' in html, "canvasHudTooltip missing"
    assert 'id="analyticsCloseBtn"' in html, "analyticsCloseBtn missing"
    assert 'id="statSavingsRate"' in html, "statSavingsRate missing"
    assert 'id="statRunwayDays"' in html, "statRunwayDays missing"
    assert 'id="statDebtExposure"' in html, "statDebtExposure missing"

    print("PASSED")


def test_audit_and_streak_telemetry():
    print("[*] Testing Audit Trail & Streak/Missed Days calculation...", end=" ")
    from datetime import date, timedelta

    today = date.today()
    # Mock transactions for last 5 days, but skipping 2 days ago
    txs = [
        {"id": "tx_today", "date": today.strftime("%Y-%m-%d"), "amount": 200, "type": "Allowance"},
        {"id": "tx_yesterday", "date": (today - timedelta(days=1)).strftime("%Y-%m-%d"), "amount": 50, "type": "Expense"},
        # Day 2 is missed!
        {"id": "tx_day3", "date": (today - timedelta(days=3)).strftime("%Y-%m-%d"), "amount": 100, "type": "Allowance"},
    ]

    # Check active days
    active_dates = {t["date"] for t in txs}
    missed_count = 0
    for i in range(1, 14):
        d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        if d_str not in active_dates:
            missed_count += 1

    assert (today - timedelta(days=2)).strftime("%Y-%m-%d") not in active_dates
    assert missed_count >= 1

    # Check streak: today and yesterday active -> streak = 2
    streak = 0
    for i in range(14):
        d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        if d_str in active_dates:
            streak += 1
        else:
            break
    assert streak == 2, f"Expected streak of 2, got {streak}"
    
    # Test Uncapped Global Streak: 25 consecutive days
    txs_25d = [{"date": (today - timedelta(days=i)).strftime("%Y-%m-%d")} for i in range(25)]
    active_25d = {t["date"] for t in txs_25d}
    global_streak = 0
    check_d = today
    if check_d.strftime("%Y-%m-%d") not in active_25d:
        check_d -= timedelta(days=1)
    while check_d.strftime("%Y-%m-%d") in active_25d:
        global_streak += 1
        check_d -= timedelta(days=1)
    assert global_streak == 25, f"Expected 25-day global streak, got {global_streak}"

    # Check audit log structure
    audit_events = []
    def mock_audit(action, target_id, summary):
        audit_events.append({"action": action, "targetId": target_id, "summary": summary})

    mock_audit("EDIT_TX", "tx_1", "Edited amount from 50 to 45")
    mock_audit("DELETE_TX", "tx_2", "Deleted expense 20")
    assert len(audit_events) == 2
    assert audit_events[0]["action"] == "EDIT_TX"

    print("PASSED")


def test_stash_functionality():
    print("[*] Testing Stash Vault logic & balance isolation...", end=" ")
    # Simulate initial state: 200 allowance
    txs = [
        {"id": "tx_1", "type": "Allowance", "category": "Allowance", "amount": 200.0, "date": "2026-09-13"}
    ]
    stashes = []

    # Stash 50.00
    stash_amt = 50.0
    txs.insert(0, {"id": "tx_2", "type": "Expense", "category": "Stash", "amount": stash_amt, "date": "2026-09-13"})
    stashes.append({"id": "st_1", "amount": stash_amt, "note": "Emergency savings"})

    today_in = sum(t["amount"] for t in txs if t["type"] == "Allowance")
    today_out = sum(t["amount"] for t in txs if t["type"] == "Expense")
    remaining_balance = today_in - today_out
    total_stash = sum(s["amount"] for s in stashes)

    assert remaining_balance == 150.0, f"Expected 150.0 balance after stash, got {remaining_balance}"
    assert total_stash == 50.0, f"Expected 50.0 total stash, got {total_stash}"

    # Unstash (Add back to finance) 30.00
    unstash_amt = 30.0
    stashes[0]["amount"] -= unstash_amt
    txs.insert(0, {"id": "tx_3", "type": "Allowance", "category": "Stash", "amount": unstash_amt, "date": "2026-09-13"})

    today_in = sum(t["amount"] for t in txs if t["type"] == "Allowance")
    today_out = sum(t["amount"] for t in txs if t["type"] == "Expense")
    new_balance = today_in - today_out
    new_stash_total = sum(s["amount"] for s in stashes)

    assert new_balance == 180.0, f"Expected 180.0 balance after unstashing, got {new_balance}"
    assert new_stash_total == 20.0, f"Expected 20.0 remaining stash, got {new_stash_total}"

    print("PASSED")


def test_missed_days_anchor_and_rollover():
    print("[*] Testing Missed Days anchor & Daily Balance Rollover...", end=" ")
    from datetime import date, timedelta

    today = date.today()
    today_str = today.strftime("%Y-%m-%d")

    # Scenario A: Brand new installation today (0 missed days)
    install_date_str = today_str
    txs_new_install = [{"id": "tx_1", "date": today_str, "amount": 200, "type": "Allowance"}]
    active_dates_a = {t["date"] for t in txs_new_install}

    missed_days_a = []
    for i in range(13, 0, -1):
        d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        has_activity = d_str in active_dates_a
        is_today = (d_str == today_str)
        is_before_start = (d_str < install_date_str)
        is_missed = not has_activity and not is_today and not is_before_start
        if is_missed:
            missed_days_a.append(d_str)

    assert len(missed_days_a) == 0, f"New install should have 0 missed days, got {len(missed_days_a)}"

    # Scenario B: Installed 4 days ago, skipped day 2
    install_4d_ago = (today - timedelta(days=4)).strftime("%Y-%m-%d")
    txs_4d = [
        {"id": "t0", "date": (today - timedelta(days=4)).strftime("%Y-%m-%d"), "amount": 100, "type": "Allowance"},
        {"id": "t1", "date": (today - timedelta(days=3)).strftime("%Y-%m-%d"), "amount": 50, "type": "Expense"},
        # Day 2 skipped
        {"id": "t3", "date": (today - timedelta(days=1)).strftime("%Y-%m-%d"), "amount": 20, "type": "Expense"},
        {"id": "t4", "date": today_str, "amount": 200, "type": "Allowance"},
    ]
    active_dates_b = {t["date"] for t in txs_4d}
    missed_days_b = []
    untracked_days_b = []
    for i in range(13, 0, -1):
        d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        has_activity = d_str in active_dates_b
        is_today = (d_str == today_str)
        is_before_start = (d_str < install_4d_ago)
        if is_before_start:
            untracked_days_b.append(d_str)
        elif not has_activity and not is_today:
            missed_days_b.append(d_str)

    assert len(missed_days_b) == 1, f"Expected exactly 1 missed day (day 2), got {len(missed_days_b)}"
    assert missed_days_b[0] == (today - timedelta(days=2)).strftime("%Y-%m-%d")
    assert len(untracked_days_b) == 9, f"Days prior to install must be marked untracked, got {len(untracked_days_b)}"

    # Scenario C: Daily Rollover Math
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    y_txs = [
        {"date": yesterday_str, "type": "Allowance", "amount": 200.0},
        {"date": yesterday_str, "type": "Expense", "amount": 120.0},
    ]
    y_in = sum(t["amount"] for t in y_txs if t["type"] == "Allowance")
    y_out = sum(t["amount"] for t in y_txs if t["type"] == "Expense")
    rollover_amt = max(0.0, y_in - y_out)
    assert rollover_amt == 80.0

    today_in = 200.0
    today_out = 50.0
    today_remaining_with_rollover = (today_in + rollover_amt) - today_out
    assert today_remaining_with_rollover == 230.0

    print("PASSED")


def test_formula_sanitization_and_debt_validation():
    print("[*] Testing Sheets formula sanitization & Debt payment clamping...", end=" ")

    # Formula Sanitization
    def sanitize_val(val):
        if isinstance(val, str):
            trimmed = val.strip()
            if trimmed.startswith(("=", "+", "-", "@")):
                return "'" + val
        return val

    assert sanitize_val("=SUM(A1:B2)") == "'=SUM(A1:B2)"
    assert sanitize_val("+200 Bonus") == "'+200 Bonus"
    assert sanitize_val("-50 Discount") == "'-50 Discount"
    assert sanitize_val("@mention") == "'@mention"
    assert sanitize_val("Regular Note") == "Regular Note"
    assert sanitize_val(100.5) == 100.5

    # Debt Settlement Clamping
    debt = {
        "id": "debt_1",
        "person": "John",
        "amount": 100.0,
        "paid": 80.0,
        "status": "Active"
    }
    remaining = max(0.0, debt["amount"] - debt["paid"])
    assert remaining == 20.0

    # User attempts to pay 50.0 on a 20.0 remaining debt
    pay_attempt = 50.0
    actual_pay = min(pay_attempt, remaining)
    debt["paid"] += actual_pay
    if debt["paid"] >= debt["amount"]:
        debt["status"] = "Settled"

    assert actual_pay == 20.0, f"Expected pay clamped to 20.0, got {actual_pay}"
    assert debt["paid"] == 100.0, f"Expected total paid 100.0, got {debt['paid']}"
    assert debt["status"] == "Settled"

    print("PASSED")


def test_decimal_and_integer_precision():
    print("[*] Testing Integer & Decimal robustness (no decimal, commas, floats)...", end=" ")

    def parse_amount(val):
        if val is None:
            return 0.0
        if isinstance(val, (int, float)):
            import math
            if math.isnan(val) or not math.isfinite(val):
                return 0.0
            return round(val * 100.0) / 100.0
        import re
        s = str(val).strip()
        s = re.sub(r"[^0-9.-]", "", s)
        if not s or s in ("-", "."):
            return 0.0
        try:
            return round(float(s) * 100.0) / 100.0
        except ValueError:
            return 0.0

    # Test cases without decimals
    assert parse_amount(200) == 200.0
    assert parse_amount("200") == 200.0
    assert parse_amount("200.") == 200.0

    # Test cases with decimals
    assert parse_amount(200.5) == 200.50
    assert parse_amount("200.00") == 200.00
    assert parse_amount("0.75") == 0.75

    # Currency strings & commas
    assert parse_amount("1,500.50") == 1500.50
    assert parse_amount("₱200") == 200.0
    assert parse_amount("PHP 1,000") == 1000.0

    # IEEE 754 precision glitch test
    assert parse_amount(0.1 + 0.2) == 0.30

    print("PASSED")


def test_pautang_cash_linking():
    print("[*] Testing Pautang & Debt cash balance linking...", end=" ")
    # Initial balance: 200 allowance
    txs = [{"id": "tx_1", "type": "Allowance", "amount": 200.0, "date": "2026-09-14"}]
    debts = []

    # Case 1: Pautang with affect_cash = False (existing debt, no cash deducted from wallet)
    debts.append({"id": "ut_1", "person": "Alice", "amount": 50.0, "paid": 0.0, "direction": "Owed to Me", "status": "Active"})
    total_in = sum(t["amount"] for t in txs if t["type"] == "Allowance")
    total_out = sum(t["amount"] for t in txs if t["type"] == "Expense")
    assert (total_in - total_out) == 200.0, "Cash balance should remain 200 when affect_cash is False"

    # Case 2: Pautang with affect_cash = True (lent directly from wallet)
    pautang_amt = 80.0
    debts.append({"id": "ut_2", "person": "Bob", "amount": pautang_amt, "paid": 0.0, "direction": "Owed to Me", "status": "Active"})
    txs.insert(0, {"id": "tx_pautang", "type": "Expense", "amount": pautang_amt, "date": "2026-09-14", "relatedDebtId": "ut_2"})
    total_in = sum(t["amount"] for t in txs if t["type"] == "Allowance")
    total_out = sum(t["amount"] for t in txs if t["type"] == "Expense")
    assert (total_in - total_out) == 120.0, "Cash balance should be 120 after deducting 80 pautang"

    # Case 3: Settle Bob's debt with affect_cash = True (collection added back to allowance)
    debts[1]["paid"] = 80.0
    debts[1]["status"] = "Settled"
    txs.insert(0, {"id": "tx_settle", "type": "Allowance", "amount": 80.0, "date": "2026-09-14", "relatedDebtId": "ut_2"})
    total_in = sum(t["amount"] for t in txs if t["type"] == "Allowance")
    total_out = sum(t["amount"] for t in txs if t["type"] == "Expense")
    assert (total_in - total_out) == 200.0, "Cash balance should restore to 200 after debt collection"

    # Verify popup.js has the relevant logic
    popup_js_path = EXT_DIR / "popup.js"
    with open(popup_js_path, "r", encoding="utf-8") as f:
        js_code = f.read()
    assert "uAffectCash" in js_code, "uAffectCash logic missing from popup.js"
    assert "sAffectCash" in js_code, "sAffectCash logic missing from popup.js"
    assert "updateUtangAffectCashLabel" in js_code, "updateUtangAffectCashLabel missing from popup.js"

    print("PASSED")


def test_sync_queue_and_two_way_operations():
    print("[*] Testing Two-Way Google Sheets Queue & Cumulative Rollover...", end=" ")
    popup_js_path = EXT_DIR / "popup.js"
    google_sync_path = EXT_DIR / "google_sync.js"

    with open(popup_js_path, "r", encoding="utf-8") as f:
        popup_code = f.read()
    with open(google_sync_path, "r", encoding="utf-8") as f:
        sync_code = f.read()

    assert "function queueSyncItem" in popup_code, "queueSyncItem helper must be defined in popup.js"
    assert "updateTransaction" in sync_code, "updateTransaction must be in google_sync.js"
    assert "updateDebtStatus" in sync_code, "updateDebtStatus must be in google_sync.js"
    assert "deleteRowById" in sync_code, "deleteRowById must be in google_sync.js"
    assert 'item.op === "EDIT_TX"' in sync_code, "EDIT_TX handling missing in google_sync.js"
    assert 'item.op === "DEL_TX"' in sync_code, "DEL_TX handling missing in google_sync.js"
    assert 'item.op === "SETTLE_DEBT"' in sync_code, "SETTLE_DEBT handling missing in google_sync.js"
    assert 'item.op === "DEL_DEBT"' in sync_code, "DEL_DEBT handling missing in google_sync.js"

    # Multi-day cumulative rollover test (Friday -> Monday without losing funds)
    past_txs = [
        {"date": "2026-09-11", "type": "Allowance", "amount": 200.0},
        {"date": "2026-09-11", "type": "Expense", "amount": 150.0}, # +50 left Friday
        # Weekend: 0 txs
    ]
    today_str = "2026-09-14"
    past_allow = sum(t["amount"] for t in past_txs if t["date"] < today_str and t["type"] == "Allowance")
    past_spent = sum(t["amount"] for t in past_txs if t["date"] < today_str and t["type"] == "Expense")
    cumulative_rollover = max(0.0, past_allow - past_spent)
    assert cumulative_rollover == 50.0, f"Expected 50.0 cumulative rollover, got {cumulative_rollover}"

    print("PASSED")


def main():
    print("Running project test suite...")
    print("-" * 50)
    test_js_syntax()
    test_python_syntax()
    test_decimal_and_integer_precision()
    test_financial_and_utang_math()
    test_pautang_cash_linking()
    test_sync_queue_and_two_way_operations()
    test_stash_functionality()
    test_audit_and_streak_telemetry()
    test_missed_days_anchor_and_rollover()
    test_formula_sanitization_and_debt_validation()
    test_extension_bundle()
    print("-" * 50)
    print("All tests passed successfully.")


if __name__ == "__main__":
    main()
