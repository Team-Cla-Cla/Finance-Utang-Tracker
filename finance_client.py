#!/usr/bin/env python3
"""
finance_client.py - Offline-first CLI tool for Personal Finance & Utang Tracker

Usage:
  finance metrics                     # Show balance, savings & utang projections
  finance allowance <amount> [-n <note>] [-d <date>]
  finance log <amount> [-c <category>] [-n <note>] [-d <date>]
  finance quick <preset>              # hwy15, sch22, ret20, hm15, all72, rice30, rice40, meal45, meal60
  finance list [limit]                # Show transaction history with IDs
  finance edit <id> [--amount <amt>] [--category <cat>] [--notes <notes>] [--date <date>] [--type <Expense|Allowance>]
  finance delete <id>                 # Delete a transaction by ID
  finance utang                       # Show debts and "pay now" projections
  finance utang add <person> <amount> [--direction <i-owe|owed-to-me>] [-n <note>]
  finance utang settle <id> [--amount <amt>]
  finance utang delete <id>
  finance export                      # Print JSON backup
"""

import sys
import json
import time
import argparse
from datetime import datetime, date, timedelta
from pathlib import Path

DATA_DIR = Path.home() / ".config" / "finance"
DATA_FILE = DATA_DIR / "finance_data.json"

DEFAULT_PRESETS = {
    "hwy15": {"label": "Hwy 15", "amount": 15.0, "category": "Transportation", "notes": "Home tricycle to highway junction", "type": "Expense"},
    "sch22": {"label": "Sch 22", "amount": 22.0, "category": "Transportation", "notes": "Highway jeepney/bus to school gate", "type": "Expense"},
    "ret20": {"label": "Ret 20", "amount": 20.0, "category": "Transportation", "notes": "School going home to highway transfer", "type": "Expense"},
    "hm15": {"label": "Hm 15", "amount": 15.0, "category": "Transportation", "notes": "Highway transfer back to home", "type": "Expense"},
    "all72": {"label": "All 72", "amount": 72.0, "category": "Transportation", "notes": "Full day roundtrip school commute", "type": "Expense"},
    "commute": {"label": "All 72", "amount": 72.0, "category": "Transportation", "notes": "Full day roundtrip school commute", "type": "Expense"},
    "rice30": {"label": "Rice 30", "amount": 30.0, "category": "Food", "notes": "Brought rice from home, bought light viand", "type": "Expense"},
    "rice40": {"label": "Rice 40", "amount": 40.0, "category": "Food", "notes": "Brought rice from home, bought regular viand", "type": "Expense"},
    "meal45": {"label": "Meal 45", "amount": 45.0, "category": "Food", "notes": "Cafeteria meal with rice", "type": "Expense"},
    "norice45": {"label": "Meal 45", "amount": 45.0, "category": "Food", "notes": "Cafeteria meal with rice", "type": "Expense"},
    "meal60": {"label": "Meal 60", "amount": 60.0, "category": "Food", "notes": "Full cafeteria meal with rice & drinks", "type": "Expense"},
    "norice60": {"label": "Meal 60", "amount": 60.0, "category": "Food", "notes": "Full cafeteria meal with rice & drinks", "type": "Expense"}
}


