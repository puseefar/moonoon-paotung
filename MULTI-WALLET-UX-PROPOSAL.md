# Multi-Wallet UX Proposal

This proposal extends the current multi-wallet foundation in the app into a clearer user journey, a wallet-level audit experience, and a bank icon system that can support Thai bank branding once official assets are available.

## Current State

The project already has a good base:

- `wallets` table stores each wallet with `name`, `icon`, `balance`, `currency`, and `isActive`
- `transactions` table stores `walletId`, `toWalletId`, and `type: income | expense | transfer`
- `app/wallet-manage.tsx` handles wallet list, add, edit, and delete
- `app/wallet-transfer.tsx` handles wallet-to-wallet transfer
- `app/(tabs)/add.tsx` already lets the user choose a wallet when saving income or expense

The biggest UX gap is that wallets behave like selectable containers, but not yet like first-class financial spaces with their own timeline, filters, and audit view.

## Product Goal

Make each wallet feel like a real account that the user can:

1. Understand at a glance
2. Use confidently during transaction entry
3. Inspect historically
4. Trust when checking where money came from, where it went, and how the balance changed

## Recommended Information Architecture

### 1. Home

Keep the existing home summary, but add a compact wallet strip near the top:

- Total balance across all wallets
- Top 3 wallets by usage or balance
- "View all wallets" entry point

Purpose:

- Gives users immediate awareness of which wallet is active in daily life
- Reduces the feeling that wallets are hidden in a settings-like page

### 2. Wallet List Screen

Use `wallet-manage` as the wallet hub, but split the page into clearer sections:

- Total balance card
- Wallet list
- Quick actions:
  - Add wallet
  - Transfer between wallets
- Optional secondary section:
  - Inactive wallets

Each wallet card should show:

- Brand icon or wallet icon
- Wallet name
- Wallet type label:
  - Cash
  - Bank account
  - E-wallet
  - Savings
- Current balance
- Last activity date
- Small action chips:
  - View details
  - Edit

Tap behavior:

- Tapping the card should open wallet detail
- Edit should be a secondary action, not the main action

This will make the screen feel less like CRUD and more like finance navigation.

### 3. Add Transaction Screen

The wallet selector in `app/(tabs)/add.tsx` is already useful. Improve it with:

- Wallet chips grouped by most-used first
- A visible "Default wallet" badge for the primary wallet
- Balance preview under the selected wallet
- Warning when user selects a wallet with low balance for an expense

Recommended microcopy:

- "ใช้จ่ายจาก"
- "รับเงินเข้า"

Purpose:

- Makes source/destination intent more obvious
- Reduces wrong-wallet mistakes

### 4. Transfer Screen

The current transfer screen already works. Improve clarity with a transfer summary block before submit:

- From wallet
- To wallet
- Amount
- From balance before
- From balance after
- To balance before
- To balance after

This preview is important because transfers are one of the easiest places for users to hesitate.

## New Screen: Wallet Detail

Add a dedicated wallet detail screen such as:

- `app/wallet/[id].tsx`

This should be the main inspection surface for each wallet.

### Header Area

- Wallet icon / bank icon
- Wallet name
- Wallet type
- Current balance
- Last updated timestamp

### Summary Cards

- Income this month
- Expense this month
- Transfer in this month
- Transfer out this month
- Net change this month

### Quick Actions

- Add income
- Add expense
- Transfer from this wallet
- Transfer to this wallet
- Edit wallet

### Wallet Activity Timeline

This is the most important section for your requested audit experience.

Each row should show:

- Action type:
  - Income added
  - Expense added
  - Transfer out
  - Transfer in
  - Transaction deleted
  - Transaction edited
- Amount
- Counterparty wallet when transfer is involved
- Category
- Note
- Date and time
- Balance before
- Balance after

Example labels:

- "+500 เงินเข้า"
- "-120 ค่าอาหาร"
- "โอนออกไป กสิกรไทย"
- "รับโอนจาก กรุงไทย"

### Filters Inside Wallet Detail

- All
- Income
- Expense
- Transfer
- Added
- Edited
- Deleted
- This month / custom range

### Empty State

