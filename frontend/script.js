const API_BASE = "http://127.0.0.1:8000";

const LABELS = {
  "hg/ha_yield": "Yield (hg/ha)",
  "average_rain_fall_mm_per_year": "Average Rainfall (mm/year)",
  "pesticides_tonnes": "Pesticides (tonnes)",
  "avg_temp": "Average Temperature (°C)",
  "Area": "Area / Country",
  "Item": "Crop",
  "Year": "Year",
};

const PAGE_META = {
  overview: { title: "Overview", desc: "Key indicators from the crop yield dataset." },
  explorer: { title: "Data Explorer", desc: "Search, filter, and inspect the underlying records." },
  analysis: { title: "Yield Analysis", desc: "Explore how yield relates to crop, area, time, and climate variables." },
  prediction: { title: "Prediction", desc: "Estimate crop yield for a given area, crop, year, and climate inputs." },
  comparison: { title: "Model Comparison", desc: "Compare Linear Regression, Random Forest, and XGBoost on held-out test data." },
  importance: { title: "Feature Importance", desc: "Which encoded features most influence the tree-based models' predictions." },
  benchmark: { title: "Research Benchmark", desc: "How this implementation relates to previously published work on the same dataset." },
  insights: { title: "Insights", desc: "Data-driven observations. Correlational, not causal, language is used throughout." },
};

let state = {
  areas: [],
  crops: [],
  currentPage: "overview",
};

// ---------------- Theme ----------------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("lightBtn").classList.toggle("active", theme === "light");
  document.getElementById("darkBtn").classList.toggle("active", theme === "dark");
  localStorage.setItem("say-theme", theme);
}
(function initTheme() {
  const saved = localStorage.getItem("say-theme") ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(saved);
})();
document.getElementById("lightBtn").addEventListener("click", () => applyTheme("light"));
document.getElementById("darkBtn").addEventListener("click", () => applyTheme("dark"));

function plotlyTemplate() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Poppins, sans-serif", color: dark ? "#eaf1e9" : "#1e2a22", size: 12 },
    margin: { t: 30, l: 50, r: 20, b: 45 },
    colorway: ["#2f8f4e", "#4cae6a", "#b8860b", "#5b6b60", "#1f6b38"],
  };
}

