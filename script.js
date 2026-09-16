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

  /* =====================================================
     GA4 互動追蹤
     - 不送出資產金額、薪資、年齡等個人財務數值
     - 只追蹤使用者走到哪個步驟、選了什麼功能、是否儲存
  ===================================================== */
  function trackEvent(eventName, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
    }
  }

  var trackedFields = {};
  // 重計算採手動觸發：輸入時只標記資料變更，不啟動昂貴的退休現金流試算。
  var calculationDirty = true;
  var cashFlowTargetCache = {};
  var calculationRunId = 0;

  function markCalculationDirty() {
    calculationDirty = true;
    var button = document.getElementById("calculateBtn");
    var status = document.getElementById("calculationStatus");
    var wrap = document.querySelector(".calculate-float-wrap");
    if (button) button.classList.add("is-dirty");
    if (wrap) wrap.classList.add("is-dirty");
    if (status) status.textContent = "資料已變更，點擊「試算」更新結果";
  }

  function clearCalculationCache() {
    cashFlowTargetCache = {};
    laborPensionMonthlyCache = {};
    calculationRunId += 1;
  }

  function finishCalculation() {
    calculationDirty = false;
    var button = document.getElementById("calculateBtn");
    var status = document.getElementById("calculationStatus");
    var wrap = document.querySelector(".calculate-float-wrap");
    if (button) button.classList.remove("is-dirty");
    if (wrap) wrap.classList.remove("is-dirty");
    if (status) status.textContent = "已更新試算結果";
  }
  function trackFieldInteraction(target) {
    if (!target || !target.id || trackedFields[target.id]) return;
    trackedFields[target.id] = true;
    trackEvent("field_interaction", { field_id: target.id });
  }

  function setupSectionTracking() {
    if (typeof window.IntersectionObserver !== "function") return;
    var sections = document.querySelectorAll(".card");
    var trackedSections = {};
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
        var heading = entry.target.querySelector("h2");
        var sectionName = heading ? heading.textContent.trim() : "unknown";
        if (trackedSections[sectionName]) return;
        trackedSections[sectionName] = true;
        trackEvent("section_view", { section_name: sectionName });
      });
    }, { threshold: [0.5] });
    sections.forEach(function(section) { observer.observe(section); });
  }

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
  function getActiveRetirementLifestyle() {
    var button = document.querySelector("[data-retirement-life].active");
    return button ? button.getAttribute("data-retirement-life") : "stable";
  }
  function getActiveInheritancePlan() {
    var button = document.querySelector("[data-inheritance].active");
    return button ? button.getAttribute("data-inheritance") : "leave";
  }
  function getTravelBudget() {
    var button = document.querySelector("[data-retirement-life].active");
    if (!button) return 0;
    var life = button.getAttribute("data-retirement-life");
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
      trackEvent("goal_select", { goal: goal });
      var fullSetting = document.getElementById("fullSetting");
      var microSetting = document.getElementById("microSetting");
      if (goal === "full") {
        if (fullSetting) fullSetting.classList.remove("hidden");
        if (microSetting) microSetting.classList.add("hidden");
      } else {
        if (fullSetting) fullSetting.classList.add("hidden");
        if (microSetting) microSetting.classList.remove("hidden");
      }
      markCalculationDirty();
    });
  });
  /* =====================================================
     2. 人生模式｜遺產規劃 / 退休後生活
  ===================================================== */
  var inheritanceButtons = document.querySelectorAll("[data-inheritance]");
  var retirementLifeButtons = document.querySelectorAll("[data-retirement-life]");
  var selectedInheritance = document.getElementById("selectedInheritance");
  var selectedLifestyle = document.getElementById("selectedLifestyle");
  var travelBudgetElement = document.getElementById("travelBudget");

  inheritanceButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      inheritanceButtons.forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");
      var plan = button.getAttribute("data-inheritance");
      trackEvent("inheritance_plan_select", { plan: plan });
      if (selectedInheritance) {
        if (plan === "leave") selectedInheritance.textContent = "🏠 希望留下資產";
        if (plan === "self") selectedInheritance.textContent = "🫰 主要用在自己身上";
        if (plan === "undecided") selectedInheritance.textContent = "🤔 尚未決定";
      }
      markCalculationDirty();
    });
  });

  retirementLifeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      retirementLifeButtons.forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");
      var life = button.getAttribute("data-retirement-life");
      trackEvent("retirement_lifestyle_select", { lifestyle: life });
      if (selectedLifestyle) {
        if (life === "stable") selectedLifestyle.textContent = "🌿 安安穩穩";
        if (life === "happy") selectedLifestyle.textContent = "✈️ 偶爾放鬆";
        if (life === "luxury") selectedLifestyle.textContent = "✨ 肆意享受";
      }
      if (travelBudgetElement) travelBudgetElement.textContent = formatNTD(getTravelBudget());
      markCalculationDirty();
    });
  });
  /* =====================================================
     3. 現金｜建立單筆折疊項目
  ===================================================== */
  function createCashItem(itemData) {
    var cashList = document.getElementById("cashList");
    if (!cashList) return null;
    var isNewItem = !itemData || Object.keys(itemData).length === 0;
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
    if (isNewItem) {
      details.style.display = "block";
      toggle.textContent = "▲";
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
      updateAssetTotals();
      markCalculationDirty();
    });
    updateSummary();
    return box;
  }
  var addCashBtn = document.getElementById("addCashBtn");

    if (addCashBtn) {
    addCashBtn.addEventListener("click", function () {
      trackEvent("add_asset", { asset_type: "cash" });
      createCashItem();
      updateAssetTotals();
      markCalculationDirty();
    });
  }
  /* =====================================================
     4. 投資｜建立單筆折疊項目
  ===================================================== */
  function createInvestmentItem(itemData) {
    var investmentList = document.getElementById("investmentList");
    if (!investmentList) return null;
    var isNewItem = !itemData || Object.keys(itemData).length === 0;
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
    if (isNewItem) {
      details.style.display = "block";
      toggle.textContent = "▲";
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
      updateAssetTotals();
      markCalculationDirty();
    });
    calculateInvestment();
    return box;
  }
  var addInvestmentBtn = document.getElementById("addInvestmentBtn");
  if (addInvestmentBtn) {
    addInvestmentBtn.addEventListener("click", function () {
      trackEvent("add_asset", { asset_type: "investment" });
      createInvestmentItem();
      updateAssetTotals();
      markCalculationDirty();
    });
  }
  /* =====================================================
     5. 定存｜建立單筆折疊項目
  ===================================================== */
  function createDepositItem(itemData) {
    var depositList = document.getElementById("depositList");
    if (!depositList) return null;
    var isNewItem = !itemData || Object.keys(itemData).length === 0;
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
    if (isNewItem) {
      details.style.display = "block";
      toggle.textContent = "▲";
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
      updateAssetTotals();
      markCalculationDirty();
    });
    calculateDeposit();
    return box;
  }
  var addDepositBtn = document.getElementById("addDepositBtn");
  if (addDepositBtn) {
    addDepositBtn.addEventListener("click", function () {
      trackEvent("add_asset", { asset_type: "deposit" });
      createDepositItem();
      updateAssetTotals();
      markCalculationDirty();
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
  function getBaseAnnualExpense() {
    var travelBudget = getTravelBudget();
    if (getActiveGoal() === "micro") {
      return getNumber("microExpense") * 12 + travelBudget;
    }
    return getNumber("monthlyExpense") * 12 + travelBudget;
  }

  function getBaseAnnualNeed() {
    var travelBudget = getTravelBudget();
    if (getActiveGoal() === "micro") {
      return Math.max(getNumber("microExpense") - getNumber("microIncome"), 0) * 12 + travelBudget;
    }
    return getNumber("monthlyExpense") * 12 + travelBudget;
  }
  function getInflationRate() {
    return getNumber("inflationRate");
  }
  function calculateAnnualNeedAtAge(age) {
    // 與退休現金流引擎完全相同：先算通膨後的總支出，再扣除該年可取得的工作／勞退／勞保收入。
    var annualExpense = calculateAnnualExpenseAtAge(age);
    var retirementIncome = getPostRetirementMonthlyIncomeAtAge(age, age) * 12;
    return Math.max(annualExpense - retirementIncome, 0);
  }
  function calculateAnnualExpenseAtAge(age) {
    var currentAge = getGoalCurrentAge();
    var years = Math.max(age - currentAge, 0);
    return getBaseAnnualExpense() * Math.pow(1 + getInflationRate() / 100, years);
  }

  function getInheritancePlan() {
    /* 統一從目前選取的遺產規劃卡片讀取，避免不同函式各自判斷造成模式不同步。 */
    return getActiveInheritancePlan();
  }

  function isSpendDownPlan() {
    return getInheritancePlan() === "self";
  }

  function getProjectedAssetBreakdownAtAge(targetAge) {
    /*
       注意：這裡不能呼叫 getRetirementData()。
       self 模式的退休目標會反過來呼叫本函式，若再取 getRetirementData()
       會形成遞迴，導致切換模式後計算中斷。
    */
    var currentAge = getGoalCurrentAge();
    var projected = {
      cash: calculateCashTWD(),
      deposit: calculateDepositTWD(),
      investment: calculateInvestmentTWD()
    };
    var cashAnnualReturn = getNumber("cashAnnualReturn");
    var depositAnnualReturn = getNumber("depositAnnualReturn");
    var investmentAnnualReturn = getNumber("investmentAnnualReturn");
    var monthlyInvestment = getNumber("monthlyInvestment");
    var months = Math.max(Math.ceil((targetAge - currentAge) * 12), 0);
    for (var month = 0; month < months; month++) {
      projected.cash *= 1 + cashAnnualReturn / 100 / 12;
      projected.deposit *= 1 + depositAnnualReturn / 100 / 12;
      projected.investment = projected.investment * (1 + investmentAnnualReturn / 100 / 12) + monthlyInvestment;
    }
    return projected;
  }

  function getRetirementAnnualReturnAtAge(retirementAge) {
    var projected = getProjectedAssetBreakdownAtAge(retirementAge);
    var total = projected.cash + projected.deposit + projected.investment;
    if (total <= 0) return getNumber("investmentAnnualReturn");
    return (
      projected.cash * getNumber("cashAnnualReturn") +
      projected.deposit * getNumber("depositAnnualReturn") +
      projected.investment * getNumber("investmentAnnualReturn")
    ) / total;
  }

  var laborPensionMonthlyCache = {};

  // 勞退月收入：以「請領年齡當下的專戶餘額」換算規劃用月收入。
  // 完全退休會在設定退休年齡停止提撥；微退休則依設定工作年齡持續提撥。
  function getLaborPensionMonthlyAfterRetirement(age, retirementAge) {
    var claimAge = Math.max(getNumber("laborPensionClaimAge"), 60);
    if (age < claimAge) return 0;

    var currentAge = getGoalCurrentAge();
    var workUntilAge = getNumber("laborInsuranceWorkUntilAge");
    if (getActiveGoal() === "full" && retirementAge != null && isFinite(retirementAge)) {
      workUntilAge = Math.min(workUntilAge, retirementAge);
    }

    var salary = getNumber("laborPensionSalary");
    var employerRate = Math.min(Math.max(getNumber("laborPensionEmployerRate"), 0), 6);
    var selfRate = Math.min(Math.max(getNumber("laborPensionSelfRate"), 0), 6);
    var annualReturn = getNumber("laborPensionReturn");
    var cacheKey = [
      getActiveGoal(), currentAge, claimAge, workUntilAge,
      getNumber("laborPensionBalance"), salary, employerRate, selfRate, annualReturn,
      retirementAge == null ? "" : retirementAge
    ].join("|");
    if (laborPensionMonthlyCache[cacheKey] != null) {
      return laborPensionMonthlyCache[cacheKey];
    }

    var balance = getNumber("laborPensionBalance");
    var monthlyRate = annualReturn / 100 / 12;
    var claimMonths = Math.max(Math.round((claimAge - currentAge) * 12), 0);
    var contributionMonths = Math.max(
      Math.min(Math.round((workUntilAge - currentAge) * 12), claimMonths),
      0
    );

    for (var month = 1; month <= claimMonths; month++) {
      balance *= 1 + monthlyRate;
      if (month <= contributionMonths) {
        balance += salary * (employerRate + selfRate) / 100;
      }
    }
    var monthlyPension = Math.max(balance, 0) * 0.04 / 12;
    laborPensionMonthlyCache[cacheKey] = monthlyPension;
    return monthlyPension;
  }

  function getPostRetirementMonthlyIncomeAtAge(age, retirementAge) {
    var goal = getActiveGoal();
    var salary = goal === "micro" ? getNumber("microIncome") : 0;
    var laborPension = getLaborPensionMonthlyAfterRetirement(age, retirementAge);
    var laborInsurance = getLaborInsuranceMonthlyAtAge(age, retirementAge);
    return salary + laborPension + laborInsurance;
  }

  /* =====================================================
     11. 退休現金流引擎
     =====================================================
     04、05、勞退／勞保全部從這裡取得退休後現金流。

     資產池規則：
     - 退休前：現金／定存／投資各自以自己的年報酬率累積。
     - 退休後：三個資產池仍然分開成長，不再合併成單一報酬率。
     - 每月需要由資產補足的缺口，依「當月三池餘額比例」共同提領。
       這樣不需要額外增加「先花哪一池」的使用者設定，同時保留三池各自報酬率。
     - self 模式只在退休後把「超過最低需求的資產」額外攤提到規劃終點。
  ===================================================== */
  function getRetirementCashFlowInputs(retirementAge) {
    return {
      balances: getProjectedAssetBreakdownAtAge(retirementAge),
      monthsToEnd: Math.max(Math.ceil((getLifeExpectancyAge() - retirementAge) * 12), 0),
      baseAnnualExpense: getBaseAnnualExpense(),
      inflationRate: getInflationRate()
    };
  }

  function getRetirementPoolRates() {
    return {
      cash: getNumber("cashAnnualReturn") / 100 / 12,
      deposit: getNumber("depositAnnualReturn") / 100 / 12,
      investment: getNumber("investmentAnnualReturn") / 100 / 12
    };
  }

  function normalizeRetirementBalances(retirementAge, retirementAssets) {
    if (retirementAssets && typeof retirementAssets === "object") {
      return {
        cash: Math.max(Number(retirementAssets.cash) || 0, 0),
        deposit: Math.max(Number(retirementAssets.deposit) || 0, 0),
        investment: Math.max(Number(retirementAssets.investment) || 0, 0)
      };
    }

    var total = Math.max(Number(retirementAssets) || 0, 0);
    var base = getProjectedAssetBreakdownAtAge(retirementAge);
    var baseTotal = base.cash + base.deposit + base.investment;
    if (baseTotal <= 0 || total <= 0) {
      return { cash: 0, deposit: 0, investment: 0 };
    }
    return {
      cash: total * base.cash / baseTotal,
      deposit: total * base.deposit / baseTotal,
      investment: total * base.investment / baseTotal
    };
  }

  function withdrawFromRetirementPools(pools, amount) {
    var total = pools.cash + pools.deposit + pools.investment;
    if (amount <= 0 || total <= 0) return Math.max(amount, 0);

    var actual = Math.min(amount, total);
    var cashShare = pools.cash / total;
    var depositShare = pools.deposit / total;
    var investmentShare = pools.investment / total;

    pools.cash = Math.max(pools.cash - actual * cashShare, 0);
    pools.deposit = Math.max(pools.deposit - actual * depositShare, 0);
    pools.investment = Math.max(pools.investment - actual * investmentShare, 0);
    return amount - actual;
  }

  function calculateSpendDownExtraMonthlyWithdrawal(retirementAge, retirementAssets, monthsToEnd) {
    var baseTarget = calculateCashFlowTargetAtAge(retirementAge);
    var pools = normalizeRetirementBalances(retirementAge, retirementAssets);
    var initialTotal = pools.cash + pools.deposit + pools.investment;
    var surplus = Math.max(initialTotal - baseTarget, 0);
    if (surplus <= 0 || monthsToEnd <= 0) return 0;

    var low = 0;
    var high = Math.max(surplus / monthsToEnd, 1000);
    while (!simulateRetirementCashFlow(
      retirementAge,
      pools,
      getLifeExpectancyAge(),
      { spendDown: false, extraMonthlyWithdrawal: high }
    ).depleted && high < 100000000) {
      high *= 2;
    }

    for (var i = 0; i < 32; i++) {
      var mid = (low + high) / 2;
      var result = simulateRetirementCashFlow(
        retirementAge,
        pools,
        getLifeExpectancyAge(),
        { spendDown: false, extraMonthlyWithdrawal: mid }
      );
      if (result.depleted) high = mid;
      else low = mid;
    }
    return low;
  }

  function simulateRetirementCashFlow(retirementAge, retirementAssets, endAge, options) {
    options = options || {};
    var pools = normalizeRetirementBalances(retirementAge, retirementAssets);
    var planningEndAge = getLifeExpectancyAge();
    var monthsToEnd = Math.max(Math.ceil((planningEndAge - retirementAge) * 12), 0);
    var monthsToDisplay = Math.max(
      Math.min(Math.ceil((endAge - retirementAge) * 12), monthsToEnd),
      0
    );
    var baseAnnualExpense = getBaseAnnualExpense();
    var inflationRate = getInflationRate();
    var rates = getRetirementPoolRates();
    var snapshots = [];
    var depleted = false;
    var extraMonthlyWithdrawal = 0;

    // 退休當下就是一個有效節點，讓 65 歲退休時的 65 歲資料不會誤抓到 66～85 歲。
    if (monthsToDisplay > 0 || retirementAge <= planningEndAge) {
      snapshots.push({
        age: retirementAge,
        assets: pools.cash + pools.deposit + pools.investment,
        cash: pools.cash,
        deposit: pools.deposit,
        investment: pools.investment,
        withdrawal: 0,
        income: getPostRetirementMonthlyIncomeAtAge(retirementAge, retirementAge),
        annualNeed: calculateAnnualExpenseAtAge(retirementAge)
      });
    }

    if (isSpendDownPlan() && options.spendDown !== false && monthsToEnd > 0) {
      if (isFinite(Number(options.extraMonthlyWithdrawal))) {
        extraMonthlyWithdrawal = Math.max(Number(options.extraMonthlyWithdrawal), 0);
      } else {
        extraMonthlyWithdrawal = calculateSpendDownExtraMonthlyWithdrawal(
          retirementAge,
          pools,
          monthsToEnd
        );
      }
    } else if (isFinite(Number(options.extraMonthlyWithdrawal))) {
      extraMonthlyWithdrawal = Math.max(Number(options.extraMonthlyWithdrawal), 0);
    }

    for (var month = 0; month < monthsToDisplay; month++) {
      pools.cash *= 1 + rates.cash;
      pools.deposit *= 1 + rates.deposit;
      pools.investment *= 1 + rates.investment;

      // 通膨從「現在」起算：退休第一個月已經包含退休前累積的通膨，
      // 之後再按退休後經過的月份持續增加。
      var currentAge = getGoalCurrentAge();
      var years = Math.max(retirementAge - currentAge, 0) + month / 12;
      var annualExpense = baseAnnualExpense * Math.pow(1 + inflationRate / 100, years);
      var monthlyExpense = annualExpense / 12;
      var monthlyIncome = getPostRetirementMonthlyIncomeAtAge(
        retirementAge + month / 12,
        retirementAge
      );
      var baseWithdrawal = Math.max(monthlyExpense - monthlyIncome, 0);
      var withdrawal = baseWithdrawal + extraMonthlyWithdrawal;
      var shortfall = withdrawFromRetirementPools(pools, withdrawal);
      if (shortfall > 0.01) {
        depleted = true;
        pools.cash = 0;
        pools.deposit = 0;
        pools.investment = 0;
      }

      if ((month + 1) % 12 === 0 || month === monthsToDisplay - 1) {
        snapshots.push({
          age: retirementAge + (month + 1) / 12,
          assets: pools.cash + pools.deposit + pools.investment,
          cash: pools.cash,
          deposit: pools.deposit,
          investment: pools.investment,
          withdrawal: withdrawal,
          income: monthlyIncome,
          annualNeed: annualExpense
        });
      }

      if (depleted) break;
    }

    return {
      assets: pools.cash + pools.deposit + pools.investment,
      cash: pools.cash,
      deposit: pools.deposit,
      investment: pools.investment,
      snapshots: snapshots,
      annualReturn: getRetirementAnnualReturnAtAge(retirementAge),
      depleted: depleted
    };
  }

  // 以同一套月度現金流逐步找出「退休當下最低需要的資產」。
  // 這取代原本單純 annualNeed / 4% 的算法，因此退休後可領的勞退／勞保會直接降低需求。
  function calculateCashFlowTargetAtAge(retirementAge) {
    var cacheKey = String(Math.round(retirementAge * 100) / 100);
    if (Object.prototype.hasOwnProperty.call(cashFlowTargetCache, cacheKey)) {
      return cashFlowTargetCache[cacheKey];
    }
    var inputs = getRetirementCashFlowInputs(retirementAge);
    if (inputs.monthsToEnd <= 0) {
      cashFlowTargetCache[cacheKey] = 0;
      return 0;
    }

    var base = inputs.balances;
    var baseTotal = base.cash + base.deposit + base.investment;
    if (baseTotal <= 0) {
      base = { cash: 0, deposit: 0, investment: 1 };
      baseTotal = 1;
    }

    // 若退休後保障收入已足以支應全部生活費，資產端最低需求為0。
    var zeroCheck = simulateRetirementCashFlow(retirementAge, 0, getLifeExpectancyAge(), { spendDown: false });
    if (!zeroCheck.depleted) {
      cashFlowTargetCache[cacheKey] = 0;
      return 0;
    }

    function buildPools(total) {
      return {
        cash: total * base.cash / baseTotal,
        deposit: total * base.deposit / baseTotal,
        investment: total * base.investment / baseTotal
      };
    }

    var low = 0;
    var high = Math.max(inputs.baseAnnualExpense * 5, 1000000);
    while (simulateRetirementCashFlow(
      retirementAge,
      buildPools(high),
      getLifeExpectancyAge(),
      { spendDown: false }
    ).depleted && high < 1000000000000) {
      high *= 2;
    }

    for (var i = 0; i < 32; i++) {
      var mid = (low + high) / 2;
      var result = simulateRetirementCashFlow(
        retirementAge,
        buildPools(mid),
        getLifeExpectancyAge(),
        { spendDown: false }
      );
      if (result.depleted) low = mid;
      else high = mid;
    }
    var target = Math.max(high, 0);
    cashFlowTargetCache[cacheKey] = target;
    return target;
  }

  function calculateRetirementTargetAtAge(age) {
    return calculateCashFlowTargetAtAge(age);
  }

  function getAssetBalances() {
    return {
      cash: calculateCashTWD(),
      investment: calculateInvestmentTWD(),
      deposit: calculateDepositTWD()
    };
  }
  function getRetirementData() {
    var balances = getAssetBalances();
    var currentAssets = balances.cash + balances.investment + balances.deposit;
    var plannedAge = getPlannedRetirementAge();
    var annualNeed = calculateAnnualNeedAtAge(plannedAge);
    var retirementTarget = calculateRetirementTargetAtAge(plannedAge);
    return {
      goal: getActiveGoal(),
      annualNeed: annualNeed,
      retirementTarget: retirementTarget,
      currentAssets: currentAssets,
      currentAge: getGoalCurrentAge(),
      plannedRetirementAge: plannedAge,
      inflationRate: getInflationRate(),
      balances: balances,
      monthlyInvestment: getNumber("monthlyInvestment"),
      cashAnnualReturn: getNumber("cashAnnualReturn"),
      depositAnnualReturn: getNumber("depositAnnualReturn"),
      investmentAnnualReturn: getNumber("investmentAnnualReturn"),
      inheritancePlan: getInheritancePlan()
    };
  }
  function calculateAnnualNeed() {
    var element = document.getElementById("annualNeed");
    var data = getRetirementData();
    if (element) element.textContent = formatNTD(data.annualNeed);
  }
  /* =====================================================
     9. 退休目標 / 達成率
  ===================================================== */
  function updateRetirementDisplay() {
    var data = getRetirementData();
    var annualNeedElement = document.getElementById("annualNeed");
    var targetElement = document.getElementById("retirementTarget");
    var remainingElement = document.getElementById("remainingTarget");
    var progressPercentElement = document.getElementById("progressPercent");
    var progressBar = document.getElementById("progressBar");
    var progressCurrent = document.getElementById("progressCurrent");
    var progressTarget = document.getElementById("progressTarget");
    var ageElement = document.getElementById("retirementAgeResult");
    if (annualNeedElement) annualNeedElement.textContent = formatNTD(data.annualNeed);
    if (targetElement) targetElement.textContent = formatNTD(data.retirementTarget);

    // 「目前還差」改為比較退休當下的預估資產與退休當下的需求，避免把今天的資產直接
    // 與多年後、已經含通膨與退休保障的目標混在一起。
    var retirementBreakdown = getAccumulatedAssetBreakdownAtAge(data.plannedRetirementAge);
    var projectedAtRetirement = retirementBreakdown.cash + retirementBreakdown.deposit + retirementBreakdown.investment;
    var remaining = Math.max(data.retirementTarget - projectedAtRetirement, 0);
    if (remainingElement) {
      remainingElement.textContent = projectedAtRetirement >= data.retirementTarget ? "已達成 🎉" : formatNTD(remaining);
    }
    var progress = data.retirementTarget > 0 ? projectedAtRetirement / data.retirementTarget * 100 : 0;
    progress = Math.max(0, Math.min(progress, 100));
    if (progressPercentElement) progressPercentElement.textContent = progress.toFixed(1) + "%";
    if (progressBar) progressBar.style.width = progress + "%";
    if (progressCurrent) progressCurrent.textContent = formatNTD(data.currentAssets);
    if (progressTarget) progressTarget.textContent = formatNTD(data.retirementTarget);
    if (ageElement) ageElement.textContent = data.plannedRetirementAge > 0 ? data.plannedRetirementAge + " 歲" : "尚未設定";
  }
  /* =====================================================
     10. 依第 05 區假設估算達成退休目標年齡
  ===================================================== */
  function calculateRetirementAge() {
    var data = getRetirementData();
    var resultElement = document.getElementById("projectionRetirementAge");
    if (!resultElement) return null;

    var currentTarget = calculateRetirementTargetAtAge(data.currentAge);
    if (currentTarget <= 0 || data.currentAssets >= currentTarget) {
      resultElement.textContent = data.currentAge.toFixed(1) + " 歲";
      return data.currentAge;
    }

    var projected = {
      cash: data.balances.cash,
      deposit: data.balances.deposit,
      investment: data.balances.investment
    };
    var estimatedAge = null;

    // 只以「年」尋找達標點；退休後詳細月度現金流仍由 05 引擎精算。
    // 這可避免每輸入一次資料，就對 1200 個月份各自重新做一次 32 次二分搜尋。
    for (var year = 1; year <= 100; year++) {
      for (var month = 0; month < 12; month++) {
        projected.cash *= 1 + data.cashAnnualReturn / 100 / 12;
        projected.deposit *= 1 + data.depositAnnualReturn / 100 / 12;
        projected.investment = projected.investment * (1 + data.investmentAnnualReturn / 100 / 12) + data.monthlyInvestment;
      }
      var age = data.currentAge + year;
      var total = projected.cash + projected.deposit + projected.investment;
      if (total >= calculateRetirementTargetAtAge(age)) {
        estimatedAge = age;
        break;
      }
    }

    resultElement.textContent = estimatedAge === null ? "尚未達成" : estimatedAge.toFixed(0) + " 歲";
    return estimatedAge;
  }
  /* =====================================================
     11. 年齡資產軌跡
  ===================================================== */
  function getLifeExpectancyAge() {
    var input = document.getElementById("lifeExpectancy");
    var currentAge = getGoalCurrentAge();
    var value = input ? Number(input.value) : 85;
    if (!isFinite(value)) value = 85;
    value = Math.round(value);
    value = Math.max(currentAge + 1, Math.min(value, 100));
    return value;
  }

  function getProjectionEndAge() {
    var currentAge = getGoalCurrentAge();
    var input = document.getElementById("projectionEndAge");
    var value = input ? Number(input.value) : 65;
    if (!isFinite(value)) value = 65;
    value = Math.round(value);
    var maxAge = getLifeExpectancyAge();
    value = Math.max(currentAge, Math.min(value, maxAge));
    if (input) {
      input.min = currentAge;
      input.max = maxAge;
    }
    return value;
  }

  function getLaborPensionBalanceAtAge(age, retirementAge) {
    var currentAge = getGoalCurrentAge();
    var claimAge = Math.max(getNumber("laborPensionClaimAge"), 60);
    var balance = getNumber("laborPensionBalance");
    var salary = getNumber("laborPensionSalary");
    var employerRate = Math.min(Math.max(getNumber("laborPensionEmployerRate"), 0), 6);
    var selfRate = Math.min(Math.max(getNumber("laborPensionSelfRate"), 0), 6);
    var annualReturn = getNumber("laborPensionReturn");
    var workUntilAge = getNumber("laborInsuranceWorkUntilAge");
    if (getActiveGoal() === "full" && retirementAge != null && isFinite(retirementAge)) {
      workUntilAge = Math.min(workUntilAge, retirementAge);
    }
    var targetAge = Math.max(age, currentAge);
    var months = Math.max(Math.round((targetAge - currentAge) * 12), 0);
    var contributionMonths = Math.max(Math.min(Math.round((workUntilAge - currentAge) * 12), months), 0);
    var monthlyRate = annualReturn / 100 / 12;
    for (var month = 1; month <= months; month++) {
      balance *= 1 + monthlyRate;
      if (month <= contributionMonths) {
        balance += salary * (employerRate + selfRate) / 100;
      }
    }
    return {
      balance: balance,
      available: targetAge >= claimAge
    };
  }

  function getLaborInsuranceMonthlyAtAge(age, retirementAge) {
    var currentAge = getGoalCurrentAge();
    var insuranceClaimAge = Math.max(getNumber("laborInsuranceClaimAge"), 60);
    if (age < insuranceClaimAge) return 0;
    var insuranceYears = getNumber("laborInsuranceYears");
    var insuranceSalary = getNumber("laborInsuranceSalary");
    var insuranceWorkUntilAge = getNumber("laborInsuranceWorkUntilAge");
    var workEnd = insuranceWorkUntilAge;
    if (getActiveGoal() === "full" && retirementAge != null && isFinite(retirementAge)) {
      workEnd = Math.min(insuranceWorkUntilAge, retirementAge);
    }
    var accruedFutureYears = Math.max(workEnd - currentAge, 0);
    var totalInsuranceYears = Math.min(60, insuranceYears + accruedFutureYears);
    var monthlyA = totalInsuranceYears * insuranceSalary * 0.00775 + 3000;
    var monthlyB = totalInsuranceYears * insuranceSalary * 0.0155;
    var monthlyBenefit = Math.max(monthlyA, monthlyB);
    var adjustmentYears = insuranceClaimAge - 65;
    if (adjustmentYears < 0) monthlyBenefit *= 1 - Math.min(Math.abs(adjustmentYears), 5) * 0.04;
    if (adjustmentYears > 0) monthlyBenefit *= 1 + Math.min(adjustmentYears, 5) * 0.04;
    return monthlyBenefit;
  }

  function getMonthlyAvailableAtAge(age, projectedAssets, retirementAge) {
    var goal = getActiveGoal();
    var salary = goal === "micro" ? getNumber("microIncome") : 0;
    var laborPensionMonthly = getLaborPensionMonthlyAfterRetirement(age, retirementAge);
    var laborInsuranceMonthly = getLaborInsuranceMonthlyAtAge(age, retirementAge);
    var protection = laborPensionMonthly + laborInsuranceMonthly;
    var fourPercent = projectedAssets * 0.04 / 12;
    var isRetirementPhase = retirementAge != null && age >= retirementAge;
    var planningWithdrawal = isRetirementPhase
      ? Math.max(calculateAnnualExpenseAtAge(age) / 12 - salary - protection, 0)
      : 0;
    var total = salary + planningWithdrawal + protection;
    return {
      salary: salary,
      fourPercent: fourPercent,
      planningWithdrawal: planningWithdrawal,
      protection: protection,
      total: total,
      laborPensionMonthly: laborPensionMonthly,
      laborInsuranceMonthly: laborInsuranceMonthly
    };
  }

  function getAccumulatedAssetBreakdownAtAge(targetAge) {
    var currentAge = getGoalCurrentAge();
    var projected = {
      cash: calculateCashTWD(),
      deposit: calculateDepositTWD(),
      investment: calculateInvestmentTWD()
    };
    var months = Math.max(Math.round((targetAge - currentAge) * 12), 0);
    var cashRate = getNumber("cashAnnualReturn") / 100 / 12;
    var depositRate = getNumber("depositAnnualReturn") / 100 / 12;
    var investmentRate = getNumber("investmentAnnualReturn") / 100 / 12;
    var monthlyInvestment = getNumber("monthlyInvestment");
    for (var month = 0; month < months; month++) {
      projected.cash *= 1 + cashRate;
      projected.deposit *= 1 + depositRate;
      projected.investment = projected.investment * (1 + investmentRate) + monthlyInvestment;
    }
    return projected;
  }

  function getAnnuityFactor(monthlyRate, months) {
    if (months <= 0) return 0;
    if (Math.abs(monthlyRate) < 0.0000000001) return months;
    return (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
  }

  function calculateAssetsRemainingAtLifeExpectancy(retirementAge, retirementAssets) {
    var endAge = getLifeExpectancyAge();
    if (!isFinite(retirementAge)) return 0;
    if (retirementAge >= endAge) {
      var pools = normalizeRetirementBalances(retirementAge, retirementAssets);
      return pools.cash + pools.deposit + pools.investment;
    }
    return simulateRetirementCashFlow(retirementAge, retirementAssets, endAge).assets;
  }

  function updateAge85Remaining(retirementAge) {
    var element = document.getElementById("age85Remaining");
    if (!element) return;
    if (!isFinite(retirementAge)) {
      element.textContent = "尚無法估算";
      return;
    }
    var projected = getAccumulatedAssetBreakdownAtAge(retirementAge);
    var remaining = calculateAssetsRemainingAtLifeExpectancy(
      retirementAge,
      projected
    );
    element.textContent = formatNTD(remaining);
  }

  function calculateProjection() {
    var data = getRetirementData();
    var endAge = getProjectionEndAge();
    var futureAssetsElement = document.getElementById("futureAssets");
    var targetElement = document.getElementById("projectionRetirementTarget");
    var projectionRows = document.getElementById("projectionRows");
    if (!projectionRows) return;
    projectionRows.innerHTML = "";
    if (targetElement) targetElement.textContent = formatNTD(data.retirementTarget);

    var retirementAge = Math.max(data.currentAge, getPlannedRetirementAge());
    var currentAge = data.currentAge;
    var projected = {
      cash: data.balances.cash,
      deposit: data.balances.deposit,
      investment: data.balances.investment
    };
    var currentTarget = calculateRetirementTargetAtAge(currentAge);
    var currentAvailable = getMonthlyAvailableAtAge(currentAge, data.currentAssets, retirementAge);
    appendProjectionRow(currentAge, data.currentAssets, currentTarget, currentAvailable, false);

    // 退休前先完整累積到退休當下，之後把三個資產池交給同一個退休現金流引擎。
    var assetsAtRetirement = null;
    var retirementSimulation = null;
    var lastAssets = data.currentAssets;

    if (retirementAge <= endAge) {
      var retirementBreakdown = getAccumulatedAssetBreakdownAtAge(retirementAge);
      assetsAtRetirement = retirementBreakdown;
      retirementSimulation = simulateRetirementCashFlow(
        retirementAge,
        retirementBreakdown,
        endAge
      );
    }

    for (var age = currentAge + 1; age <= endAge; age++) {
      var isRetired = age >= Math.ceil(retirementAge);
      var projectedAssets;
      var snapshot = null;

      if (!isRetired) {
        for (var month = 0; month < 12; month++) {
          projected.cash *= 1 + data.cashAnnualReturn / 100 / 12;
          projected.deposit *= 1 + data.depositAnnualReturn / 100 / 12;
          projected.investment *= 1 + data.investmentAnnualReturn / 100 / 12;
          projected.investment += data.monthlyInvestment;
        }
        projectedAssets = projected.cash + projected.deposit + projected.investment;
      } else {
        // 從同一個退休模擬結果取該年快照；三池已在引擎內各自成長與提領。
        if (retirementSimulation) {
          for (var i = 0; i < retirementSimulation.snapshots.length; i++) {
            var candidate = retirementSimulation.snapshots[i];
            if (Math.abs(candidate.age - age) < 0.0001) {
              snapshot = candidate;
              break;
            }
          }
          if (snapshot) {
            projectedAssets = snapshot.assets;
          } else {
            var lastSnapshot = retirementSimulation.snapshots[retirementSimulation.snapshots.length - 1];
            projectedAssets = lastSnapshot ? lastSnapshot.assets : 0;
          }
        } else {
          projectedAssets = 0;
        }
      }

      lastAssets = projectedAssets;
      // 年齡軌跡的「退休達成率」統一比較第 04 區目前設定的退休目標。
      // 不再把「假設現在才退休」的剩餘年限目標拿來比較，避免資產已經不足時，
      // 因為剩餘規劃年限變短而在高齡突然顯示「已達成」。
      var trajectoryTarget = data.retirementTarget;
      var available = getMonthlyAvailableAtAge(age, projectedAssets, retirementAge);
      appendProjectionRow(age, projectedAssets, trajectoryTarget, available, isRetired);
    }

    if (futureAssetsElement) futureAssetsElement.textContent = formatNTD(lastAssets);
    if (isFinite(retirementAge)) updateAge85Remaining(retirementAge);
    else {
      var age85Element = document.getElementById("age85Remaining");
      if (age85Element) age85Element.textContent = "尚無法估算";
    }

    var noteElement = document.getElementById("calculationNoteText");
    if (noteElement) {
      var lifeAge = getLifeExpectancyAge();
      noteElement.textContent = isSpendDownPlan()
        ? "04、05 與勞退／勞保共用同一套月度現金流；退休後現金、定存、投資仍分開計算各自報酬率，再依當期比例支應生活費。此模式會把超過最低需求的資產逐步用到 " + lifeAge + " 歲。"
        : "04、05 與勞退／勞保共用同一套月度現金流；退休後現金、定存、投資仍分開計算各自報酬率，再依當期比例支應生活費，並規劃至 " + lifeAge + " 歲。";
    }
  }

  function appendProjectionRow(age, assets, target, available, isRetired) {
    var projectionRows = document.getElementById("projectionRows");
    if (!projectionRows) return;
    var row = document.createElement("div");
    row.className = "projection-row projection-row-clickable";
    row.setAttribute("data-age", age);

    var ageText = document.createElement("span");
    var laborPensionStartAge = Math.max(getNumber("laborPensionClaimAge"), 60);
    // 年齡欄只顯示年齡，退休前／退休後的狀態放在展開明細中呈現，避免畫面資訊過載。
    ageText.textContent = age + " 歲";
    if (age >= laborPensionStartAge) {
      ageText.classList.add("labor-age-start");
    }
    var assetText = document.createElement("span");
    assetText.textContent = formatNTD(assets);
    var completionText = document.createElement("span");
    var completion = target > 0 ? assets / target * 100 : 0;
    completionText.textContent = completion >= 100 ? "已達成" : completion.toFixed(0) + "%";
    var availableText = document.createElement("span");
    availableText.textContent = formatNTD(available.total);
    var triangle = document.createElement("span");
    triangle.className = "projection-expand-triangle";
    triangle.setAttribute("aria-hidden", "true");
    triangle.textContent = "▾";
    availableText.appendChild(triangle);

    row.appendChild(ageText);
    row.appendChild(assetText);
    row.appendChild(completionText);
    row.appendChild(availableText);

    var detail = document.createElement("div");
    detail.className = "projection-detail hidden";
    var title = document.createElement("strong");
    title.textContent = age + " 歲｜每月可動用資產";
    detail.appendChild(title);

    var lines = [];
    if (getActiveGoal() === "micro") {
      lines.push({ text: formatNTD(available.salary) + "（本薪／半退休收入）" });
    }
    if (isRetired) {
      if (isSpendDownPlan()) {
        lines.push({ text: formatNTD(available.planningWithdrawal) + "（資產規劃提領）" });
      } else {
        lines.push({ text: formatNTD(available.planningWithdrawal) + "（資產補足生活缺口）" });
      }
    } else {
      lines.push({ text: "退休前持續累積資產" });
    }
    lines.push({ text: formatNTD(available.protection) + "（勞退／勞保）", labor: true });
    lines.push({ text: "＝ " + formatNTD(available.total) + "／月" });
    lines.forEach(function (item) {
      var line = document.createElement("div");
      line.textContent = item.text;
      if (item.labor) line.classList.add("projection-labor-detail");
      detail.appendChild(line);
    });
    if (available.protection > 0) {
      var note = document.createElement("small");
      note.textContent = "勞退以 4% 規劃換算；勞保依目前設定的預估年資與投保薪資試算。";
      detail.appendChild(note);
    }

    projectionRows.appendChild(row);
    projectionRows.appendChild(detail);
    row.addEventListener("click", function () {
      detail.classList.toggle("hidden");
      row.classList.toggle("is-expanded", !detail.classList.contains("hidden"));
    });
  }

  /* =====================================================
     11.5 勞退／勞保
  ===================================================== */
  function calculateLaborPension() {
    var currentAge = getGoalCurrentAge();
    var plannedRetirementAge = getPlannedRetirementAge();
    var claimAge = Math.max(getNumber("laborPensionClaimAge"), 60);
    var pensionBalanceData = getLaborPensionBalanceAtAge(claimAge, plannedRetirementAge);
    var balance = Math.max(pensionBalanceData.balance, 0);

    var pensionElement = document.getElementById("laborPensionProjected");
    if (pensionElement) pensionElement.textContent = formatNTD(balance);

    var insuranceMonthly = getLaborInsuranceMonthlyAtAge(
      Math.max(getNumber("laborInsuranceClaimAge"), 60),
      plannedRetirementAge
    );
    var insuranceElement = document.getElementById("laborInsuranceMonthly");
    if (insuranceElement) insuranceElement.textContent = formatNTD(insuranceMonthly);

    var protectionElement = document.getElementById("retirementProtectionMonthly");
    var protectionMonthly = balance * 0.04 / 12 + insuranceMonthly;
    if (protectionElement) protectionElement.textContent = formatNTD(protectionMonthly);
  }
  function updateCalculationNote() {
    var element = document.getElementById("calculationNoteText");
    if (!element) return;
    var lifeAge = getLifeExpectancyAge();
    element.textContent = "04、05 與勞退／勞保共用同一套月度現金流；退休後現金、定存、投資仍分開計算各自報酬率，並規劃至 " + lifeAge + " 歲。";
  }

  function updateAllRetirementCalculations() {
    updateAssetTotals();
    calculateAnnualNeed();
    updateRetirementDisplay();
    calculateLaborPension();
    calculateRetirementAge();
    calculateProjection();
  }
  /* =====================================================
     12. 統一監聽輸入變更
     =====================================================
     輸入期間不執行完整現金流引擎，避免每個按鍵都重跑 04＋05＋勞退／勞保。
     使用者按下右側浮動「試算」後才一次更新全部結果。
  ===================================================== */
  document.addEventListener("input", function (event) {
    var target = event.target;
    trackFieldInteraction(target);
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
      target.id === "laborPensionBalance" ||
      target.id === "laborPensionSalary" ||
      target.id === "laborPensionEmployerRate" ||
      target.id === "laborPensionSelfRate" ||
      target.id === "laborPensionReturn" ||
      target.id === "laborPensionClaimAge" ||
      target.id === "laborInsuranceYears" ||
      target.id === "laborInsuranceSalary" ||
      target.id === "laborInsuranceWorkUntilAge" ||
      target.id === "laborInsuranceClaimAge" ||
      target.id === "projectionEndAge"
    ) {
      if (target.closest("#cashList") || target.closest("#investmentList") || target.closest("#depositList")) {
        updateAssetTotals();
      }
      markCalculationDirty();
    }
  });

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (target.id === "projectionEndAge") {
      trackEvent("projection_range_change");
      var currentAge = getGoalCurrentAge();
      var value = Math.round(Number(target.value));
      if (!isFinite(value)) value = currentAge;
      var maxAge = getLifeExpectancyAge();
      value = Math.max(currentAge, Math.min(value, maxAge));
      target.value = value;
      markCalculationDirty();
      return;
    }
    if (target.closest("#cashList") || target.closest("#investmentList") || target.closest("#depositList")) {
      updateFxRateDisplay();
      updateAssetTotals();
      markCalculationDirty();
    }
  });

  var calculateButton = document.getElementById("calculateBtn");
  if (calculateButton) {
    calculateButton.addEventListener("click", function () {
      if (calculationDirty) {
        clearCalculationCache();
        updateAllRetirementCalculations();
        finishCalculation();
      }
    });
  }
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
      "projectionEndAge",
      "laborPensionBalance",
      "laborPensionSalary",
      "laborPensionEmployerRate",
      "laborPensionSelfRate",
      "laborPensionReturn",
      "laborPensionClaimAge",
      "laborInsuranceYears",
      "laborInsuranceSalary",
      "laborInsuranceWorkUntilAge",
      "laborInsuranceClaimAge"
    ];
    ids.forEach(function (id) {
      var element = document.getElementById(id);
      if (element) data[id] = element.value;
    });
    data.goal = getActiveGoal();
    data.inheritancePlan = getActiveInheritancePlan();
    data.retirementLifestyle = getActiveRetirementLifestyle();
    /* 保留舊版 life 欄位，方便既有資料相容 */
    data.life = data.retirementLifestyle;
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
    if (data.annualReturn !== undefined) {
      if (data.cashAnnualReturn === undefined) data.cashAnnualReturn = data.annualReturn;
      if (data.depositAnnualReturn === undefined) data.depositAnnualReturn = data.annualReturn;
      if (data.investmentAnnualReturn === undefined) data.investmentAnnualReturn = data.annualReturn;
    }
    if (data.projectionEndAge === undefined && data.projectionYears !== undefined) {
      var loadedCurrentAge = Number(data.currentAge || data.microCurrentAge || 33);
      data.projectionEndAge = loadedCurrentAge + Number(data.projectionYears || 5);
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
      "projectionEndAge",
      "laborPensionBalance",
      "laborPensionSalary",
      "laborPensionEmployerRate",
      "laborPensionSelfRate",
      "laborPensionReturn",
      "laborPensionClaimAge",
      "laborInsuranceYears",
      "laborInsuranceSalary",
      "laborInsuranceWorkUntilAge",
      "laborInsuranceClaimAge"
    ];
    ids.forEach(function (id) {
      var element = document.getElementById(id);
      if (element && data[id] !== undefined) element.value = data[id];
    });
    if (data.goal) {
      var goalButton = document.querySelector('[data-goal="' + data.goal + '"]');
      if (goalButton) goalButton.click();
    }
    var savedInheritance = data.inheritancePlan || "leave";
    var inheritanceButton = document.querySelector('[data-inheritance="' + savedInheritance + '"]');
    if (inheritanceButton) inheritanceButton.click();

    var savedLifestyle = data.retirementLifestyle || data.life || "stable";
    var lifestyleButton = document.querySelector('[data-retirement-life="' + savedLifestyle + '"]');
    if (lifestyleButton) lifestyleButton.click();
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
    saveButton.addEventListener("click", function () {
      trackEvent("save_plan", { location: "header" });
      saveRetirementData();
    });
  }
  if (saveButton2) {
    saveButton2.addEventListener("click", function () {
      trackEvent("save_plan", { location: "bottom" });
      saveRetirementData();
    });
  }
  if (resetButton) {
    resetButton.addEventListener("click", function () {
      trackEvent("reset_plan");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* 無法清除時仍重新載入頁面 */
      }
      location.reload();
    });
  }
  setupSectionTracking();

  /* =====================================================
     16. 初始畫面
  ===================================================== */
  var initialGoal = document.querySelector("[data-goal].active");
  var initialInheritance = document.querySelector("[data-inheritance].active");
  var initialRetirementLife = document.querySelector("[data-retirement-life].active");
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
  if (initialInheritance && selectedInheritance) {
    var initialInheritanceValue = initialInheritance.getAttribute("data-inheritance");
    if (initialInheritanceValue === "leave") selectedInheritance.textContent = "🏠 希望留下資產";
    if (initialInheritanceValue === "self") selectedInheritance.textContent = "🫰 主要用在自己身上";
    if (initialInheritanceValue === "undecided") selectedInheritance.textContent = "🤔 尚未決定";
  }
  if (initialRetirementLife && selectedLifestyle && travelBudgetElement) {
    var initialLifeValue = initialRetirementLife.getAttribute("data-retirement-life");
    if (initialLifeValue === "stable") selectedLifestyle.textContent = "🌿 安安穩穩";
    if (initialLifeValue === "happy") selectedLifestyle.textContent = "✈️ 偶爾放鬆";
    if (initialLifeValue === "luxury") selectedLifestyle.textContent = "✨ 肆意享受";
    travelBudgetElement.textContent = formatNTD(getTravelBudget());
  }
  updateFxRateDisplay();
  clearCalculationCache();
  updateAllRetirementCalculations();
  finishCalculation();
  loadRetirementData();
});