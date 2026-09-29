# Zecians — Payment Flow (Real ZEC)

## Goal

Buyers pay in **real ZEC**. Our backend — not the frontend, not an
explorer, not the buyer — decides when a payment is real.

## Payment request anatomy

```
{
  "request_id": "pay_7f3a…",
  "payment_ref": "ZC-9F2B1C4D8E",     # appears in the tx memo (ZIP 321-style)
  "nft_number": 3,
  "amount_zat": 20000000,             # 0.2 ZEC, integer zatoshi
  "recipient_address": "<our shielded UA>",
  "status": "pending",
  "created_at": 1730000000,
  "expires_at": 1730001800            # TTL (default 30 min)
}
```

Why a per-request `payment_ref`: shielded payments are private, so we
cannot rely on "payment to address X for NFT 3". The memo reference (or a
unique-amount fallback) is what lets us match payments to requests without
requiring buyers to expose themselves.

## Matching rules (`payment_monitor.py`)

An observed transaction `{txid, address, amount_zat, memo, height}` is:

1. **matched** if its memo contains an open request's `payment_ref`, OR
   its exact amount matches exactly one open request (fallback; flagged
   `match_mode: "amount_fallback"` for review).
2. **underpaid** if amount < requested → request terminal state
   `underpaid` with shortfall; buyer must start a new request. (Simplest
   safe rule: never "top up" merge logic in v1.)
3. **overpaid** if amount > requested → accepted, excess recorded,
   flagged `needs_review` with excess amount. **Never auto-refunded.**
4. **duplicate** if a second tx matches an already-confirmed/consumed
   request → recorded as orphan `needs_review`. Never auto-refunded.
5. **unmatched** → orphan pool with reason; reconciler ages them into
   `needs_review` for manual handling.

## Confirmation policy (`payment_confirmation.py`)

- `PAYMENT_MIN_CONFIRMATIONS` (default 3) consecutive-depth confirmations
  on our node before status `confirmed`.
- **Reorg handling:** if a previously confirmed tx's block disappears
  (tip < tx height or tx absent from chain), status reverts to `pending`
  and the mint/sale downstream is **frozen** until re-confirmed. Downstream
  actions (issuance) only trigger on `confirmed`, so a reorg can at worst
  delay, never double-issue.

## Reconciliation (`payment_reconciliation.py`)

Runs periodically; idempotent; safe across restarts (state is in the store):

- pending requests past `expires_at` → `expired`.
- `confirmed` but not yet consumed by minting/marketplace → re-enqueued.
- orphans older than a threshold → `needs_review`.
- every action returns a machine-readable change list (auditable).

## Restart & retry safety

All state lives in the store (JSON prototype → PostgreSQL). Every
transition is derived from the store, so a crashed backend replays
reconcile → same result (tested in `tests/test_payment_flow.py::…restart…`).

## Prototype status

- ✅ Full matching/confirmation/reconciliation logic + tests.
- ❌ Live node observation. The design supports: (a) Zallet/node RPC
  scanning with a viewing key, or (b) a lightwalletd-style backend source —
  to be chosen and verified during the testnet phase. We will document the
  trust model of whichever source we pick.

## Payment safety rules for the project

- Backend never spends; it only observes and records.
- Refunds are always **manual** and logged with a reason.
- The words "trustless" are banned from any UI while any escrow/custody
  exists (see `marketplace_flow.md`).
