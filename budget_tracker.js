// ============================================================
//  Budget Tracker Widget — Scriptable
//  $300 fun budget split across each week of the month
//  Syncs every expense to Google Sheets automatically
// ============================================================

var SHEETS_URL = "Paste your sheet's URL";

// ── Budget config ──────────────────────────────────────────
var MONTHLY_FUN_BUDGET = 300; // split across weeks automatically

// ── Categories ─────────────────────────────────────────────
var CATEGORIES = [
  { label: "Rent & Utilities", key: "rent",        isFun: false },
  { label: "Electricity",      key: "electricity",  isFun: false },
  { label: "Wifi",             key: "wifi",         isFun: false },
  { label: "SIM",              key: "sim",          isFun: false },
  { label: "Groceries",        key: "groceries",    isFun: false },
  { label: "Fun",              key: "fun",          isFun: true  },
];

// ── File storage ───────────────────────────────────────────
var FM   = FileManager.iCloud();
var DIR  = FM.documentsDirectory();
var FILE = FM.joinPath(DIR, "budget_data_v2.json");

// ══════════════════════════════════════════════════════════
//  DATE HELPERS
// ══════════════════════════════════════════════════════════

function getMonday(date) {
  var d = date ? new Date(date) : new Date();
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getMondayOf(isoStr) {
  return getMonday(new Date(isoStr));
}

function getMonthKey(date) {
  var d = date ? new Date(date) : new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function getMonthLabel(monthKey) {
  var parts = monthKey.split("-");
  var months = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  return months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

function getTodayLabel() {
  var d = new Date();
  var months = ["Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"];
  var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[d.getDay()] + " " + months[d.getMonth()] + " " + d.getDate();
}

// ── Get all Monday-starting weeks that overlap a given month ──
// Returns array of { weekStart (ISO), weekEnd (ISO), label, budget }
// The $300 is divided evenly among all weeks that have at least 1 day in the month.
function getWeeksOfMonth(year, month) {
  // month is 0-indexed
  var firstDay = new Date(year, month, 1);
  var lastDay  = new Date(year, month + 1, 0); // last day of month

  // Find the Monday on or before the 1st
  var startMonday = new Date(firstDay);
  var dow = startMonday.getDay();
  var diff = dow === 0 ? -6 : 1 - dow;
  startMonday.setDate(startMonday.getDate() + diff);
  startMonday.setHours(0, 0, 0, 0);

  var weeks = [];
  var cursor = new Date(startMonday);

  while (cursor <= lastDay) {
    var weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Only include if week overlaps the month
    var overlapStart = cursor < firstDay ? firstDay : cursor;
    var overlapEnd   = weekEnd > lastDay ? lastDay  : weekEnd;
    if (overlapStart <= overlapEnd) {
      var mns = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      var label = "Week " + (weeks.length + 1) + ": " +
                  mns[overlapStart.getMonth()] + " " + overlapStart.getDate() +
                  " – " + mns[overlapEnd.getMonth()] + " " + overlapEnd.getDate();
      weeks.push({
        weekStart: cursor.toISOString(),
        weekEnd:   weekEnd.toISOString(),
        label:     label,
        overlapStart: overlapStart,
        overlapEnd:   overlapEnd
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  // Divide $300 evenly across weeks
  var perWeek = MONTHLY_FUN_BUDGET / weeks.length;
  weeks.forEach(function(w) { w.budget = perWeek; });
  return weeks;
}

function getCurrentWeekInfo() {
  var now   = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth();
  var weeks = getWeeksOfMonth(year, month);
  var monday = getMonday();

  // Find the week we're currently in
  var thisWeek = null;
  var weekNum  = 0;
  for (var i = 0; i < weeks.length; i++) {
    if (weeks[i].weekStart === monday) {
      thisWeek = weeks[i];
      weekNum  = i + 1;
      break;
    }
  }
  // Fallback if not found (e.g. straddles month)
  if (!thisWeek) {
    thisWeek = { weekStart: monday, budget: MONTHLY_FUN_BUDGET / 4, label: "This Week" };
    weekNum  = 1;
  }
  return { week: thisWeek, weekNum: weekNum, totalWeeks: weeks.length, allWeeks: weeks };
}

// ══════════════════════════════════════════════════════════
//  DATA LOAD / SAVE
// ══════════════════════════════════════════════════════════

async function loadData() {
  try { await FM.downloadFileFromiCloud(FILE); } catch(e) {}
  if (!FM.fileExists(FILE)) {
    var blank = { currentWeek: getMonday(), allTransactions: [] };
    FM.writeString(FILE, JSON.stringify(blank));
    return blank;
  }
  try {
    return JSON.parse(FM.readString(FILE));
  } catch(e) {
    return { currentWeek: getMonday(), allTransactions: [] };
  }
}

function saveData(data) {
  FM.writeString(FILE, JSON.stringify(data));
}

// ══════════════════════════════════════════════════════════
//  TOTALS
// ══════════════════════════════════════════════════════════

function getWeekTotals(data, weekStart) {
  var txns = (data.allTransactions || []).filter(function(t) {
    return getMondayOf(t.logged) === weekStart;
  });
  var totals = {};
  CATEGORIES.forEach(function(c) { totals[c.key] = 0; });
  var funSpent = 0;
  txns.forEach(function(t) {
    if (totals[t.category] !== undefined) totals[t.category] += t.amount;
    if (t.category === "fun") funSpent += t.amount;
  });
  return { byCat: totals, funSpent: funSpent };
}

// ══════════════════════════════════════════════════════════
//  GOOGLE SHEETS SYNC
// ══════════════════════════════════════════════════════════

async function syncToSheets(txn) {
  try {
    var req = new Request(SHEETS_URL);
    req.method = "POST";
    req.headers = { "Content-Type": "application/json" };
    req.body = JSON.stringify({
      date:        txn.date,
      category:    txn.categoryLabel,
      amount:      txn.amount,
      description: txn.description,
      month:       getMonthLabel(getMonthKey()),
      loggedAt:    txn.logged
    });
    await req.loadString();
  } catch(e) {
    // Silent fail — data is still saved locally
  }
}

// ══════════════════════════════════════════════════════════
//  WIDGET UI
// ══════════════════════════════════════════════════════════

function getColor(pct) {
  if (pct <= 0.5)  return new Color("#00e5a0");
  if (pct <= 0.75) return new Color("#ffd166");
  if (pct <= 1.0)  return new Color("#ff9f43");
  return new Color("#ff6b6b");
}

function getStatus(pct) {
  if (pct <= 0.5)  return "ON TRACK ✓";
  if (pct <= 0.75) return "GETTING CLOSE";
  if (pct <= 1.0)  return "ALMOST GONE";
  return "OVER BUDGET";
}

async function buildWidget(data) {
  var info      = getCurrentWeekInfo();
  var thisWeek  = info.week;
  var totals    = getWeekTotals(data, thisWeek.weekStart);
  var funSpent  = totals.funSpent;
  var weekBudget = thisWeek.budget;
  var remaining = weekBudget - funSpent;
  var pct       = Math.min(funSpent / weekBudget, 2);
  var color     = getColor(pct);

  var w    = new ListWidget();
  var grad = new LinearGradient();
  grad.colors    = [new Color("#1a1a24"), new Color("#0f0f14")];
  grad.locations = [0, 1];
  w.backgroundGradient = grad;
  w.setPadding(12, 14, 12, 14);

  // ── Top row: week label + status ──
  var topRow = w.addStack();
  topRow.layoutHorizontally();
  var lbl = topRow.addText("WEEK " + info.weekNum + " OF " + info.totalWeeks);
  lbl.font      = Font.boldSystemFont(8);
  lbl.textColor = new Color("#6b6b80");
  topRow.addSpacer();
  var statusTxt = topRow.addText(getStatus(pct));
  statusTxt.font      = Font.boldSystemFont(8);
  statusTxt.textColor = color;

  w.addSpacer(1);

  // ── Budget label ──
  var budgetLabel = w.addText("FUN BUDGET  $" + weekBudget.toFixed(0) + " / WK  ·  $300 / MO");
  budgetLabel.font      = Font.systemFont(7);
  budgetLabel.textColor = new Color("#44445a");

  w.addSpacer(2);

  // ── Big remaining number ──
  var remainingStr = remaining >= 0
    ? "$" + remaining.toFixed(0)
    : "-$" + Math.abs(remaining).toFixed(0);
  var bigNum = w.addText(remainingStr);
  bigNum.font               = Font.boldSystemFont(38);
  bigNum.textColor          = color;
  bigNum.minimumScaleFactor = 0.5;

  var leftLabel = w.addText(remaining >= 0 ? "fun money left this week" : "OVER BUDGET");
  leftLabel.font      = Font.systemFont(9);
  leftLabel.textColor = new Color("#6b6b80");

  w.addSpacer(5);

  // ── Mini week-by-week breakdown for the month ──
  var now    = new Date();
  var allWks = info.allWeeks;
  var divider = w.addStack();
  divider.size            = new Size(0, 1);
  divider.backgroundColor = new Color("#2a2a3a");
  w.addSpacer(4);

  for (var i = 0; i < allWks.length; i++) {
    var wk       = allWks[i];
    var wkTotals = getWeekTotals(data, wk.weekStart);
    var wkSpent  = wkTotals.funSpent;
    var wkLeft   = wk.budget - wkSpent;
    var isCurrent = wk.weekStart === thisWeek.weekStart;

    var row = w.addStack();
    row.layoutHorizontally();

    var wkLbl = row.addText("W" + (i + 1) + (isCurrent ? " ◀" : "  "));
    wkLbl.font      = Font.boldSystemFont(7);
    wkLbl.textColor = isCurrent ? color : new Color("#44445a");

    row.addSpacer();

    var wkAmt = row.addText(
      wkLeft >= 0
        ? "$" + wkLeft.toFixed(0) + " left"
        : "-$" + Math.abs(wkLeft).toFixed(0)
    );
    wkAmt.font      = Font.systemFont(7);
    wkAmt.textColor = isCurrent ? color : new Color("#44445a");

    w.addSpacer(1);
  }

  w.url = "scriptable:///run/BudgetTracker";
  return w;
}

// ══════════════════════════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════════════════════════

async function showHistory(data) {
  var allTxns = data.allTransactions || [];
  if (allTxns.length === 0) {
    var a = new Alert();
    a.title   = "No transactions yet";
    a.message = "Start logging expenses!";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  var menuAlert = new Alert();
  menuAlert.title   = "View History";
  menuAlert.message = allTxns.length + " expenses stored";
  menuAlert.addAction("This Week");
  menuAlert.addAction("This Month (by week)");
  menuAlert.addAction("All Months");
  menuAlert.addCancelAction("Back");
  var choice = await menuAlert.presentAlert();
  if (choice === -1) return;

  if (choice === 0) {
    var info = getCurrentWeekInfo();
    var txns = allTxns.filter(function(t) {
      return getMondayOf(t.logged) === info.week.weekStart;
    }).reverse();
    await showTxnList(txns, "This Week");

  } else if (choice === 1) {
    // Month broken down by week
    var now    = new Date();
    var info   = getCurrentWeekInfo();
    var weeks  = info.allWeeks;
    var msg    = "── " + getMonthLabel(getMonthKey()) + " ──\n$300 ÷ " + weeks.length + " weeks = $" + weeks[0].budget.toFixed(0) + "/wk\n\n";

    for (var i = 0; i < weeks.length; i++) {
      var wk      = weeks[i];
      var wkTotals = getWeekTotals(data, wk.weekStart);
      var wkLeft  = wk.budget - wkTotals.funSpent;
      var isCur   = wk.weekStart === info.week.weekStart;
      msg += (isCur ? "▶ " : "  ") + wk.label + "\n";
      msg += "  Fun spent: $" + wkTotals.funSpent.toFixed(2) +
             "  |  Left: $" + wkLeft.toFixed(2) + "\n\n";
    }

    var a = new Alert();
    a.title   = getMonthLabel(getMonthKey()) + " Breakdown";
    a.message = msg;
    a.addAction("Done");
    await a.presentAlert();

  } else {
    // All months
    var months = {};
    allTxns.forEach(function(t) {
      var mk = getMonthKey(t.logged);
      if (!months[mk]) months[mk] = [];
      months[mk].push(t);
    });
    var keys = Object.keys(months).sort().reverse();

    var monthAlert = new Alert();
    monthAlert.title = "Select Month";
    keys.forEach(function(k) {
      monthAlert.addAction(getMonthLabel(k) + " (" + months[k].length + ")");
    });
    monthAlert.addCancelAction("Back");
    var mChoice = await monthAlert.presentAlert();
    if (mChoice === -1) return;

    var selectedKey  = keys[mChoice];
    var selectedTxns = months[selectedKey].slice().reverse();

    var catTotals = {};
    CATEGORIES.forEach(function(c) { catTotals[c.key] = 0; });
    selectedTxns.forEach(function(t) {
      if (catTotals[t.category] !== undefined) catTotals[t.category] += t.amount;
    });
    var summary = "── Category Totals ──\n";
    CATEGORIES.forEach(function(c) {
      if (catTotals[c.key] > 0) {
        summary += c.label + ": $" + catTotals[c.key].toFixed(2) + "\n";
      }
    });
    summary += "\n── Transactions ──";
    await showTxnList(selectedTxns, getMonthLabel(selectedKey), summary);
  }
}

async function showTxnList(txns, title, prefix) {
  if (txns.length === 0) {
    var a = new Alert();
    a.title   = "No expenses";
    a.message = "Nothing logged yet for this period.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  var pageSize = 8;
  for (var p = 0; p < txns.length; p += pageSize) {
    var slice = txns.slice(p, p + pageSize);
    var lines = slice.map(function(t) {
      var cat = CATEGORIES.find(function(c) { return c.key === t.category; });
      return "[" + (cat ? cat.label : t.category) + "] $" + parseFloat(t.amount).toFixed(2) +
             "  " + (t.description || "") + "  (" + (t.date || "") + ")";
    });
    var msg = (prefix && p === 0 ? prefix + "\n\n" : "") + lines.join("\n");

    var pageAlert = new Alert();
    pageAlert.title   = title + (txns.length > pageSize ? " (p" + (Math.floor(p/pageSize)+1) + ")" : "");
    pageAlert.message = msg;
    if (p + pageSize < txns.length) {
      pageAlert.addAction("Next →");
      pageAlert.addCancelAction("Done");
      if ((await pageAlert.presentAlert()) === -1) break;
    } else {
      pageAlert.addAction("Done");
      await pageAlert.presentAlert();
      break;
    }
  }
}

// ══════════════════════════════════════════════════════════
//  ADD EXPENSE
// ══════════════════════════════════════════════════════════

async function addExpense(data) {
  var info       = getCurrentWeekInfo();
  var thisWeek   = info.week;
  var totals     = getWeekTotals(data, thisWeek.weekStart);
  var weekBudget = thisWeek.budget;
  var funLeft    = weekBudget - totals.funSpent;

  // Step 1: Choose category
  var catAlert = new Alert();
  catAlert.title   = "Category";
  catAlert.message = "Fun budget: $" + weekBudget.toFixed(0) + "/wk  ·  Left: $" + funLeft.toFixed(2);
  CATEGORIES.forEach(function(c) {
    catAlert.addAction(c.label);
  });
  catAlert.addCancelAction("Cancel");
  var catChoice = await catAlert.presentAlert();
  if (catChoice === -1) return data;

  var selectedCat = CATEGORIES[catChoice];

  // Step 2: Amount + Description
  var step1 = new Alert();
  step1.title   = selectedCat.label;
  step1.message = "Enter amount and description";
  step1.addTextField("Amount  e.g. 12.50", "");
  step1.addTextField("Description  e.g. " + defaultDesc(selectedCat.key), "");
  step1.addAction("Next →");
  step1.addCancelAction("Cancel");
  if ((await step1.presentAlert()) === -1) return data;

  var val  = parseFloat(step1.textFieldValue(0));
  var desc = step1.textFieldValue(1).trim();

  if (isNaN(val) || val <= 0) {
    var err = new Alert();
    err.title   = "Invalid amount";
    err.message = "Please enter a number greater than 0.";
    err.addAction("OK");
    await err.presentAlert();
    return data;
  }

  // Step 3: Date
  var step2 = new Alert();
  step2.title   = "Date of Expense";
  step2.message = "When did you spend this?";
  step2.addTextField("Date  e.g. " + getTodayLabel(), getTodayLabel());
  step2.addAction("Log It ✓");
  step2.addCancelAction("Cancel");
  if ((await step2.presentAlert()) === -1) return data;

  var dateEntry = step2.textFieldValue(0).trim() || getTodayLabel();

  // Save
  var txn = {
    amount:        val,
    description:   desc || "No description",
    date:          dateEntry,
    category:      selectedCat.key,
    categoryLabel: selectedCat.label,
    logged:        new Date().toISOString()
  };

  if (!data.allTransactions) data.allTransactions = [];
  data.allTransactions.push(txn);
  saveData(data);
  syncToSheets(txn);

  // Confirmation
  var newTotals    = getWeekTotals(data, thisWeek.weekStart);
  var newRemaining = weekBudget - newTotals.funSpent;
  var conf         = new Alert();
  conf.title       = "✓ Logged!";
  var confirmMsg   = "$" + val.toFixed(2) + "  " + (desc || "No description") +
                     "\n" + dateEntry + "  ·  " + selectedCat.label;
  if (selectedCat.isFun) {
    confirmMsg += "\n\nWeek " + info.weekNum + " fun budget: $" + weekBudget.toFixed(0) +
                  "\nLeft this week: " +
                  (newRemaining >= 0
                    ? "$" + newRemaining.toFixed(2)
                    : "OVER by $" + Math.abs(newRemaining).toFixed(2));
  }
  conf.message = confirmMsg;
  conf.addAction("OK");
  await conf.presentAlert();

  return data;
}

function defaultDesc(key) {
  var map = {
    rent:        "Rent payment",
    electricity: "Electric bill",
    wifi:        "Internet bill",
    sim:         "Phone plan",
    groceries:   "Grocery run",
    fun:         "Coffee / dining out"
  };
  return map[key] || "Expense";
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════

async function runInApp(data) {
  var currentMonday = getMonday();
  if (data.currentWeek !== currentMonday) {
    data.currentWeek = currentMonday;
    saveData(data);
  }

  var info       = getCurrentWeekInfo();
  var totals     = getWeekTotals(data, info.week.weekStart);
  var funLeft    = info.week.budget - totals.funSpent;
  var overUnder  = funLeft >= 0
    ? "Fun left: $" + funLeft.toFixed(2)
    : "⚠️ Over by $" + Math.abs(funLeft).toFixed(2);

  var mainAlert   = new Alert();
  mainAlert.title = "💰 Budget Tracker";
  mainAlert.message = overUnder +
    "\nWeek " + info.weekNum + " of " + info.totalWeeks +
    "  ·  $" + info.week.budget.toFixed(0) + "/wk  ($300/mo)";
  mainAlert.addAction("➕  Add Expense");
  mainAlert.addAction("📋  View History");
  mainAlert.addCancelAction("Close");

  var choice = await mainAlert.presentAlert();
  if (choice === 0) {
    data = await addExpense(data);
  } else if (choice === 1) {
    await showHistory(data);
  }

  return data;
}

// ── Entry point ──
var data = await loadData();
var currentMonday = getMonday();
if (data.currentWeek !== currentMonday) {
  data.currentWeek = currentMonday;
  if (!data.allTransactions) data.allTransactions = [];
  saveData(data);
}

if (config.runsInWidget) {
  var widget = await buildWidget(data);
  Script.setWidget(widget);
} else {
  data = await runInApp(data);
  var widget = await buildWidget(data);
  widget.presentSmall();
}

Script.complete();