// ---------------- API helper ----------------
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}
async function apiPost(path, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Request failed (${res.status})`);
  return body;
}

async function checkApiStatus() {
  const el = document.getElementById("apiStatus");
  try {
    await apiGet("/");
    el.textContent = "API connected";
    el.className = "api-status ok";
    return true;
  } catch (e) {
    el.textContent = "API unreachable — start the backend";
    el.className = "api-status error";
    return false;
  }
}

// ---------------- Navigation ----------------
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => navigateTo(item.dataset.page));
});

function navigateTo(page) {
  state.currentPage = page;
  document.querySelectorAll(".nav-item").forEach((i) => i.classList.toggle("active", i.dataset.page === page));
  document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));
  document.getElementById(`page-${page}`).style.display = "block";
  document.getElementById("pageTitle").textContent = PAGE_META[page].title;
  document.getElementById("pageDesc").textContent = PAGE_META[page].desc;
  renderPage(page);
}

function renderPage(page) {
  const fns = {
    overview: renderOverview,
    explorer: renderExplorer,
    analysis: renderAnalysis,
    prediction: renderPrediction,
    comparison: renderComparison,
    importance: renderImportance,
    benchmark: renderBenchmark,
    insights: renderInsights,
  };
  fns[page]();
}

function loadingHTML(msg = "Loading…") {
  return `<div class="loading-state">${msg}</div>`;
}
function errorHTML(msg) {
  return `<div class="error-state">⚠ ${msg}</div>`;
}
function emptyHTML(msg = "No data available for this selection.") {
  return `<div class="empty-state">${msg}</div>`;
}

// ================= OVERVIEW =================
async function renderOverview() {
  const el = document.getElementById("page-overview");
  el.innerHTML = loadingHTML("Fetching dataset summary…");
  try {
    const summary = await apiGet("/api/summary");
    const analysis = await apiGet("/api/crop-analysis");

    el.innerHTML = `
      <div class="grid grid-4 section">
        ${kpiCard("Total Records", summary.total_records.toLocaleString())}
        ${kpiCard("Areas / Countries", summary.num_areas)}
        ${kpiCard("Crops Tracked", summary.num_crops)}
        ${kpiCard("Year Range", `${summary.year_min}–${summary.year_max}`)}
        ${kpiCard("Average Yield", `${Math.round(summary.average_yield).toLocaleString()} hg/ha`)}
        ${kpiCard("Best Performing Crop", summary.best_performing_crop)}
      </div>
      <div class="grid grid-2 section">
        <div class="card"><div class="section-title">Average Yield by Crop</div><div id="chartYieldByCrop" class="chart-box"></div></div>
        <div class="card"><div class="section-title">Yield Trend Over Years</div><div id="chartYieldTrend" class="chart-box"></div></div>
      </div>
      <div class="grid grid-2 section">
        <div class="card"><div class="section-title">Yield Distribution</div><div id="chartYieldDist" class="chart-box"></div></div>
        <div class="card">
          <div class="section-title">Auto-generated Insight</div>
          <div id="overviewInsight" style="font-size:13px; line-height:1.7; color:var(--text-muted);"></div>
        </div>
      </div>
    `;

    Plotly.newPlot("chartYieldByCrop", [{
      x: analysis.yield_by_crop.map((d) => d.Item),
      y: analysis.yield_by_crop.map((d) => d["hg/ha_yield"]),
      type: "bar", marker: { color: "#2f8f4e" },
    }], { ...plotlyTemplate(), yaxis: { title: LABELS["hg/ha_yield"] } }, { responsive: true, displayModeBar: false });

    const trend = await apiGet("/api/yield-trends");
    Plotly.newPlot("chartYieldTrend", [{
      x: trend.trend.map((d) => d.Year),
      y: trend.trend.map((d) => d["hg/ha_yield"]),
      type: "scatter", mode: "lines+markers", line: { color: "#2f8f4e" },
    }], { ...plotlyTemplate(), xaxis: { title: "Year" }, yaxis: { title: LABELS["hg/ha_yield"] } }, { responsive: true, displayModeBar: false });

    Plotly.newPlot("chartYieldDist", [{
      x: analysis.yield_distribution, type: "histogram", marker: { color: "#4cae6a" },
    }], { ...plotlyTemplate(), xaxis: { title: LABELS["hg/ha_yield"] } }, { responsive: true, displayModeBar: false });

    const topCrop = analysis.top_crops[0];
    const bottomArea = analysis.bottom_areas[analysis.bottom_areas.length - 1];
    document.getElementById("overviewInsight").innerHTML = `
      Across ${summary.total_records.toLocaleString()} records spanning
      ${summary.year_min}–${summary.year_max}, <b>${topCrop.Item}</b> shows the highest average yield
      at approximately ${Math.round(topCrop["hg/ha_yield"]).toLocaleString()} hg/ha, historically observed
      in this dataset. Yield varies substantially by area — see the Yield Analysis and Insights pages
      for area-level and climate-related patterns.
    `;
  } catch (e) {
    el.innerHTML = errorHTML(e.message);
  }
}

function kpiCard(label, value, sub = "") {
  return `<div class="card kpi-card">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
  </div>`;
}

// ================= DATA EXPLORER =================
let explorerPage = 1;
async function renderExplorer() {
  const el = document.getElementById("page-explorer");
  if (!state.areas.length) {
    try {
      state.areas = (await apiGet("/api/areas")).areas;
      state.crops = (await apiGet("/api/crops")).crops;
    } catch (e) { /* handled below */ }
  }
  el.innerHTML = `
    <div class="card section">
      <div class="filters-bar">
        <div class="field"><label>Search</label><input type="text" id="expSearch" placeholder="area or crop..." /></div>
        <div class="field"><label>Crop</label>${selectHTML("expCrop", state.crops, "All crops")}</div>
        <div class="field"><label>Area</label>${selectHTML("expArea", state.areas, "All areas")}</div>
        <div class="field"><label>Year min</label><input type="number" id="expYearMin" placeholder="e.g. 1995" /></div>
        <div class="field"><label>Year max</label><input type="number" id="expYearMax" placeholder="e.g. 2013" /></div>
        <div class="field" style="justify-content:flex-end;"><button class="primary" id="expApply">Apply Filters</button></div>
      </div>
      <div id="expStats" style="font-size:12.5px; color:var(--text-muted); margin-bottom:10px;"></div>
      <div id="expTableWrap">${loadingHTML()}</div>
    </div>
  `;
  document.getElementById("expApply").addEventListener("click", () => { explorerPage = 1; loadExplorerData(); });
  loadExplorerData();
}

function selectHTML(id, options, placeholder) {
  return `<select id="${id}"><option value="">${placeholder}</option>${options.map((o) => `<option value="${o}">${o}</option>`).join("")}</select>`;
}

async function loadExplorerData() {
  const wrap = document.getElementById("expTableWrap");
  wrap.innerHTML = loadingHTML("Fetching records…");
  const params = new URLSearchParams();
  const search = document.getElementById("expSearch").value.trim();
  const crop = document.getElementById("expCrop").value;
  const area = document.getElementById("expArea").value;
  const yearMin = document.getElementById("expYearMin").value;
  const yearMax = document.getElementById("expYearMax").value;
  if (search) params.set("search", search);
  if (crop) params.set("item", crop);
  if (area) params.set("area", area);
  if (yearMin) params.set("year_min", yearMin);
  if (yearMax) params.set("year_max", yearMax);
  params.set("page", explorerPage);
  params.set("page_size", 20);

  try {
    const data = await apiGet(`/api/data?${params.toString()}`);
    document.getElementById("expStats").innerHTML = data.total === 0 ? "" : `
      ${data.total.toLocaleString()} matching records ·
      avg yield ${Math.round(data.stats.avg_yield).toLocaleString()} hg/ha ·
      avg rainfall ${data.stats.avg_rainfall} mm/yr ·
      avg temp ${data.stats.avg_temp}°C
    `;
    if (data.total === 0) { wrap.innerHTML = emptyHTML("No records match these filters."); return; }

    const totalPages = Math.ceil(data.total / data.page_size);
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Area</th><th>Crop</th><th>Year</th><th>Yield (hg/ha)</th><th>Rainfall (mm/yr)</th><th>Pesticides (t)</th><th>Avg Temp (°C)</th></tr></thead>
        <tbody>
          ${data.records.map((r) => `<tr>
            <td>${r.Area}</td><td>${r.Item}</td><td>${r.Year}</td>
            <td>${Math.round(r["hg/ha_yield"]).toLocaleString()}</td>
            <td>${r.average_rain_fall_mm_per_year}</td>
            <td>${r.pesticides_tonnes}</td>
            <td>${r.avg_temp}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="pagination">
        <button id="prevPage" ${explorerPage <= 1 ? "disabled" : ""}>← Prev</button>
        <span>Page ${data.page} of ${totalPages}</span>
        <button id="nextPage" ${explorerPage >= totalPages ? "disabled" : ""}>Next →</button>
      </div>
    `;
    document.getElementById("prevPage")?.addEventListener("click", () => { explorerPage--; loadExplorerData(); });
    document.getElementById("nextPage")?.addEventListener("click", () => { explorerPage++; loadExplorerData(); });
  } catch (e) {
    wrap.innerHTML = errorHTML(e.message);
  }
}

// ================= YIELD ANALYSIS =================
async function renderAnalysis() {
  const el = document.getElementById("page-analysis");
  if (!state.areas.length) {
    try {
      state.areas = (await apiGet("/api/areas")).areas;
      state.crops = (await apiGet("/api/crops")).crops;
    } catch (e) {}
  }
  el.innerHTML = `
    <div class="card section">
      <div class="filters-bar">
        <div class="field"><label>Crop</label>${selectHTML("anCrop", state.crops, "All crops")}</div>
        <div class="field"><label>Area</label>${selectHTML("anArea", state.areas, "All areas")}</div>
        <div class="field"><label>Year min</label><input type="number" id="anYearMin" /></div>
        <div class="field"><label>Year max</label><input type="number" id="anYearMax" /></div>
        <div class="field" style="justify-content:flex-end;"><button class="primary" id="anApply">Apply Filters</button></div>
      </div>
    </div>
    <div id="anCharts">${loadingHTML()}</div>
  `;
  document.getElementById("anApply").addEventListener("click", loadAnalysis);
  loadAnalysis();
}

async function loadAnalysis() {
  const wrap = document.getElementById("anCharts");
  wrap.innerHTML = loadingHTML("Crunching charts…");
  const params = new URLSearchParams();
  const crop = document.getElementById("anCrop").value;
  const area = document.getElementById("anArea").value;
  const yearMin = document.getElementById("anYearMin").value;
  const yearMax = document.getElementById("anYearMax").value;
  if (crop) params.set("item", crop);
  if (area) params.set("area", area);
  if (yearMin) params.set("year_min", yearMin);
  if (yearMax) params.set("year_max", yearMax);

  try {
    const [analysis, trend] = await Promise.all([
      apiGet(`/api/crop-analysis?${params.toString()}`),
      apiGet(`/api/yield-trends?${crop ? `item=${encodeURIComponent(crop)}&` : ""}${area ? `area=${encodeURIComponent(area)}` : ""}`),
    ]);

    if (!analysis.yield_by_crop.length) { wrap.innerHTML = emptyHTML(); return; }

    wrap.innerHTML = `
      <div class="grid grid-2 section">
        <div class="card"><div class="section-title">Yield by Crop</div><div id="ayCrop" class="chart-box small"></div></div>
        <div class="card"><div class="section-title">Yield by Area (Top 20)</div><div id="ayArea" class="chart-box small"></div></div>
      </div>
      <div class="card section"><div class="section-title">Yield Trend Over Time</div><div id="ayTrend" class="chart-box"></div></div>
      <div class="grid grid-3 section">
        <div class="card"><div class="section-title">Rainfall vs Yield</div><div id="ayRain" class="chart-box small"></div></div>
        <div class="card"><div class="section-title">Temperature vs Yield</div><div id="ayTemp" class="chart-box small"></div></div>
        <div class="card"><div class="section-title">Pesticides vs Yield</div><div id="ayPest" class="chart-box small"></div></div>
      </div>
      <div class="card section"><div class="section-title">Correlation Heatmap</div><div id="ayCorr" class="chart-box"></div></div>
    `;

    Plotly.newPlot("ayCrop", [{ x: analysis.yield_by_crop.map(d=>d.Item), y: analysis.yield_by_crop.map(d=>d["hg/ha_yield"]), type: "bar", marker:{color:"#2f8f4e"} }], plotlyTemplate(), {responsive:true, displayModeBar:false});
    Plotly.newPlot("ayArea", [{ x: analysis.yield_by_area.map(d=>d.Area), y: analysis.yield_by_area.map(d=>d["hg/ha_yield"]), type: "bar", marker:{color:"#4cae6a"} }], plotlyTemplate(), {responsive:true, displayModeBar:false});
    Plotly.newPlot("ayTrend", [{ x: trend.trend.map(d=>d.Year), y: trend.trend.map(d=>d["hg/ha_yield"]), type:"scatter", mode:"lines+markers", line:{color:"#2f8f4e"} }], plotlyTemplate(), {responsive:true, displayModeBar:false});
    Plotly.newPlot("ayRain", [{ x: analysis.rainfall_vs_yield.map(d=>d.x), y: analysis.rainfall_vs_yield.map(d=>d.y), mode:"markers", type:"scatter", marker:{color:"#2f8f4e", size:5, opacity:0.6} }], {...plotlyTemplate(), xaxis:{title:LABELS.average_rain_fall_mm_per_year}, yaxis:{title:"Yield"}}, {responsive:true, displayModeBar:false});
    Plotly.newPlot("ayTemp", [{ x: analysis.temp_vs_yield.map(d=>d.x), y: analysis.temp_vs_yield.map(d=>d.y), mode:"markers", type:"scatter", marker:{color:"#b8860b", size:5, opacity:0.6} }], {...plotlyTemplate(), xaxis:{title:LABELS.avg_temp}, yaxis:{title:"Yield"}}, {responsive:true, displayModeBar:false});
    Plotly.newPlot("ayPest", [{ x: analysis.pesticides_vs_yield.map(d=>d.x), y: analysis.pesticides_vs_yield.map(d=>d.y), mode:"markers", type:"scatter", marker:{color:"#5b6b60", size:5, opacity:0.6} }], {...plotlyTemplate(), xaxis:{title:LABELS.pesticides_tonnes}, yaxis:{title:"Yield"}}, {responsive:true, displayModeBar:false});

    Plotly.newPlot("ayCorr", [{
      z: analysis.correlation_matrix.matrix, x: analysis.correlation_matrix.labels, y: analysis.correlation_matrix.labels,
      type: "heatmap", colorscale: [[0,"#c0392b"],[0.5,"#f5f7f4"],[1,"#2f8f4e"]], zmin:-1, zmax:1,
    }], plotlyTemplate(), {responsive:true, displayModeBar:false});
  } catch (e) {
    wrap.innerHTML = errorHTML(e.message);
  }
}

// ================= PREDICTION =================
async function renderPrediction() {
  const el = document.getElementById("page-prediction");
  if (!state.areas.length) {
    try {
      state.areas = (await apiGet("/api/areas")).areas;
      state.crops = (await apiGet("/api/crops")).crops;
    } catch (e) {}
  }
  el.innerHTML = `
    <div class="predict-layout">
      <div class="card">
        <div class="section-title">Crop Yield Prediction</div>
        <div class="grid grid-2" style="gap:14px;">
          <div class="field"><label>Area / Country</label>${selectHTML("predArea", state.areas, "Select area")}</div>
          <div class="field"><label>Crop</label>${selectHTML("predCrop", state.crops, "Select crop")}</div>
          <div class="field"><label>Year</label><input type="number" id="predYear" value="2012" /></div>
          <div class="field"><label>Average Rainfall (mm/yr)</label><input type="number" id="predRain" value="1000" /></div>
          <div class="field"><label>Pesticides (tonnes)</label><input type="number" id="predPest" value="1500" /></div>
          <div class="field"><label>Average Temperature (°C)</label><input type="number" id="predTemp" value="22" /></div>
        </div>
        <div style="margin-top:16px;"><button class="primary" id="predictBtn">Predict Yield</button></div>
        <div id="predError" style="margin-top:10px;"></div>
      </div>
      <div class="card predict-result" id="predResult">
        <div class="label">Prediction will appear here</div>
      </div>
    </div>
  `;
  document.getElementById("predictBtn").addEventListener("click", runPrediction);
}

async function runPrediction() {
  const errEl = document.getElementById("predError");
  const resultEl = document.getElementById("predResult");
  errEl.innerHTML = "";
  const area = document.getElementById("predArea").value;
  const item = document.getElementById("predCrop").value;
  const year = parseInt(document.getElementById("predYear").value, 10);
  const rainfall = parseFloat(document.getElementById("predRain").value);
  const pesticides = parseFloat(document.getElementById("predPest").value);
  const temp = parseFloat(document.getElementById("predTemp").value);

  if (!area || !item) { errEl.innerHTML = errorHTML("Please select both an area and a crop."); return; }
  if ([year, rainfall, pesticides, temp].some((v) => Number.isNaN(v))) { errEl.innerHTML = errorHTML("Please enter valid numeric values."); return; }

  resultEl.innerHTML = loadingHTML("Running model…");
  try {
    const res = await apiPost("/api/predict", { area, item, year, average_rainfall: rainfall, pesticides, avg_temp: temp });
    resultEl.innerHTML = `
      <div class="label">Predicted Yield</div>
      <div class="value">${Math.round(res.predicted_yield).toLocaleString()} <span style="font-size:16px;">${res.unit}</span></div>
      <div class="model-badge">Model: ${res.model}</div>
      <div class="input-summary-list">
        <div><span>Area</span><span>${res.input_summary.area}</span></div>
        <div><span>Crop</span><span>${res.input_summary.item}</span></div>
        <div><span>Year</span><span>${res.input_summary.year}</span></div>
        <div><span>Rainfall</span><span>${res.input_summary.average_rainfall} mm/yr</span></div>
        <div><span>Pesticides</span><span>${res.input_summary.pesticides} t</span></div>
        <div><span>Avg Temp</span><span>${res.input_summary.avg_temp} °C</span></div>
      </div>
    `;
  } catch (e) {
    resultEl.innerHTML = `<div class="label">No prediction</div>`;
    errEl.innerHTML = errorHTML(e.message);
  }
}

// ================= MODEL COMPARISON =================
async function renderComparison() {
  const el = document.getElementById("page-comparison");
  el.innerHTML = loadingHTML("Loading model metrics…");
  try {
    const data = await apiGet("/api/model-metrics");
    const metrics = data.metrics.metrics;
    const best = data.metrics.best_model;
    const names = Object.keys(metrics);

    el.innerHTML = `
      <div class="card section">
        <div class="section-title">Test-set Metrics ${bestBadge(best)}</div>
        <table>
          <thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>R²</th></tr></thead>
          <tbody>
            ${names.map((n) => `<tr>
              <td>${n} ${n === best ? '<span class="badge-best">BEST</span>' : ""}</td>
              <td>${metrics[n].test.MAE.toLocaleString()}</td>
              <td>${metrics[n].test.RMSE.toLocaleString()}</td>
              <td>${metrics[n].test.R2}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <p style="font-size:12px; color:var(--text-muted); margin-top:10px;">
          Selection criterion: ${data.metrics.selection_criterion}
        </p>
      </div>
      <div class="grid grid-2 section">
        <div class="card"><div class="section-title">RMSE Comparison</div><div id="cmpRMSE" class="chart-box small"></div></div>
        <div class="card"><div class="section-title">R² Comparison</div><div id="cmpR2" class="chart-box small"></div></div>
      </div>
      <div class="card section">
        <div class="section-title">Actual vs Predicted — ${best}</div>
        <div id="cmpScatter" class="chart-box"></div>
      </div>
      <div class="card section">
        <div class="section-title">Residuals — ${best}</div>
        <div id="cmpResid" class="chart-box small"></div>
      </div>
    `;

    Plotly.newPlot("cmpRMSE", [{ x: names, y: names.map(n=>metrics[n].test.RMSE), type:"bar", marker:{color:"#2f8f4e"} }], plotlyTemplate(), {responsive:true, displayModeBar:false});
    Plotly.newPlot("cmpR2", [{ x: names, y: names.map(n=>metrics[n].test.R2), type:"bar", marker:{color:"#4cae6a"} }], {...plotlyTemplate(), yaxis:{range:[0,1]}}, {responsive:true, displayModeBar:false});

    const sample = data.predictions_sample[best];
    Plotly.newPlot("cmpScatter", [
      { x: sample.actual, y: sample.predicted, mode:"markers", type:"scatter", name:"Predictions", marker:{color:"#2f8f4e", size:6, opacity:0.6} },
      { x: [Math.min(...sample.actual), Math.max(...sample.actual)], y: [Math.min(...sample.actual), Math.max(...sample.actual)], mode:"lines", name:"Ideal", line:{color:"#b8860b", dash:"dash"} },
    ], {...plotlyTemplate(), xaxis:{title:"Actual Yield"}, yaxis:{title:"Predicted Yield"}}, {responsive:true, displayModeBar:false});

    const residuals = sample.actual.map((a, i) => a - sample.predicted[i]);
    Plotly.newPlot("cmpResid", [{ x: residuals, type:"histogram", marker:{color:"#5b6b60"} }], {...plotlyTemplate(), xaxis:{title:"Residual (Actual - Predicted)"}}, {responsive:true, displayModeBar:false});
  } catch (e) {
    el.innerHTML = errorHTML(e.message);
  }
}

function bestBadge(best) { return `<span class="badge-best">Best: ${best}</span>`; }

// ================= FEATURE IMPORTANCE =================
async function renderImportance() {
  const el = document.getElementById("page-importance");
  el.innerHTML = loadingHTML("Loading feature importance…");
  try {
    const data = await apiGet("/api/feature-importance");
    const models = Object.keys(data);
    if (!models.length) { el.innerHTML = emptyHTML("No tree-based model importance available."); return; }

    el.innerHTML = `
      <div class="card section">
        <p style="font-size:12.5px; color:var(--text-muted);">
          Area and Crop are one-hot encoded (one binary column per category), so importance is shown
          per encoded category — e.g. <code>Item_Maize</code> is the model's learned importance of
          "crop is Maize", not a raw numerical measurement.
        </p>
      </div>
      <div class="grid grid-2 section">
        ${models.map((m) => `<div class="card"><div class="section-title">${m} — Top Features</div><div id="fi_${m.replace(/\s/g,'')}" class="chart-box"></div></div>`).join("")}
      </div>
    `;
    models.forEach((m) => {
      const rows = data[m].slice(0, 15).reverse();
      Plotly.newPlot(`fi_${m.replace(/\s/g,'')}`, [{
        x: rows.map((r) => r.importance), y: rows.map((r) => r.feature), type: "bar", orientation: "h",
        marker: { color: "#2f8f4e" },
      }], plotlyTemplate(), { responsive: true, displayModeBar: false });
    });
  } catch (e) {
    el.innerHTML = errorHTML(e.message);
  }
}

// ================= RESEARCH BENCHMARK =================
async function renderBenchmark() {
  const el = document.getElementById("page-benchmark");
  el.innerHTML = loadingHTML("Loading our results for comparison…");
  try {
    const data = await apiGet("/api/model-metrics");
    const metrics = data.metrics.metrics;
    const best = data.metrics.best_model;

    el.innerHTML = `
      <div class="card section">
        <div class="section-title">Dataset & Published Research</div>
        <p style="font-size:13px; line-height:1.7;">
          This project uses the same <b>Patel / Kaggle "Crop Yield Prediction Dataset"</b>
          (<code>yield_df.csv</code>) used in the published research below. Our implementation
          independently trains and evaluates selected regression models using our own preprocessing
          and validation setup. Published results and our results should only be compared directly
          when the experimental methodology is comparable.
        </p>
        <ul style="font-size:13px; line-height:1.9;">
          <li><b>Published paper 1:</b> "Forecasting Crop Yield Anomalies on Panel Data via Spatially Demeaned Ensembles" — Springer, 2026 —
            <a href="https://link.springer.com/article/10.1007/s13253-026-00743-8" target="_blank">link</a></li>
          <li><b>Published paper 2:</b> Scientific Reports, 2025 —
            <a href="https://www.nature.com/articles/s41598-025-03935-3" target="_blank">link</a></li>
          <li><b>Reference implementation:</b> <a href="https://github.com/pabodaR/crop-yield-prediction" target="_blank">github.com/pabodaR/crop-yield-prediction</a>
            (reports Random Forest test R² ≈ 0.986, XGBoost test R² ≈ 0.986 on their own train/test split of the same raw dataset — see limitations below).</li>
        </ul>
      </div>

      <div class="card section">
        <div class="section-title">Published Research vs Our Implementation</div>
        <table class="benchmark-table">
          <thead><tr><th></th><th>Published Research</th><th>Our Implementation</th></tr></thead>
          <tbody>
            <tr><td><b>Dataset</b></td><td>Patel/Kaggle Crop Yield Prediction Dataset (yield_df.csv)</td><td>Same dataset structure (Area, Item, Year, yield, rainfall, pesticides, temperature)*</td></tr>
            <tr><td><b>Methodology</b></td><td>Varies by paper (e.g. spatially demeaned panel-data ensembles)</td><td>Standard train/test split (80/20), one-hot encoding for Area &amp; Item, scaling only for Linear Regression</td></tr>
            <tr><td><b>Models</b></td><td>Varies by paper</td><td>Linear Regression, Random Forest, XGBoost</td></tr>
            <tr><td><b>Evaluation</b></td><td>Varies by paper (often RMSE / R²)</td><td>MAE, RMSE, R² on held-out test set</td></tr>
            <tr><td><b>Results</b></td><td><span class="tag-not-comparable">Not directly comparable</span> — exact published metrics were not reproduced numerically here</td>
              <td>${names_metrics_row(metrics)}</td></tr>
            <tr><td><b>Limitations</b></td><td colspan="2">Different random splits, preprocessing choices, feature engineering, and (in some papers) fundamentally different modeling approaches (e.g. panel-data / spatial demeaning) mean metric values are not apples-to-apples even on the same raw dataset. <span class="tag-not-comparable">Not directly comparable</span></td></tr>
          </tbody>
        </table>
        <p style="font-size:11.5px; color:var(--text-muted); margin-top:10px;">
          * This build uses a structurally-identical placeholder dataset because Kaggle was not reachable from the
          build environment — see README for the one manual step to swap in the real yield_df.csv.
        </p>
      </div>

      <div class="card">
        <div class="section-title">Our Best Model</div>
        <p style="font-size:13px;">Best model by lowest test RMSE: <b>${best}</b></p>
        <table>
          <thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>R²</th></tr></thead>
          <tbody>${Object.keys(metrics).map((n) => `<tr><td>${n}</td><td>${metrics[n].test.MAE}</td><td>${metrics[n].test.RMSE}</td><td>${metrics[n].test.R2}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  } catch (e) {
    el.innerHTML = errorHTML(e.message);
  }
}
function names_metrics_row(metrics) {
  return Object.keys(metrics).map((n) => `${n}: R²=${metrics[n].test.R2}`).join("<br/>");
}

// ================= INSIGHTS =================
async function renderInsights() {
  const el = document.getElementById("page-insights");
  el.innerHTML = loadingHTML("Generating insights…");
  try {
    const [analysis, fi] = await Promise.all([apiGet("/api/crop-analysis"), apiGet("/api/feature-importance")]);
    const topCrop = analysis.top_crops[0];
    const bottomCrop = analysis.bottom_crops[analysis.bottom_crops.length - 1];
    const topArea = analysis.top_areas[0];
    const bottomArea = analysis.bottom_areas[analysis.bottom_areas.length - 1];
    const rainCorr = analysis.correlation_matrix.matrix[1][0];
    const tempCorr = analysis.correlation_matrix.matrix[3][0];
    const pestCorr = analysis.correlation_matrix.matrix[2][0];

    const bestModel = Object.keys(fi)[0];
    const topFeature = bestModel ? fi[bestModel][0] : null;

    el.innerHTML = `
      <div class="card">
        <div class="section-title">Key Observations</div>
        <div class="insight-item"><span class="insight-icon">🌾</span><div><b>${topCrop.Item}</b> has the highest historically observed average yield (~${Math.round(topCrop["hg/ha_yield"]).toLocaleString()} hg/ha) in this dataset, while <b>${bottomCrop.Item}</b> shows the lowest.</div></div>
        <div class="insight-item"><span class="insight-icon">🌍</span><div><b>${topArea.Area}</b> shows the highest average yield among areas in the current filter, and <b>${bottomArea.Area}</b> the lowest — reflecting differences in reported agricultural conditions across areas.</div></div>
        <div class="insight-item"><span class="insight-icon">🌧️</span><div>Rainfall is ${describeCorr(rainCorr)} with yield in this dataset (correlation ≈ ${rainCorr}), based on the model's training data.</div></div>
        <div class="insight-item"><span class="insight-icon">🌡️</span><div>Average temperature is ${describeCorr(tempCorr)} with yield (correlation ≈ ${tempCorr}).</div></div>
        <div class="insight-item"><span class="insight-icon">🧪</span><div>Pesticide usage is ${describeCorr(pestCorr)} with yield (correlation ≈ ${pestCorr}).</div></div>
        ${topFeature ? `<div class="insight-item"><span class="insight-icon">🧩</span><div>According to the ${bestModel} model, <code>${topFeature.feature}</code> is the most influential encoded feature for predicting yield.</div></div>` : ""}
      </div>
      <div class="card section" style="margin-top:16px;">
        <p style="font-size:11.5px; color:var(--text-muted);">
          These are correlational, dataset-derived observations — not causal claims. Wording such as
          "associated with" and "historically observed" is used deliberately instead of "causes".
        </p>
      </div>
    `;
  } catch (e) {
    el.innerHTML = errorHTML(e.message);
  }
}
function describeCorr(v) {
  const av = Math.abs(v);
  const dir = v >= 0 ? "positively associated" : "negatively associated";
  if (av < 0.1) return "only weakly associated";
  if (av < 0.3) return `mildly ${dir}`;
  if (av < 0.6) return `moderately ${dir}`;
  return `strongly ${dir}`;
}

// ---------------- Init ----------------
(async function init() {
  await checkApiStatus();
  navigateTo("overview");
})();
