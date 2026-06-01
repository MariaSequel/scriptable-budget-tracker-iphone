# 💰 Budget Tracker — Scriptable Widget for AuDHD Brains

A no-friction iPhone budget tracker for AuDHD (Autism + ADHD) brains — 
log expenses in seconds, see your fun money instantly, syncs to Google 
Sheets automatically.

## Why this exists

Built specifically for AuDHD brains who struggle with traditional budgeting 
apps. No overwhelming dashboards, no subscription, no login — just tap, log, done.

**Why it works for AuDHD:**
- Lives on your home screen so it's always visible (out of sight = out of mind)
- 3 taps to log an expense, no context switching to another app
- Color-coded feedback (green → yellow → orange → red) so you know instantly
  where you stand without doing math
- Fixed categories mean no decision fatigue about where to put things
- Fun money is a hard visual limit — removes the mental load of calculating
  "can I afford this?"
- Automatic Google Sheets sync means nothing is lost even if you forget to
  review it
- No accounts, no ads, no notifications pestering you

## Features
- 6 expense categories: Rent & Utilities, Electricity, Wifi, SIM, Groceries, Fun
- $300/month fun budget split evenly across each week of the month
- Widget shows which week you're on and how much fun money is left
- Auto-syncs every expense to Google Sheets
- Full history viewable by week and by month with category totals
- Color-coded status: green → yellow → orange → red

## Requirements
- iPhone with [Scriptable](https://scriptable.app) (free on the App Store)
- A Google account (for Google Sheets sync)

## Setup

### Step 1 — Google Sheets
1. Create a new Google Sheet
2. Rename the first tab to `Expenses` (capital E)
3. Add these headers in row 1:
   - A1: `Date`
   - B1: `Category`
   - C1: `Amount`
   - D1: `Description`
   - E1: `Month`
   - F1: `Logged At`
4. Go to **Extensions → Apps Script**
5. Delete any existing code and paste the contents of `AppScript.gs`
6. Click **Save**
7. Click **Deploy → New Deployment**
8. Click the gear icon ⚙️ → select **Web App**
9. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
10. Click **Deploy** and copy the Web App URL

### Step 2 — Scriptable
1. Install [Scriptable](https://scriptable.app) from the App Store
2. Open Scriptable → tap **+** to create a new script
3. Name it `BudgetTracker`
4. Paste the contents of `BudgetTracker.js`
5. Replace `YOUR_WEB_APP_URL_HERE` with the URL you copied in Step 1
6. Tap **Done**

### Step 3 — Add the widget
1. Long press your iPhone home screen
2. Tap **+** → search for **Scriptable**
3. Choose the small widget size
4. Tap the widget → select `BudgetTracker` as the script
5. Tap **Done**

## How to use
- Tap the widget to open the app
- Tap **➕ Add Expense** → choose a category → enter amount and description → enter date → done
- Your fun money remaining updates instantly
- Tap **📋 View History** to see spending by week or by month

## Notes
- Your iPhone is the source of truth — deleting rows in Google Sheets won't affect the app
- Sync is one-way: phone → Google Sheets only
- The weekly fun budget auto-adjusts based on how many weeks are in the current month
  (e.g. a 5-week month = $60/week, a 4-week month = $75/week)
- If you logged expenses before setting up Google Sheets, you can manually add them
  to the sheet or run a one-time sync script

## File structure
