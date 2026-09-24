# Contributing to Finance & Utang Tracker

Thank you for helping improve Finance & Utang Tracker. Contributions are welcome for bug fixes, documentation, tests, accessibility, and new features that preserve the project's offline-first behavior.

## Before you start

- Search existing issues and pull requests before opening a new one.
- Do not use real financial records, OAuth tokens, spreadsheet IDs, or other private data in examples, screenshots, tests, or commits.
- For security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Clone your fork and create a focused branch:

```bash
git clone https://github.com/<your-username>/Finance-Utang-Tracker.git
cd Finance-Utang-Tracker
git checkout -b feature/short-description
```

The web app and extension have no package installation step. Python 3.8 or later and Node.js are required for the test suite.

Run the tests before submitting changes:

```bash
python3 test_tracker.py
```

To run the web app locally:

```bash
python3 -m http.server 8000 --directory docs
```

Then open <http://localhost:8000>.

## Making changes

- Keep changes focused and consistent with existing patterns.
- Update related documentation when behavior or setup changes.
- Add or update tests for changed functionality.
- Keep the web app, extension, and CLI behavior consistent where they implement the same feature.
- Avoid adding dependencies unless they are necessary and documented.

## Pull requests

Before opening a pull request:

1. Rebase or update your branch with the current default branch.
2. Run `python3 test_tracker.py`.
3. Check the diff for credentials, personal data, generated files, and unrelated changes.
4. Describe the problem, solution, testing performed, and any user-facing behavior changes.

Pull requests should pass the required checks and receive maintainer review before merging.

## Commit messages

Use a short, imperative subject with an optional conventional prefix:

```text
docs: clarify GitHub Pages deployment
fix: preserve debt balance after partial settlement
test: validate stash release calculations
```

## Reporting issues

Use the repository issue templates for bug reports and feature requests. Include enough detail to reproduce the issue, but remove private financial data and credentials.