def load_data():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        initial = {
            "transactions": [],
            "debts": [],
            "updated_at": datetime.now().isoformat()
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(initial, f, indent=2)
        return initial

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[!] Error loading {DATA_FILE}: {e}")
        return {"transactions": [], "debts": []}


def save_data(data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = datetime.now().isoformat()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def compute_metrics(data):
    today = date.today()
    today_str = today.strftime("%Y-%m-%d")
    diff_to_mon = (0 if today.weekday() == 0 else -today.weekday())
    monday = today + timedelta(days=diff_to_mon)

    today_allowance = 0.0
    today_spent = 0.0
    has_allowance_today = False

    week_allowance = 0.0
    week_spent = 0.0

    for tx in data.get("transactions", []):
        d_str = tx.get("date", "")
        amt = float(tx.get("amount", 0.0))
        is_allow = (tx.get("type", "").lower() == "allowance")

        try:
            tx_d = datetime.strptime(d_str[:10], "%Y-%m-%d").date()
        except Exception:
            tx_d = today

        if d_str == today_str:
            if is_allow:
                today_allowance += amt
                has_allowance_today = True
            else:
                today_spent += amt

        if tx_d >= monday:
            if is_allow:
                week_allowance += amt
            else:
                week_spent += amt

    total_i_owe = 0.0
    total_owed_to_me = 0.0
    active_debts = []

    for d in data.get("debts", []):
        if d.get("status", "Active").lower() == "active":
            rem = max(0.0, float(d.get("amount", 0.0)) - float(d.get("paid", 0.0)))
            d["remaining"] = rem
            active_debts.append(d)
            if "i owe" in d.get("direction", "").lower():
                total_i_owe += rem
            else:
                total_owed_to_me += rem

    today_remaining = today_allowance - today_spent
    week_savings = week_allowance - week_spent

    return {
        "today": today_str,
        "has_allowance_today": has_allowance_today,
        "today_allowance": today_allowance,
        "today_spent": today_spent,
        "today_remaining": today_remaining,
        "week_allowance": week_allowance,
        "week_spent": week_spent,
        "week_savings": week_savings,
        "total_i_owe": total_i_owe,
        "total_owed_to_me": total_owed_to_me,
        "projected_today_if_pay_debts": today_remaining - total_i_owe,
        "projected_week_if_pay_debts": week_savings - total_i_owe,
        "active_debts": active_debts
    }


def print_metrics(data):
    m = compute_metrics(data)
    print("=" * 54)
    print(f" FINANCIAL METRICS SUMMARY ({m['today']})")
    print("=" * 54)
    print(f" Today Allowance Received   : {m['today_allowance']:10.2f}")
    print(f" Today Expenses Spent       : {m['today_spent']:10.2f}")
    print(f" Today Remaining Balance    : {m['today_remaining']:10.2f}")
    print("-" * 54)
    print(f" This Week's Total Net Saved: {m['week_savings']:10.2f}")
    total_stash = sum(float(s.get("amount", 0.0)) for s in data.get("stashes", []))
    print(f" Stash Vault (Hidden Reserve): {total_stash:10.2f}")
    print("=" * 54)
    print(" DEBTS & UTANG SUMMARY")
    print(f" - I Owe Others (Payable)   : {m['total_i_owe']:10.2f}")
    print(f" - Others Owe Me (Collect)  : {m['total_owed_to_me']:10.2f}")
    print("-" * 54)
    print(" PAY-NOW PROJECTION (If you pay off all debts now):")
    print(f" > Today's Cash Remaining   : {m['projected_today_if_pay_debts']:10.2f}")
    print(f" > Week's Net Saved Remaining: {m['projected_week_if_pay_debts']:10.2f}")
    print("=" * 54)

    if not m["has_allowance_today"]:
        print("\n[!] Check-in: No allowance recorded for today yet.")
        print("    If you had school or received money today, run:")
        print("      finance allowance 200 -n 'Daily school allowance'\n")

    txs = data.get("transactions", [])
    if txs:
        print("[Recent Activity]")
        print(f"  {'ID':<18} {'Date':<10} {'Type':<10} {'Category':<15} {'Amount':>8}  {'Notes'}")
        print(f"  {'-'*18} {'-'*10} {'-'*10} {'-'*15} {'-'*8}  {'-'*15}")
        for tx in txs[:6]:
            sign = "+" if tx.get("type") == "Allowance" else "-"
            amt = f"{sign}{float(tx.get('amount', 0)):7.2f}"
            print(f"  {tx.get('id', ''):<18} {tx.get('date', ''):<10} {tx.get('type', ''):<10} {tx.get('category', ''):<15} {amt}  {tx.get('notes', '')}")
        print()


def cmd_allowance(args):
    data = load_data()
    today_str = args.date or date.today().strftime("%Y-%m-%d")
    tx_id = f"tx_{int(time.time()*1000)}_{int(time.time())%1000}"
    tx = {
        "id": tx_id,
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "type": "Allowance",
        "category": "Allowance",
        "amount": float(args.amount),
        "notes": args.note or ""
    }
    data.setdefault("transactions", []).insert(0, tx)
    save_data(data)
    print(f"[✓] Logged Allowance: +{args.amount:.2f} ({args.note or 'No notes'}) [{today_str}] (ID: {tx_id})")


def cmd_log(args):
    data = load_data()
    today_str = args.date or date.today().strftime("%Y-%m-%d")
    tx_id = f"tx_{int(time.time()*1000)}_{int(time.time())%1000}"
    tx = {
        "id": tx_id,
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "type": "Expense",
        "category": args.category,
        "amount": float(args.amount),
        "notes": args.note or ""
    }
    data.setdefault("transactions", []).insert(0, tx)
    save_data(data)
    print(f"[✓] Logged Expense: -{args.amount:.2f} [{args.category}] ({args.note or 'No notes'}) [{today_str}] (ID: {tx_id})")


def cmd_quick(args):
    preset_key = args.preset.lower().strip()
    if preset_key not in DEFAULT_PRESETS:
        print(f"[!] Unknown preset: '{args.preset}'. Available: {', '.join(DEFAULT_PRESETS.keys())}")
        sys.exit(1)
    p = DEFAULT_PRESETS[preset_key]
    args.amount = p["amount"]
    args.category = p["category"]
    args.note = p["notes"]
    args.date = None
    cmd_log(args)


def cmd_list(args):
    data = load_data()
    txs = data.get("transactions", [])
    limit = args.limit or 20
    if not txs:
        print("No transactions found.")
        return
    print(f"\n[Showing {min(len(txs), limit)} of {len(txs)} transactions]")
    print(f"  {'ID':<18} {'Date':<10} {'Type':<10} {'Category':<15} {'Amount':>8}  {'Notes'}")
    print(f"  {'-'*18} {'-'*10} {'-'*10} {'-'*15} {'-'*8}  {'-'*15}")
    for tx in txs[:limit]:
        sign = "+" if tx.get("type") == "Allowance" else "-"
        amt = f"{sign}{float(tx.get('amount', 0)):7.2f}"
        print(f"  {tx.get('id', ''):<18} {tx.get('date', ''):<10} {tx.get('type', ''):<10} {tx.get('category', ''):<15} {amt}  {tx.get('notes', '')}")
    print()


def cmd_edit(args):
    data = load_data()
    txs = data.get("transactions", [])
    found = None
    for tx in txs:
        if tx.get("id") == args.id:
            found = tx
            break
    if not found:
        print(f"[!] Transaction ID not found: {args.id}")
        sys.exit(1)

    if args.amount is not None: found["amount"] = float(args.amount)
    if args.category is not None: found["category"] = args.category
    if args.notes is not None: found["notes"] = args.notes
    if args.date is not None: found["date"] = args.date
    if args.type is not None: found["type"] = args.type

    save_data(data)
    print(f"[✓] Transaction {args.id} updated.")


def cmd_delete(args):
    data = load_data()
    txs = data.get("transactions", [])
    before = len(txs)
    data["transactions"] = [tx for tx in txs if tx.get("id") != args.id]
    if len(data["transactions"]) == before:
        print(f"[!] Transaction ID not found: {args.id}")
        sys.exit(1)
    save_data(data)
    print(f"[✓] Transaction {args.id} deleted.")


def cmd_utang_list(data):
    m = compute_metrics(data)
    print("=" * 64)
    print(" DEBTS & UTANG SUMMARY")
    print("=" * 64)
    print(f" Total You Owe Others (I Owe)   : {m['total_i_owe']:10.2f}")
    print(f" Total Others Owe You (Owed Me) : {m['total_owed_to_me']:10.2f}")
    print("-" * 64)
    print(" PAY-NOW CASH PROJECTION:")
    print(f" > Today Cash If Debts Settled  : {m['projected_today_if_pay_debts']:10.2f}")
    print(f" > Week Net If Debts Settled    : {m['projected_week_if_pay_debts']:10.2f}")
    print("=" * 64)

    debts = m["active_debts"]
    if not debts:
        print("\nNo active debts.\n")
        return

    print(f"\n[Active Debts]")
    print(f"  {'ID':<18} {'Person':<15} {'Direction':<12} {'Original':>8} {'Paid':>8} {'Remaining':>10} {'Notes'}")
    print(f"  {'-'*18} {'-'*15} {'-'*12} {'-'*8} {'-'*8} {'-'*10} {'-'*15}")
    for d in debts:
        orig = float(d.get("amount", 0))
        paid = float(d.get("paid", 0))
        rem = float(d.get("remaining", orig - paid))
        print(f"  {d.get('id', ''):<18} {d.get('person', ''):<15} {d.get('direction', ''):<12} {orig:8.2f} {paid:8.2f} {rem:10.2f} {d.get('notes', '')}")
    print()


def cmd_utang_add(args):
    data = load_data()
    today_str = date.today().strftime("%Y-%m-%d")
    direction = "I Owe" if "i owe" in args.direction.lower() else "Owed to Me"
    u_id = f"ut_{int(time.time()*1000)}_{int(time.time())%1000}"
    debt = {
        "id": u_id,
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "person": args.person,
        "direction": direction,
        "amount": float(args.amount),
        "paid": 0.0,
        "status": "Active",
        "notes": args.note or ""
    }
    data.setdefault("debts", []).insert(0, debt)
    save_data(data)
    print(f"[✓] Added Utang: {args.person} {float(args.amount):.2f} ({direction}) [{u_id}]")


def cmd_utang_settle(args):
    data = load_data()
    debts = data.get("debts", [])
    found = None
    for d in debts:
        if d.get("id") == args.id:
            found = d
            break
    if not found:
        print(f"[!] Debt ID not found: {args.id}")
        sys.exit(1)

    total_amt = float(found.get("amount", 0.0))
    current_paid = float(found.get("paid", 0.0))
    rem = max(0.0, total_amt - current_paid)
    settle_amt = float(args.amount) if args.amount is not None else rem

    new_paid = current_paid + settle_amt
    found["paid"] = new_paid
    if new_paid >= total_amt:
        found["status"] = "Settled"

    is_i_owe = "i owe" in found.get("direction", "").lower()
    tx_id = f"tx_{int(time.time()*1000)}_{int(time.time())%1000}"
    tx = {
        "id": tx_id,
        "timestamp": datetime.now().isoformat(),
        "date": date.today().strftime("%Y-%m-%d"),
        "type": "Expense" if is_i_owe else "Allowance",
        "category": "Debt Repayment" if is_i_owe else "Debt Collection",
        "amount": settle_amt,
        "notes": f"{'Paid debt to' if is_i_owe else 'Collected debt from'} {found.get('person')}"
    }
    data.setdefault("transactions", []).insert(0, tx)
    save_data(data)
    print(f"[✓] Settled {settle_amt:.2f} for debt {args.id} ({found.get('person')}). Status: {found['status']}.")


def cmd_utang_delete(args):
    data = load_data()
    debts = data.get("debts", [])
    before = len(debts)
    data["debts"] = [d for d in debts if d.get("id") != args.id]
    if len(data["debts"]) == before:
        print(f"[!] Debt ID not found: {args.id}")
        sys.exit(1)
    save_data(data)
def cmd_stash_list(data):
    stashes = data.get("stashes", [])
    total = sum(float(s.get("amount", 0.0)) for s in stashes)

    print("=" * 54)
    print(" STASH VAULT (HIDDEN RESERVES)")
    print("=" * 54)
    print(f" Total Stashed Funds        : {total:10.2f}")
    print("-" * 54)

    if not stashes:
        print("  (No active stashes)")
    else:
        print(f"  {'ID':<18} {'Date':<10} {'Amount':>8}  {'Note'}")
        print(f"  {'-'*18} {'-'*10} {'-'*8}  {'-'*15}")
        for s in stashes:
            s_id = s.get("id", "")
            amt = float(s.get("amount", 0.0))
            note = s.get("note", "Reserve")
            d_str = s.get("date", "")
            print(f"  {s_id:<18} {d_str:<10} {amt:8.2f}  {note}")
    print("=" * 54)


def cmd_stash_add(args):
    data = load_data()
    amt = float(args.amount)
    if amt <= 0:
        print("[!] Amount must be greater than zero.")
        return

    today_str = (args.date or date.today().strftime("%Y-%m-%d"))
    note = (args.note or "Reserve").strip()
    s_id = f"st_{int(time.time()*1000)}"
    tx_id = f"tx_{int(time.time()*1000)}"

    tx = {
        "id": tx_id,
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "type": "Expense",
        "category": "Stash",
        "amount": amt,
        "notes": f"Stashed: {note}"
    }

    stash_entry = {
        "id": s_id,
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "amount": amt,
        "note": note,
        "txId": tx_id
    }

    data.setdefault("transactions", []).insert(0, tx)
    data.setdefault("stashes", []).insert(0, stash_entry)
    save_data(data)

    print(f"[+] Stashed {amt:,.2f} into Vault ({note}).")
    print(f"    Deducted from spendable balance. Stash ID: {s_id}")


def cmd_stash_balance(args):
    data = load_data()
    m = compute_metrics(data)
    rem = m["today_remaining"]
    if rem <= 0:
        print(f"[!] No positive balance remaining today to stash (Current balance: {rem:,.2f}).")
        return

    args.amount = rem
    if not getattr(args, "note", None):
        args.note = "Saved from today's balance"
    cmd_stash_add(args)


def cmd_stash_release(args):
    data = load_data()
    stashes = data.get("stashes", [])
    target = None
    target_idx = -1

    for idx, s in enumerate(stashes):
        if s.get("id") == args.id:
            target = s
            target_idx = idx
            break

    if not target:
        print(f"[!] Stash ID '{args.id}' not found.")
        return

    total_avail = float(target.get("amount", 0.0))
    rel_amt = float(args.amount) if args.amount is not None else total_avail

    if rel_amt <= 0 or rel_amt > total_avail:
        print(f"[!] Invalid release amount. Available in stash: {total_avail:,.2f}")
        return

    today_str = date.today().strftime("%Y-%m-%d")
    note = target.get("note", "Reserve")
    tx_id = f"tx_{int(time.time()*1000)}"

    tx = {
        "id": tx_id,
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "type": "Allowance",
        "category": "Stash",
        "amount": rel_amt,
        "notes": f"Unstashed: {note}"
    }

    data.setdefault("transactions", []).insert(0, tx)

    if rel_amt >= total_avail:
        stashes.pop(target_idx)
        print(f"[+] Released full {rel_amt:,.2f} from stash '{args.id}' back to today's finance.")
    else:
        target["amount"] = total_avail - rel_amt
        print(f"[+] Released partial {rel_amt:,.2f} from stash '{args.id}'. Remaining in stash: {target['amount']:,.2f}.")

    save_data(data)
    print(f"    Added back to today's spendable balance. Transaction ID: {tx_id}")


def cmd_stash_delete(args):
    data = load_data()
    stashes = data.get("stashes", [])
    found = False
    for idx, s in enumerate(stashes):
        if s.get("id") == args.id:
            stashes.pop(idx)
            found = True
            break

    if not found:
        print(f"[!] Stash ID '{args.id}' not found.")
        return

    save_data(data)
    print(f"[+] Deleted stash '{args.id}' without returning funds.")


def main():
    parser = argparse.ArgumentParser(description="Offline-First Personal Finance & Utang Tracker")
    subparsers = parser.add_subparsers(dest="subcommand")

    subparsers.add_parser("metrics")

    p_allow = subparsers.add_parser("allowance")
    p_allow.add_argument("amount", type=float)
    p_allow.add_argument("-n", "--note", default=None)
    p_allow.add_argument("-d", "--date", default=None)

    p_log = subparsers.add_parser("log")
    p_log.add_argument("amount", type=float)
    p_log.add_argument("-c", "--category", default="Other")
    p_log.add_argument("-n", "--note", default=None)
    p_log.add_argument("-d", "--date", default=None)

    p_quick = subparsers.add_parser("quick")
    p_quick.add_argument("preset")

    p_list = subparsers.add_parser("list")
    p_list.add_argument("limit", nargs="?", type=int, default=20)

    p_edit = subparsers.add_parser("edit")
    p_edit.add_argument("id")
    p_edit.add_argument("--amount", type=float, default=None)
    p_edit.add_argument("--category", default=None)
    p_edit.add_argument("--notes", default=None)
    p_edit.add_argument("--date", default=None)
    p_edit.add_argument("--type", choices=["Expense", "Allowance"], default=None)

    p_del = subparsers.add_parser("delete")
    p_del.add_argument("id")

    p_utang = subparsers.add_parser("utang")
    utang_sub = p_utang.add_subparsers(dest="utang_action")

    u_add = utang_sub.add_parser("add")
    u_add.add_argument("person")
    u_add.add_argument("amount", type=float)
    u_add.add_argument("--direction", default="I Owe")
    u_add.add_argument("-n", "--note", default=None)

    u_settle = utang_sub.add_parser("settle")
    u_settle.add_argument("id")
    u_settle.add_argument("--amount", type=float, default=None)

    u_del = utang_sub.add_parser("delete")
    u_del.add_argument("id")

    p_stash = subparsers.add_parser("stash")
    stash_sub = p_stash.add_subparsers(dest="stash_action")

    st_add = stash_sub.add_parser("add")
    st_add.add_argument("amount", type=float)
    st_add.add_argument("-n", "--note", default=None)
    st_add.add_argument("-d", "--date", default=None)

    st_bal = stash_sub.add_parser("balance")
    st_bal.add_argument("-n", "--note", default=None)
    st_bal.add_argument("-d", "--date", default=None)

    st_rel = stash_sub.add_parser("release")
    st_rel.add_argument("id")
    st_rel.add_argument("--amount", type=float, default=None)

    st_del = stash_sub.add_parser("delete")
    st_del.add_argument("id")

    subparsers.add_parser("export")

    args = parser.parse_args()

    if not args.subcommand or args.subcommand == "metrics":
        print_metrics(load_data())
    elif args.subcommand == "allowance":
        cmd_allowance(args)
    elif args.subcommand == "log":
        cmd_log(args)
    elif args.subcommand == "quick":
        cmd_quick(args)
    elif args.subcommand == "list":
        cmd_list(args)
    elif args.subcommand == "edit":
        cmd_edit(args)
    elif args.subcommand == "delete":
        cmd_delete(args)
    elif args.subcommand == "utang":
        if not args.utang_action:
            cmd_utang_list(load_data())
        elif args.utang_action == "add":
            cmd_utang_add(args)
        elif args.utang_action == "settle":
            cmd_utang_settle(args)
        elif args.utang_action == "delete":
            cmd_utang_delete(args)
    elif args.subcommand == "stash":
        if not args.stash_action:
            cmd_stash_list(load_data())
        elif args.stash_action == "add":
            cmd_stash_add(args)
        elif args.stash_action == "balance":
            cmd_stash_balance(args)
        elif args.stash_action == "release":
            cmd_stash_release(args)
        elif args.stash_action == "delete":
            cmd_stash_delete(args)
    elif args.subcommand == "export":
        print(json.dumps(load_data(), indent=2))


if __name__ == "__main__":
    main()
