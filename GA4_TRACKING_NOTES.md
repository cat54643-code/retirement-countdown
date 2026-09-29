# 夠用就好｜GA4 Tracking v4.10.4

本版以 v4.10.3 為基礎，保留既有試算與 UI/UX 邏輯，強化 GA4 使用行為追蹤。

## 主要追蹤
- site_visit：新訪客 / 回訪訪客
- campaign_context：UTM campaign context（不送財務數值）
- section_view：各區塊瀏覽
- scroll_depth：25 / 50 / 75 / 90% 滾動深度
- form_start：開始填寫
- field_interaction：首次互動欄位與區塊
- goal_select / inheritance_plan_select / retirement_lifestyle_select
- asset_input_mode_select / add_asset
- calculation_start / calculation_complete / calculation_error
- result_view / comparison_view / next_step_click
- calculation_abandon：離開前未完成試算，包含最後互動欄位、最後區塊、停留時間
- save_plan / reset_plan

## UTM
網址上的 `utm_source`、`utm_medium`、`utm_campaign`、`utm_content`、`utm_term` 會被讀取並保存在目前 session，並附加到自訂事件參數：
- campaign_source
- campaign_medium
- campaign_name
- campaign_content
- campaign_term

## 隱私
不會將資產金額、薪資、年齡等個人財務數值送進 GA4。
