# User test — landing page 3 (15 min × 5 users)

## Setup
- Serve folder over http (not file://): any static server, open `index.html`.
- One phone-size (360px) + one desktop run at least. Note `?lang=` used.

## Script (read aloud, don't help)
1. "Book a train from Howrah to New Delhi for next week, AC 3 Tier." (Search → Select)
2. "Add yourself as passenger and confirm." (Review → PNR receipt)
3. "Check that PNR in the PNR tab." (deep-link receipt → PNR check)
4. "Track train 12301 in the Live tab."
5. "Switch language to Hindi, then back. Sign in with any 10-digit number."

## Score per user (✓/✗ + seconds + quote)
| step | ok | time | friction quote |
|---|---|---|---|
| search | | | |
| select→passenger | | | |
| review→confirm→PNR | | | |
| pnr check | | | |
| live track | | | |
| lang + signin | | | |

## Funnel (from IRCTC_STATS.read())
- `funnel:search / #bkGo / #bkConfirm / #pnrBtn / #liveBtn` counts.
- Biggest relative drop = fix #1. Second = fix #2. Rest → backlog.

## Rollback (C2)
- Kill-test: set all `config.local.js` values to `""` (or delete file) → reload →
  search/PNR/live must render mock + "Sample data" pill in <1s.
- Any shape-error spike or user fail → revert config, zero code change.
