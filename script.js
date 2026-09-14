"use strict";
document.addEventListener("DOMContentLoaded", function () {
  /* =====================================================
     退休倒數計畫｜新版 JS
     - 完全退休 / 微退休
     - 生活模式
     - 現金折疊
     - 投資折疊
     - 定存折疊
     - 外幣換算
     - 退休試算
     - 資產成長預估
     - 儲存 / 載入 / 重設
  ===================================================== */
  var STORAGE_KEY = "retirementCountdownPlan";
  var fxRates = {
    TWD: 1,
    USD: 31.5,
    JPY: 0.215,
    EUR: 36.8,
    GBP: 42.5,
    HKD: 4.02,
    CNY: 4.35
  };
  var currencyOptions =
    '<option value="TWD">TWD 新台幣</option>' +
    '<option value="USD">USD 美元</option>' +
    '<option value="JPY">JPY 日圓</option>' +
    '<option value="EUR">EUR 歐元</option>' +
    '<option value="GBP">GBP 英鎊</option>' +
    '<option value="HKD">HKD 港幣</option>' +
    '<option value="CNY">CNY 人民幣</option>';
  /* =====================================================
     基本工具
  ===================================================== */
  function getNumber(id) {
    var element = document.getElementById(id);
    if (!element) return 0;
    return Number(element.value) || 0;
  }
  function formatNTD(value) {
    return "NT$ " + Math.round(value || 0).toLocaleString();
  }
  function toTWD(amount, currency) {
    var rate = fxRates[currency] || 1;
    return (Number(amount) || 0) * rate;
  }
  function getActiveGoal() {
    var button = document.querySelector("[data-goal].active");
    return button ? button.getAttribute("data-goal") : "full";
  }
  function getTravelBudget() {
    var button = document.querySelector("[data-life].active");
    if (!button) return 0;
    var life = button.getAttribute("data-life");
    if (life === "happy") return 250000;
    if (life === "luxury") return 315000;
    return 0;
  }
  /* =====================================================
     1. 完全退休 / 微退休
  ===================================================== */
  var goalButtons = document.querySelectorAll("[data-goal]");
  goalButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      goalButtons.forEach(function (item) {
        item.classList.remove("active");
      });
      button.classList.add("active");
      var goal = button.getAttribute("data-goal");
      var fullSetting = document.getElementById("fullSetting");
      var microSetting = document.getElementById("microSetting");
      if (goal === "full") {
        if (fullSetting) fullSetting.classList.remove("hidden");
        if (microSetting) microSetting.classList.add("hidden");
      } else {
        if (fullSetting) fullSetting.classList.add("hidden");
        if (microSetting) microSetting.classList.remove("hidden");
      }
      updateAllRetirementCalculations();
    });
  });
  /* =====================================================
     2. 安穩 / 小確幸 / 豪華
  ===================================================== */
  var lifeButtons = document.querySelectorAll("[data-life]");
  var selectedLifestyle = document.getElementById("selectedLifestyle");
  var travelBudgetElement = document.getElementById("travelBudget");
  lifeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      lifeButtons.forEach(function (item) {
        item.classList.remove("active");
      });
      button.classList.add("active");
      var life = button.getAttribute("data-life");
      if (selectedLifestyle) {
        if (life === "stable") selectedLifestyle.textContent = "🌿 安穩";
        if (life === "happy") selectedLifestyle.textContent = "✈️ 小確幸";
        if (life === "luxury") selectedLifestyle.textContent = "✨ 豪華";
      }
      if (travelBudgetElement) {
        travelBudgetElement.textContent = formatNTD(getTravelBudget());
      }
      updateAllRetirementCalculations();
    });
  });
  /* =====================================================
     3. 現金｜建立單筆折疊項目
  ===================================================== */
  function createCashItem(itemData) {
    var isNewItem = !itemData || Object.keys(itemData).length === 0;
    var cashList = document.getElementById("cashList");
    if (!cashList) return null;
    itemData = itemData || {};
    var box = document.createElement("div");
    box.className = "asset-item";
    box.innerHTML =
      '<div class="asset-item-header cash-summary">' +
        '<div class="cash-summary-info">' +
          '<strong class="cash-display-name">' +
            '新增現金' +
          '</strong>' +
          '<span class="cash-display-value">NT$ 0</span>' +
        '</div>' +
        '<div class="cash-summary-actions">' +
          '<span class="cash-toggle">▼</span>' +
          '<button type="button" class="delete-asset">刪除</button>' +
        '</div>' +
      '</div>' +
      '<div class="cash-details" style="display:none;">' +
        '<div class="form-grid">' +
          '<label>' +
            '<span>項目名稱</span>' +
            '<input type="text" class="cash-name" placeholder="例如：活儲現金">' +
          '</label>' +
          '<label>' +
            '<span>金額</span>' +
            '<input type="number" class="cash-amount" value="0" min="0" step="1000">' +
            '<small>元</small>' +
          '</label>' +
          '<label>' +
            '<span>幣別</span>' +
            '<select class="cash-currency">' +
              currencyOptions +
            '</select>' +
            '<small class="fx-rate">1 TWD = NT$1</small>' +
          '</label>' +
        '</div>' +
      '</div>';
    cashList.appendChild(box);
    var name = box.querySelector(".cash-name");
    var amount = box.querySelector(".cash-amount");
    var currency = box.querySelector(".cash-currency");
    var displayName = box.querySelector(".cash-display-name");
    var displayValue = box.querySelector(".cash-display-value");
    var toggle = box.querySelector(".cash-toggle");
    var details = box.querySelector(".cash-details");
    if (isNewItem && details) {
      details.style.display = "block";
      if (toggle) toggle.textContent = "▲";
    }
    if (name) name.value = itemData.name || "";
    if (amount) amount.value = itemData.amount || "0";
    if (currency) currency.value = itemData.currency || "TWD";
    function updateSummary() {
      var value = toTWD(
        Number(amount.value) || 0,
        currency.value || "TWD"
      );
      displayName.textContent =
        name.value.trim() !== "" ? name.value.trim() : "新增現金";
      displayValue.textContent = formatNTD(value);
      updateFxRateDisplay();
    }
    name.addEventListener("input", updateSummary);
    amount.addEventListener("input", updateSummary);
    currency.addEventListener("change", updateSummary);
    box.querySelector(".cash-summary").addEventListener("click", function (event) {
      if (event.target.closest(".delete-asset")) return;
      if (details.style.display === "none") {
        details.style.display = "block";
        toggle.textContent = "▲";
      } else {
        details.style.display = "none";
        toggle.textContent = "▼";
      }
    });
    box.querySelector(".delete-asset").addEventListener("click", function () {
      box.remove();
      updateAllRetirementCalculations();
    });
    updateSummary();
    return box;
  }
  var addCashBtn = document.getElementById("addCashBtn");

    if (addCashBtn) {
    addCashBtn.addEventListener("click", function () {
      createCashItem();
      updateAllRetirementCalculations();
    });
  }
  /* =====================================================
     4. 投資｜建立單筆折疊項目
  ===================================================== */
  function createInvestmentItem(itemData) {
    var isNewItem = !itemData || Object.keys(itemData).length === 0;
    var investmentList = document.getElementById("investmentList");
    if (!investmentList) return null;
    itemData = itemData || {};
    var box = document.createElement("div");
    box.className = "asset-item";
    box.innerHTML =
      '<div class="asset-item-header investment-summary">' +
        '<div class="investment-summary-info">' +
          '<strong class="investment-display-name">新增投資</strong>' +
          '<span class="investment-display-value">NT$ 0</span>' +
        '</div>' +
        '<div class="investment-summary-actions">' +
          '<span class="investment-toggle">▼</span>' +
          '<button type="button" class="delete-asset">刪除</button>' +
        '</div>' +
      '</div>' +
      '<div class="investment-details" style="display:none;">' +
        '<div class="form-grid">' +
          '<label>' +
            '<span>股票／ETF 代號</span>' +
            '<input type="text" class="investment-symbol" placeholder="例如：006208">' +
          '</label>' +
          '<label>' +
            '<span>市場</span>' +
            '<select class="investment-market">' +
              '<option value="TW">台股</option>' +
              '<option value="US">美股</option>' +
              '<option value="OTHER">其他</option>' +
            '</select>' +
          '</label>' +
          '<label>' +
            '<span>幣別</span>' +
            '<select class="investment-currency">' +
              currencyOptions +
            '</select>' +
            '<small class="fx-rate">1 TWD = NT$1</small>' +
          '</label>' +
          '<label>' +
            '<span>持有數量</span>' +
            '<input type="number" class="investment-quantity" value="0" min="0" step="0.0001">' +
          '</label>' +
          '<label>' +
            '<span>平均成本</span>' +
            '<input type="number" class="investment-cost" value="0" min="0" step="0.01">' +
          '</label>' +
          '<label>' +
            '<span>目前價格</span>' +
            '<input type="number" class="investment-price" value="0" min="0" step="0.01">' +
          '</label>' +
        '</div>' +
        '<div class="investment-result">' +
          '<div><span>目前市值</span><strong class="market-value">NT$ 0</strong></div>' +
          '<div><span>未實現損益</span><strong class="profit-loss">NT$ 0</strong></div>' +
          '<div><span>報酬率</span><strong class="return-rate">0%</strong></div>' +
        '</div>' +
      '</div>';
    investmentList.appendChild(box);
    var symbol = box.querySelector(".investment-symbol");
    var market = box.querySelector(".investment-market");
    var currency = box.querySelector(".investment-currency");
    var quantity = box.querySelector(".investment-quantity");
    var cost = box.querySelector(".investment-cost");
    var price = box.querySelector(".investment-price");
    var marketValue = box.querySelector(".market-value");
    var profitLoss = box.querySelector(".profit-loss");
    var returnRate = box.querySelector(".return-rate");
    var displayName = box.querySelector(".investment-display-name");
    var displayValue = box.querySelector(".investment-display-value");
    var toggle = box.querySelector(".investment-toggle");
    var details = box.querySelector(".investment-details");
    if (isNewItem && details) {
      details.style.display = "block";
      if (toggle) toggle.textContent = "▲";
    }
    symbol.value = itemData.symbol || "";
    market.value = itemData.market || "TW";
    currency.value = itemData.currency || "TWD";
    quantity.value = itemData.quantity || "0";
    cost.value = itemData.cost || "0";
    price.value = itemData.price || "0";
    function calculateInvestment() {
      var qty = Number(quantity.value) || 0;
      var avgCost = Number(cost.value) || 0;
      var currentPrice = Number(price.value) || 0;
      var totalCost = qty * avgCost;
      var currentValue = qty * currentPrice;
      var profit = currentValue - totalCost;
      var rate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      var currencyCode = currency.value || "TWD";
      var currentValueTWD = toTWD(currentValue, currencyCode);
      var profitTWD = toTWD(profit, currencyCode);
      marketValue.textContent = formatNTD(currentValueTWD);
      profitLoss.textContent = formatNTD(profitTWD);
      returnRate.textContent = rate.toFixed(2) + "%";
      displayName.textContent = symbol.value.trim() !== "" ? symbol.value.trim() : "新增投資";
      displayValue.textContent = formatNTD(currentValueTWD);
      updateFxRateDisplay();
    }
    symbol.addEventListener("input", calculateInvestment);
    quantity.addEventListener("input", calculateInvestment);
    cost.addEventListener("input", calculateInvestment);
    price.addEventListener("input", calculateInvestment);
    market.addEventListener("change", calculateInvestment);
    currency.addEventListener("change", calculateInvestment);
    box.querySelector(".investment-summary").addEventListener("click", function (event) {
      if (event.target.closest(".delete-asset")) return;
      if (details.style.display === "none") {
        details.style.display = "block";
        toggle.textContent = "▲";
      } else {
        details.style.display = "none";
        toggle.textContent = "▼";
      }
    });
    box.querySelector(".delete-asset").addEventListener("click", function () {
      box.remove();
      updateAllRetirementCalculations();
    });
    calculateInvestment();
    return box;
  }
  var addInvestmentBtn = document.getElementById("addInvestmentBtn");
  if (addInvestmentBtn) {
    addInvestmentBtn.addEventListener("click", function () {
      createInvestmentItem();
      updateAllRetirementCalculations();
    });
  }
  /* =====================================================
     5. 定存｜建立單筆折疊項目
  ===================================================== */
  function createDepositItem(itemData) {
    var isNewItem = !itemData || Object.keys(itemData).length === 0;
    var depositList = document.getElementById("depositList");
    if (!depositList) return null;
    itemData = itemData || {};
    var box = document.createElement("div");
    box.className = "asset-item";
    box.innerHTML =
      '<div class="asset-item-header deposit-summary">' +
        '<div class="deposit-summary-info">' +
          '<strong class="deposit-display-name">新增定存</strong>' +
          '<span class="deposit-display-value">NT$ 0</span>' +
        '</div>' +
        '<div class="deposit-summary-actions">' +
          '<span class="deposit-toggle">▼</span>' +
          '<button type="button" class="delete-asset">刪除</button>' +
        '</div>' +
      '</div>' +
      '<div class="deposit-details" style="display:none;">' +
        '<div class="form-grid">' +
          '<label>' +
            '<span>項目名稱</span>' +
            '<input type="text" class="deposit-name" placeholder="例如：台幣定存">' +
          '</label>' +
          '<label>' +
            '<span>本金</span>' +
            '<input type="number" class="deposit-amount" value="0" min="0" step="1000">' +
            '<small>元</small>' +
          '</label>' +
          '<label>' +
            '<span>幣別</span>' +
            '<select class="deposit-currency">' +
              currencyOptions +
            '</select>' +
            '<small class="fx-rate">1 TWD = NT$1</small>' +
          '</label>' +
          '<label>' +
            '<span>年利率</span>' +
            '<input type="number" class="deposit-rate" value="0" min="0" step="0.01">' +
            '<small>%</small>' +
          '</label>' +
        '</div>' +
        '<div class="deposit-result">' +
          '<div><span>本金</span><strong class="deposit-principal">NT$ 0</strong></div>' +
          '<div><span>預估一年利息</span><strong class="deposit-interest">NT$ 0</strong></div>' +
        '</div>' +
      '</div>';
    depositList.appendChild(box);
    var name = box.querySelector(".deposit-name");
    var amount = box.querySelector(".deposit-amount");
    var currency = box.querySelector(".deposit-currency");
    var rate = box.querySelector(".deposit-rate");
    var displayName = box.querySelector(".deposit-display-name");
    var displayValue = box.querySelector(".deposit-display-value");

        var principal = box.querySelector(".deposit-principal");
    var interest = box.querySelector(".deposit-interest");
    var toggle = box.querySelector(".deposit-toggle");
    var details = box.querySelector(".deposit-details");
    if (isNewItem && details) {
      details.style.display = "block";
      if (toggle) toggle.textContent = "▲";
    }
    name.value = itemData.name || "";
    amount.value = itemData.amount || "0";
    currency.value = itemData.currency || "TWD";
    rate.value = itemData.rate || "0";
    function calculateDeposit() {
      var depositAmount = Number(amount.value) || 0;
      var depositRate = Number(rate.value) || 0;
      var currencyCode = currency.value || "TWD";
      var principalTWD = toTWD(depositAmount, currencyCode);
      var interestTWD = toTWD(depositAmount * depositRate / 100, currencyCode);
      displayName.textContent = name.value.trim() !== "" ? name.value.trim() : "新增定存";
      displayValue.textContent = formatNTD(principalTWD);
      principal.textContent = formatNTD(principalTWD);
      interest.textContent = formatNTD(interestTWD);
      updateFxRateDisplay();
    }
    name.addEventListener("input", calculateDeposit);
    amount.addEventListener("input", calculateDeposit);
    rate.addEventListener("input", calculateDeposit);
    currency.addEventListener("change", calculateDeposit);
    box.querySelector(".deposit-summary").addEventListener("click", function (event) {
      if (event.target.closest(".delete-asset")) return;
      if (details.style.display === "none") {
        details.style.display = "block";
        toggle.textContent = "▲";
      } else {
        details.style.display = "none";
        toggle.textContent = "▼";
      }
    });
    box.querySelector(".delete-asset").addEventListener("click", function () {
      box.remove();
      updateAllRetirementCalculations();
    });
    calculateDeposit();
    return box;
  }
  var addDepositBtn = document.getElementById("addDepositBtn");
  if (addDepositBtn) {
    addDepositBtn.addEventListener("click", function () {
      createDepositItem();
      updateAllRetirementCalculations();
    });
  }
  /* =====================================================
     6. 資產計算
  ===================================================== */
  function calculateCashTWD() {
    var total = 0;
    document.querySelectorAll("#cashList .asset-item").forEach(function (item) {
      var amount = item.querySelector(".cash-amount");
      var currency = item.querySelector(".cash-currency");
      if (amount) {
        total += toTWD(
          Number(amount.value) || 0,
          currency ? currency.value : "TWD"
        );
      }
    });
    return total;
  }
  function calculateInvestmentTWD() {
    var total = 0;
    document.querySelectorAll("#investmentList .asset-item").forEach(function (item) {
      var quantity = item.querySelector(".investment-quantity");
      var price = item.querySelector(".investment-price");
      var currency = item.querySelector(".investment-currency");
      if (quantity && price) {
        total += toTWD(
          (Number(quantity.value) || 0) * (Number(price.value) || 0),
          currency ? currency.value : "TWD"
        );
      }
    });
    return total;
  }
  function calculateDepositTWD() {
    var total = 0;
    document.querySelectorAll("#depositList .asset-item").forEach(function (item) {
      var amount = item.querySelector(".deposit-amount");
      var currency = item.querySelector(".deposit-currency");
      if (amount) {
        total += toTWD(
          Number(amount.value) || 0,
          currency ? currency.value : "TWD"
        );
      }
    });
    return total;
  }
  function updateAssetTotals() {
    var cashTotal = calculateCashTWD();
    var investmentTotal = calculateInvestmentTWD();
    var depositTotal = calculateDepositTWD();
    var total = cashTotal + investmentTotal + depositTotal;
    var cashElement = document.getElementById("cashTotal");
    var investmentElement = document.getElementById("investmentTotal");
    var depositElement = document.getElementById("depositTotal");
    var totalElement = document.getElementById("totalAssets");
    if (cashElement) cashElement.textContent = formatNTD(cashTotal);
    if (investmentElement) investmentElement.textContent = formatNTD(investmentTotal);
    if (depositElement) depositElement.textContent = formatNTD(depositTotal);
    if (totalElement) totalElement.textContent = formatNTD(total);
    var cashPercent = total > 0 ? cashTotal / total * 100 : 0;
    var investmentPercent = total > 0 ? investmentTotal / total * 100 : 0;
    var depositPercent = total > 0 ? depositTotal / total * 100 : 0;
    var cashPercentElement = document.getElementById("cashPercent");
    var investmentPercentElement = document.getElementById("investmentPercent");
    var depositPercentElement = document.getElementById("depositPercent");
    if (cashPercentElement) cashPercentElement.textContent = Math.round(cashPercent) + "%";
    if (investmentPercentElement) investmentPercentElement.textContent = Math.round(investmentPercent) + "%";
    if (depositPercentElement) depositPercentElement.textContent = Math.round(depositPercent) + "%";
    var allocationCash = document.getElementById("allocationCash");
    var allocationInvestment = document.getElementById("allocationInvestment");
    var allocationDeposit = document.getElementById("allocationDeposit");
    if (allocationCash) allocationCash.style.width = cashPercent + "%";
    if (allocationInvestment) allocationInvestment.style.width = investmentPercent + "%";
    if (allocationDeposit) allocationDeposit.style.width = depositPercent + "%";
    return total;
  }
  /* =====================================================
     7. 外幣匯率顯示
  ===================================================== */
  function updateFxRateDisplay() {
    document.querySelectorAll(
      ".cash-currency, .investment-currency, .deposit-currency"
    ).forEach(function (select) {
      var currency = select.value || "TWD";
      var rate = fxRates[currency] || 1;
      var rateText = select.parentElement.querySelector(".fx-rate");
      if (!rateText) return;
      if (currency === "TWD") {
        rateText.textContent = "1 TWD = NT$1";
      } else {
        rateText.textContent =
          "1 " + currency + " = NT$" +
          rate.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4
          });
      }
    });
  }
  /* =====================================================
     8. 退休試算共同核心
  ===================================================== */
  function getGoalCurrentAge() {
    return getActiveGoal() === "micro"
      ? getNumber("microCurrentAge")
      : getNumber("currentAge");
  }

  function getPlannedRetirementAge() {
    return getActiveGoal() === "micro"
      ? getNumber("microRetireAge")
      : getNumber("fullRetireAge");
  }

  function getBaseAnnualNeed() {
    var goal = getActiveGoal();
    var travelBudget = getTravelBudget();
    if (goal === "micro") {
      var microExpense = getNumber("microExpense");
      var microIncome = getNumber("microIncome");
      return Math.max(microExpense - microIncome, 0) * 12 + travelBudget;
    }
    return getNumber("monthlyExpense") * 12 + travelBudget;
  }

  function getInflationRate() {
    return Math.max(0, getNumber("inflationRate"));
  }

  function calculateAnnualNeedAtAge(age) {
    var currentAge = getGoalCurrentAge();
    var years = Math.max(0, age - currentAge);
    return getBaseAnnualNeed() * Math.pow(1 + getInflationRate() / 100, years);
  }

  function calculateRetirementTargetAtAge(age) {
    return calculateAnnualNeedAtAge(age) / 0.04;
  }

  function getAssetBalances() {
    return {
      cash: calculateCashTWD(),
      investment: calculateInvestmentTWD(),
      deposit: calculateDepositTWD()
    };
  }

  function getRetirementData() {
    var currentAge = getGoalCurrentAge();
    var plannedRetirementAge = getPlannedRetirementAge();
    var balances = getAssetBalances();
    var currentAssets = balances.cash + balances.investment + balances.deposit;
    var annualNeed = calculateAnnualNeedAtAge(plannedRetirementAge);
    var retirementTarget = annualNeed / 0.04;

    return {
      goal: getActiveGoal(),
      currentAge: currentAge,
      plannedRetirementAge: plannedRetirementAge,
      baseAnnualNeed: getBaseAnnualNeed(),
      annualNeed: annualNeed,
      retirementTarget: retirementTarget,
      currentAssets: currentAssets,
      cashAssets: balances.cash,
      investmentAssets: balances.investment,
      depositAssets: balances.deposit,
      inflationRate: getInflationRate(),
      cashAnnualReturn: getNumber("cashAnnualReturn"),
      depositAnnualReturn: getNumber("depositAnnualReturn"),
      investmentAnnualReturn: getNumber("investmentAnnualReturn"),
      monthlyInvestment: getNumber("monthlyInvestment")
    };
  }

  function updateRetirementDisplay() {
    var data = getRetirementData();
    var annualNeedElement = document.getElementById("annualNeed");
    var targetElement = document.getElementById("retirementTarget");
    var remainingElement = document.getElementById("remainingTarget");
    var progressPercentElement = document.getElementById("progressPercent");
    var progressBar = document.getElementById("progressBar");
    var progressCurrent = document.getElementById("progressCurrent");
    var progressTarget = document.getElementById("progressTarget");
    var retirementAgeElement = document.getElementById("retirementAgeResult");

    if (annualNeedElement) annualNeedElement.textContent = formatNTD(data.annualNeed);
    if (targetElement) targetElement.textContent = formatNTD(data.retirementTarget);

    var remaining = Math.max(data.retirementTarget - data.currentAssets, 0);
    if (remainingElement) {
      remainingElement.textContent =
        data.retirementTarget > 0 && data.currentAssets >= data.retirementTarget
          ? "已達成 🎉"
          : formatNTD(remaining);
    }

    var progress = data.retirementTarget > 0
      ? data.currentAssets / data.retirementTarget * 100
      : 0;
    progress = Math.max(0, Math.min(progress, 100));

    if (progressPercentElement) {
      progressPercentElement.textContent = progress.toFixed(1) + "%";
    }
    if (progressBar) progressBar.style.width = progress + "%";
    if (progressCurrent) progressCurrent.textContent = formatNTD(data.currentAssets);
    if (progressTarget) progressTarget.textContent = formatNTD(data.retirementTarget);
    if (retirementAgeElement) {
      retirementAgeElement.textContent =
        data.plannedRetirementAge > 0
          ? data.plannedRetirementAge.toFixed(1) + " 歲"
          : "尚未設定";
    }
  }

  /* =====================================================
     9. 預計退休年齡
     - 屬於第 05 區的成長假設結果
     - 不再回寫第 04 區
  ===================================================== */
  function calculateRetirementAge() {
    var data = getRetirementData();
    var resultElement = document.getElementById("projectionRetirementAge");
    if (!resultElement) return;

    if (data.currentAssets <= 0 && data.monthlyInvestment <= 0) {
      resultElement.textContent = "尚未達成";
      return;
    }

    var balances = {
      cash: data.cashAssets,
      investment: data.investmentAssets,
      deposit: data.depositAssets
    };

    var maxMonths = 1200;
    for (var month = 0; month <= maxMonths; month++) {
      var age = data.currentAge + month / 12;
      var target = calculateRetirementTargetAtAge(age);

      var total = balances.cash + balances.investment + balances.deposit;
      if (total >= target) {
        resultElement.textContent = age.toFixed(1) + " 歲";
        return;
      }

      if (month === maxMonths) break;

      balances.cash *= 1 + data.cashAnnualReturn / 100 / 12;
      balances.deposit *= 1 + data.depositAnnualReturn / 100 / 12;
      balances.investment =
        balances.investment * (1 + data.investmentAnnualReturn / 100 / 12) +
        data.monthlyInvestment;
    }

    resultElement.textContent = "尚未達成";
  }

  /* =====================================================
     10. 資產成長預估
  ===================================================== */
  function calculateProjection() {
    var data = getRetirementData();
    var years = getNumber("projectionYears");
    var futureAssetsElement = document.getElementById("futureAssets");
    var projectionYearsText = document.getElementById("projectionYearsText");
    var projectionRows = document.getElementById("projectionRows");

    if (!futureAssetsElement || !projectionRows) return;
    projectionRows.innerHTML = "";

    if (years <= 0) {
      futureAssetsElement.textContent = "NT$ 0";
      return;
    }

    var balances = {
      cash: data.cashAssets,
      investment: data.investmentAssets,
      deposit: data.depositAssets
    };

    for (var year = 1; year <= years; year++) {
      for (var month = 1; month <= 12; month++) {
        balances.cash *= 1 + data.cashAnnualReturn / 100 / 12;
        balances.deposit *= 1 + data.depositAnnualReturn / 100 / 12;
        balances.investment =
          balances.investment * (1 + data.investmentAnnualReturn / 100 / 12) +
          data.monthlyInvestment;
      }

      var projectedAssets =
        balances.cash + balances.investment + balances.deposit;
      var gap = Math.max(data.retirementTarget - projectedAssets, 0);

      var row = document.createElement("div");
      row.className = "projection-row";

      var yearText = document.createElement("span");
      yearText.textContent = "第 " + year + " 年";

      var assetText = document.createElement("span");
      assetText.textContent = formatNTD(projectedAssets);

      var gapText = document.createElement("span");
      gapText.textContent =
        data.retirementTarget > 0 && projectedAssets >= data.retirementTarget
          ? "已達成 🎉"
          : formatNTD(gap);

      row.appendChild(yearText);
      row.appendChild(assetText);
      row.appendChild(gapText);
      projectionRows.appendChild(row);
    }

    var futureAssets =
      balances.cash + balances.investment + balances.deposit;
    futureAssetsElement.textContent = formatNTD(futureAssets);

    if (projectionYearsText) {
      projectionYearsText.textContent = years + " 年後預估資產";
    }
  }

  function updateAllRetirementCalculations() {
    updateAssetTotals();
    updateRetirementDisplay();
    calculateRetirementAge();
    calculateProjection();
  }

  /* =====================================================
     11. 統一監聽輸入變更
  ===================================================== */
  document.addEventListener("input", function (event) {
    var target = event.target;
    if (
      target.closest("#cashList") ||
      target.closest("#investmentList") ||
      target.closest("#depositList") ||
      target.id === "currentAge" ||
      target.id === "fullRetireAge" ||
      target.id === "lifeExpectancy" ||
      target.id === "monthlyExpense" ||
      target.id === "microCurrentAge" ||
      target.id === "microRetireAge" ||
      target.id === "microIncome" ||
      target.id === "microExpense" ||
      target.id === "inflationRate" ||
      target.id === "cashAnnualReturn" ||
      target.id === "depositAnnualReturn" ||
      target.id === "investmentAnnualReturn" ||
      target.id === "monthlyInvestment" ||
      target.id === "projectionYears"
    ) {
      updateAllRetirementCalculations();
    }
  });

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (
      target.closest("#cashList") ||
      target.closest("#investmentList") ||
      target.closest("#depositList")
    ) {
      updateFxRateDisplay();
      updateAllRetirementCalculations();
    }
  });

  /* =====================================================
     13. 儲存資料
  ===================================================== */
  function collectBasicData() {
    var data = {};
    var ids = [
      "currentAge",
      "fullRetireAge",
      "lifeExpectancy",
      "monthlyExpense",
      "microCurrentAge",
      "microRetireAge",
      "microIncome",
      "microExpense",
      "inflationRate",
      "cashAnnualReturn",
      "depositAnnualReturn",
      "investmentAnnualReturn",
      "monthlyInvestment",
      "projectionYears"
    ];
    ids.forEach(function (id) {
      var element = document.getElementById(id);
      if (element) data[id] = element.value;
    });
    data.goal = getActiveGoal();
    var lifeButton = document.querySelector("[data-life].active");
    data.life = lifeButton
      ? lifeButton.getAttribute("data-life")
      : "stable";
    return data;
  }
  function collectCashData() {
    var cash = [];
    document.querySelectorAll("#cashList .asset-item").forEach(function (item) {
      var name = item.querySelector(".cash-name");
      var amount = item.querySelector(".cash-amount");
      var currency = item.querySelector(".cash-currency");
      cash.push({
        name: name ? name.value : "",
        amount: amount ? amount.value : "0",
        currency: currency ? currency.value : "TWD"

              });
    });
    return cash;
  }
  function collectInvestmentData() {
    var investment = [];
    document.querySelectorAll("#investmentList .asset-item").forEach(function (item) {
      var symbol = item.querySelector(".investment-symbol");
      var market = item.querySelector(".investment-market");
      var currency = item.querySelector(".investment-currency");
      var quantity = item.querySelector(".investment-quantity");
      var cost = item.querySelector(".investment-cost");
      var price = item.querySelector(".investment-price");
      investment.push({
        symbol: symbol ? symbol.value : "",
        market: market ? market.value : "TW",
        currency: currency ? currency.value : "TWD",
        quantity: quantity ? quantity.value : "0",
        cost: cost ? cost.value : "0",
        price: price ? price.value : "0"
      });
    });
    return investment;
  }
  function collectDepositData() {
    var deposit = [];
    document.querySelectorAll("#depositList .asset-item").forEach(function (item) {
      var name = item.querySelector(".deposit-name");
      var amount = item.querySelector(".deposit-amount");
      var currency = item.querySelector(".deposit-currency");
      var rate = item.querySelector(".deposit-rate");
      deposit.push({
        name: name ? name.value : "",
        amount: amount ? amount.value : "0",
        currency: currency ? currency.value : "TWD",
        rate: rate ? rate.value : "0"
      });
    });
    return deposit;
  }
  function saveRetirementData() {
    var data = collectBasicData();
    data.cash = collectCashData();
    data.investment = collectInvestmentData();
    data.deposit = collectDepositData();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      var errorStatus = document.getElementById("saveStatus");
      if (errorStatus) errorStatus.textContent = "⚠️ 無法儲存，請檢查瀏覽器設定";
      return;
    }
    var saveStatus = document.getElementById("saveStatus");
    if (saveStatus) saveStatus.textContent = "✅ 資料已儲存於目前裝置";
    var topSaveButton = document.getElementById("saveBtn");
    if (topSaveButton) {
      topSaveButton.classList.add("saved");
      topSaveButton.textContent = "✓ 已儲存";
      setTimeout(function () {
        topSaveButton.classList.remove("saved");
        topSaveButton.textContent = "💾 儲存";
      }, 1500);
    }
  }
  /* =====================================================
     14. 載入儲存資料
  ===================================================== */
  function loadRetirementData() {
    var saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return;
    }
    if (!saved) return;
    var data;
    try {
      data = JSON.parse(saved);
    } catch (error) {
      return;
    }
    /* 舊版資料相容：舊版只有 annualReturn，載入後先套用到三類資產，避免舊試算結果突然改變。 */
    if (data.annualReturn !== undefined) {
      if (data.cashAnnualReturn === undefined) data.cashAnnualReturn = data.annualReturn;
      if (data.depositAnnualReturn === undefined) data.depositAnnualReturn = data.annualReturn;
      if (data.investmentAnnualReturn === undefined) data.investmentAnnualReturn = data.annualReturn;
    }
    var ids = [
      "currentAge",
      "fullRetireAge",
      "lifeExpectancy",
      "monthlyExpense",
      "microCurrentAge",
      "microRetireAge",
      "microIncome",
      "microExpense",
      "inflationRate",
      "cashAnnualReturn",
      "depositAnnualReturn",
      "investmentAnnualReturn",
      "monthlyInvestment",
      "projectionYears"
    ];
    ids.forEach(function (id) {
      var element = document.getElementById(id);
      if (element && data[id] !== undefined) element.value = data[id];
    });
    if (data.goal) {
      var goalButton = document.querySelector('[data-goal="' + data.goal + '"]');
      if (goalButton) goalButton.click();
    }
    if (data.life) {
      var lifeButton = document.querySelector('[data-life="' + data.life + '"]');
      if (lifeButton) lifeButton.click();
    }
    var cashList = document.getElementById("cashList");
    var investmentList = document.getElementById("investmentList");
    var depositList = document.getElementById("depositList");
    if (cashList) cashList.innerHTML = "";
    if (investmentList) investmentList.innerHTML = "";
    if (depositList) depositList.innerHTML = "";
    if (Array.isArray(data.cash)) {
      data.cash.forEach(function (itemData) {
        createCashItem(itemData);
      });
    }
    if (Array.isArray(data.investment)) {
      data.investment.forEach(function (itemData) {
        createInvestmentItem(itemData);
      });
    }
    if (Array.isArray(data.deposit)) {
      data.deposit.forEach(function (itemData) {
        createDepositItem(itemData);
      });
    }
    updateFxRateDisplay();
    updateAllRetirementCalculations();
    var saveStatus = document.getElementById("saveStatus");
    if (saveStatus) saveStatus.textContent = "📂 已自動載入上次儲存的資料";
  }
  /* =====================================================
     15. 儲存 / 重設按鈕
  ===================================================== */
  var saveButton = document.getElementById("saveBtn");
  var saveButton2 = document.getElementById("saveBtn2");
  var resetButton = document.getElementById("resetBtn");
  if (saveButton) {
    saveButton.addEventListener("click", saveRetirementData);
  }
  if (saveButton2) {
    saveButton2.addEventListener("click", saveRetirementData);
  }
  if (resetButton) {
    resetButton.addEventListener("click", function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* 無法清除時仍重新載入頁面 */
      }
      location.reload();
    });
  }
  /* =====================================================
     16. 初始畫面
  ===================================================== */
  var initialGoal = document.querySelector("[data-goal].active");
  var initialLife = document.querySelector("[data-life].active");
  if (initialGoal) {
    var initialGoalValue = initialGoal.getAttribute("data-goal");
    var fullSetting = document.getElementById("fullSetting");
    var microSetting = document.getElementById("microSetting");
    if (initialGoalValue === "full") {
      if (fullSetting) fullSetting.classList.remove("hidden");
      if (microSetting) microSetting.classList.add("hidden");
    } else {
      if (fullSetting) fullSetting.classList.add("hidden");
      if (microSetting) microSetting.classList.remove("hidden");
    }
  }
  if (initialLife && selectedLifestyle && travelBudgetElement) {
    var initialLifeValue = initialLife.getAttribute("data-life");
    if (initialLifeValue === "stable") selectedLifestyle.textContent = "🌿 安穩";
    if (initialLifeValue === "happy") selectedLifestyle.textContent = "✈️ 小確幸";
    if (initialLifeValue === "luxury") selectedLifestyle.textContent = "✨ 豪華";
    travelBudgetElement.textContent = formatNTD(getTravelBudget());
  }
  updateFxRateDisplay();
  updateAllRetirementCalculations();
  loadRetirementData();
});