- Show a friendly empty state for a newly created wallet
- Offer:
  - Add first transaction
  - Transfer money into this wallet

## Required Audit Design

Your request includes checking:

- What was added
- What was transferred
- What was deleted
- Which wallet was involved
- What the balance was before

The current schema is not enough to guarantee a trustworthy balance history because the app stores only the current wallet balance, not the before/after snapshot for each action.

To support a real audit trail, I recommend adding a dedicated activity ledger.

## Recommended Data Model Upgrade

### Option A: Extend `transactions`

Add fields such as:

- `sourceWalletBalanceBefore`
- `sourceWalletBalanceAfter`
- `targetWalletBalanceBefore`
- `targetWalletBalanceAfter`
- `deletedAt`
- `editedFromTransactionId`
- `actionStatus: active | deleted | superseded`

Pros:

- Smaller implementation
- Reuses the existing transaction table

Cons:

- Editing history becomes harder to reason about over time

### Option B: Add `wallet_activity_log`

Recommended structure:

- `id`
- `walletId`
- `relatedTransactionId`
- `actionType`
  - `income_added`
  - `expense_added`
  - `transfer_out`
  - `transfer_in`
  - `transaction_deleted`
  - `transaction_edited`
- `counterpartyWalletId`
- `amount`
- `balanceBefore`
- `balanceAfter`
- `note`
- `createdAt`
- `actor`

Pros:

- Best auditability
- Easy to render a per-wallet timeline
- Supports future admin/support debugging

Cons:

- Slightly more implementation work

If the goal is user trust and good financial UX, Option B is the stronger long-term direction.

## UX Rule for Delete and Edit

Do not silently mutate history.

Recommended behavior:

- Edit:
  - Save as a new change event
  - Keep the old values in audit history
- Delete:
  - Mark the original transaction as deleted
  - Add a compensating wallet activity entry

This protects trust. Users should be able to answer:

"Why did my wallet balance change?"

without confusion.

## Wallet Icon System

The current wallet icons are emoji-based. That is fine for prototypes, but not for a polished finance experience.

I recommend supporting 3 wallet icon modes:

1. System icon
2. Brand icon
3. Custom uploaded icon

### Wallet Types

Each wallet should have:

- `walletType`
  - `cash`
  - `bank`
  - `ewallet`
  - `savings`
  - `credit`
- `brandKey`
  - optional, for example `krungthai`, `kbank`, `scb`

### Thai Bank Brand Set

The banks you mentioned can be modeled as preset brands:

- `krungthai`
- `kbank`
- `krungsri`
- `scb`
- `bangkok-bank`
- `gsb`
- `baac`

For each preset, define:

- Display name in Thai
- Primary brand color
- Icon source
- Fallback generic bank icon

### Visual Style Recommendation

Each wallet card should use:

- Brand icon inside a rounded square
- Light tinted background using the bank brand color
- Consistent icon size and safe padding
- Optional short label under the icon for accessibility

### Important Note About Real Bank Icons

If you want the app to use real Thai bank icons or logos, the cleanest next step is for you to provide the image files.

Suggested asset format:

- PNG or SVG
- Transparent background
- Square format
- At least `128x128`

Suggested file naming:

- `krungthai.png`
- `kbank.png`
- `krungsri.png`
- `scb.png`
- `bangkok-bank.png`
- `gsb.png`
- `baac.png`

Once those assets exist, the app can map `brandKey` to the official icon file cleanly.

## Suggested Build Order

### Phase 1

- Make wallet cards open wallet detail
- Add wallet detail screen
- Add wallet-level transaction list
- Add wallet filter to history

### Phase 2

- Add balance before/after preview on transfer confirmation
- Add wallet activity log model
- Record edit/delete activity

### Phase 3

- Add wallet type and brand presets
- Replace emoji wallet icons with structured icon rendering
- Plug in official bank icons from provided assets

## Practical Recommendation for Your Team

For the next implementation step, the best value path is:

1. Build wallet detail first
2. Add wallet-specific history filters
3. Introduce an audit log for before/after balance
4. Then plug in real Thai bank assets

This ordering improves UX immediately while also preparing the data layer for trust and traceability.
