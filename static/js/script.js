// ================== GLOBAL CHART INSTANCES ================== //
let trendLineChart = null;
let trendBoxChart = null;
let acfChart = null;
let pacfChart = null;
let forecastChart = null;
let residualsSeriesChart = null;
let residualsAcfChart = null;
let residualsHistChart = null;

// ================== SMALL HELPERS ================== //

// Simple alert + console helper
function showError(msg) {
  console.error(msg);
  alert(msg);
}

// Compute simple ACF in JS for a series
function computeACF(series, maxLag) {
  const n = series.length;
  if (n < 2) {
    return { lags: [0], values: [1] };
  }

  const mean = series.reduce((sum, v) => sum + v, 0) / n;
  const centered = series.map((v) => v - mean);
  const denom = centered.reduce((sum, v) => sum + v * v, 0) || 1;

  const lags = [];
  const values = [];

  for (let k = 0; k <= maxLag; k++) {
    let num = 0;
    for (let t = k; t < n; t++) {
      num += centered[t] * centered[t - k];
    }
    lags.push(k);
    values.push(num / denom);
  }

  return { lags, values };
}

// Simple histogram for residuals
function computeHistogram(series, binCount = 6) {
  if (!series.length) {
    return { bins: [], counts: [] };
  }

  const minVal = Math.min(...series);
  const maxVal = Math.max(...series);
  const range = maxVal - minVal || 1;
  const width = range / binCount;

  const counts = new Array(binCount).fill(0);
  const bins = [];

  for (let i = 0; i < binCount; i++) {
    const start = minVal + i * width;
    const end = start + width;
    bins.push(`${start.toFixed(1)}–${end.toFixed(1)}`);
  }

  for (const v of series) {
    let idx = Math.floor((v - minVal) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx] += 1;
  }

  return { bins, counts };
}

// ================== MAIN UPDATE FUNCTION ================== //

function updateChartsFromApi(apiData, specializationLabel) {
  // ---- Titles ----
  document.getElementById("trend-title").textContent = specializationLabel;
  document.getElementById("boxplot-title").textContent = specializationLabel;
  document.getElementById("acf-title").textContent = specializationLabel;
  document.getElementById("pacf-title").textContent = specializationLabel;
  document.getElementById("forecast-title").textContent = specializationLabel;

  // ---- Trend data ----
  const years = (apiData.trend && apiData.trend.years) || [];
  const counts = (apiData.trend && apiData.trend.counts) || [];
  const boxValues = (apiData.boxplot && apiData.boxplot.values) || [];

  // 95% CI level for ACF bands (approx)
  const nObs = counts.length || 1;
  const ciLevel = 1.96 / Math.sqrt(nObs);

  // ================== TREND LINE ================== //
  const trendLineCtx = document.getElementById("trendLineChart").getContext("2d");

  if (trendLineChart) {
    trendLineChart.data.labels = years;
    trendLineChart.data.datasets[0].data = counts;
    trendLineChart.update();
  } else {
    trendLineChart = new Chart(trendLineCtx, {
      type: "line",
      data: {
        labels: years,
        datasets: [
          {
            label: "Number of Employees",
            data: counts,
            tension: 0.2,
          },
        ],
      },
      options: {
        scales: {
          y: {
            title: { display: true, text: "Number of Employees" },
          },
          x: {
            title: { display: true, text: "Year" },
          },
        },
      },
    });
  }

  // ================== TREND BOX-"PLOT" (BAR) ================== //
  const boxCtx = document.getElementById("trendBoxChart").getContext("2d");

  if (trendBoxChart) {
    trendBoxChart.data.labels = years;
    trendBoxChart.data.datasets[0].data = boxValues;
    trendBoxChart.update();
  } else {
    trendBoxChart = new Chart(boxCtx, {
      type: "bar",
      data: {
        labels: years,
        datasets: [
          {
            label: "Number of Employees",
            data: boxValues,
          },
        ],
      },
      options: {
        scales: {
          y: {
            title: { display: true, text: "Number of Employees" },
          },
          x: {
            title: { display: true, text: "Year" },
          },
        },
      },
    });
  }

  // ================== ACF ================== //
  const acfData = apiData.acf || { lags: [], values: [] };
  const acfLags = acfData.lags || [];
  const acfValues = acfData.values || [];

  const acfCtx = document.getElementById("acfChart").getContext("2d");
  if (acfChart) {
    acfChart.data.labels = acfLags;
    acfChart.data.datasets[0].data = acfValues;
    acfChart.data.datasets[1].data = acfLags.map(() => ciLevel);
    acfChart.data.datasets[2].data = acfLags.map(() => -ciLevel);
    acfChart.update();
  } else {
    acfChart = new Chart(acfCtx, {
      type: "bar",
      data: {
        labels: acfLags,
        datasets: [
          {
            label: "ACF",
            data: acfValues,
          },
          {
            type: "line",
            label: "Upper CI",
            data: acfLags.map(() => ciLevel),
            borderDash: [4, 4],
            pointRadius: 0,
          },
          {
            type: "line",
            label: "Lower CI",
            data: acfLags.map(() => -ciLevel),
            borderDash: [4, 4],
            pointRadius: 0,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: {
            suggestedMin: -1,
            suggestedMax: 1,
            title: { display: true, text: "ACF" },
          },
          x: { title: { display: true, text: "Lag" } },
        },
      },
    });
  }

  // ================== PACF ================== //
  const pacfData = apiData.pacf || { lags: [], values: [] };
  const pacfLags = pacfData.lags || [];
  const pacfValues = pacfData.values || [];

  const pacfCtx = document.getElementById("pacfChart").getContext("2d");
  if (pacfChart) {
    pacfChart.data.labels = pacfLags;
    pacfChart.data.datasets[0].data = pacfValues;
    pacfChart.data.datasets[1].data = pacfLags.map(() => ciLevel);
    pacfChart.data.datasets[2].data = pacfLags.map(() => -ciLevel);
    pacfChart.update();
  } else {
    pacfChart = new Chart(pacfCtx, {
      type: "bar",
      data: {
        labels: pacfLags,
        datasets: [
          {
            label: "PACF",
            data: pacfValues,
          },
          {
            type: "line",
            label: "Upper CI",
            data: pacfLags.map(() => ciLevel),
            borderDash: [4, 4],
            pointRadius: 0,
          },
          {
            type: "line",
            label: "Lower CI",
            data: pacfLags.map(() => -ciLevel),
            borderDash: [4, 4],
            pointRadius: 0,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: {
            suggestedMin: -1,
            suggestedMax: 1,
            title: { display: true, text: "Partial ACF" },
          },
          x: { title: { display: true, text: "Lag" } },
        },
      },
    });
  }

  // ================== FORECAST ================== //
  const fc = apiData.forecast || {};
  const nextForecastValue = fc.value;
  const lo95 = fc.lo_95;
  const hi95 = fc.hi_95;

  const nextYear = years.length ? years[years.length - 1] + 1 : 1;
  const forecastLabels = [...years, nextYear];

  const histSeries = [...counts, null];
  const forecastSeries = forecastLabels.map((_, idx) => (idx === forecastLabels.length - 1 ? nextForecastValue : null));
  const loSeries = forecastLabels.map((_, idx) => (idx === forecastLabels.length - 1 ? lo95 : null));
  const hiSeries = forecastLabels.map((_, idx) => (idx === forecastLabels.length - 1 ? hi95 : null));

  const forecastCtx = document.getElementById("forecastChart").getContext("2d");

  if (forecastChart) {
    forecastChart.data.labels = forecastLabels;
    forecastChart.data.datasets[0].data = histSeries;
    forecastChart.data.datasets[1].data = forecastSeries;
    forecastChart.data.datasets[2].data = loSeries;
    forecastChart.data.datasets[3].data = hiSeries;
    forecastChart.update();
  } else {
    forecastChart = new Chart(forecastCtx, {
      type: "line",
      data: {
        labels: forecastLabels,
        datasets: [
          {
            label: "Historical",
            data: histSeries,
            tension: 0.2,
          },
          {
            label: "Forecast",
            data: forecastSeries,
            tension: 0.2,
            borderDash: [5, 5],
          },
          {
            label: "Lo 95",
            data: loSeries,
            pointRadius: 0,
            borderWidth: 1,
          },
          {
            label: "Hi 95",
            data: hiSeries,
            pointRadius: 0,
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Year" } },
          y: { title: { display: true, text: "Number of Employees" } },
        },
      },
    });
  }

  // ================== RESIDUAL SERIES ================== //
  const residuals = apiData.residuals || [];
  const resIndex = residuals.map((_, i) => i + 1);

  const resSeriesCtx = document.getElementById("residualsSeriesChart").getContext("2d");

  if (residualsSeriesChart) {
    residualsSeriesChart.data.labels = resIndex;
    residualsSeriesChart.data.datasets[0].data = residuals;
    residualsSeriesChart.update();
  } else {
    residualsSeriesChart = new Chart(resSeriesCtx, {
      type: "line",
      data: {
        labels: resIndex,
        datasets: [
          {
            label: "Residuals",
            data: residuals,
            tension: 0.2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Index" } },
          y: { title: { display: true, text: "Residual" } },
        },
      },
    });
  }

  // ================== RESIDUAL ACF ================== //
  const maxResLag = Math.min(residuals.length - 1, 10);
  const resAcf = residuals.length > 1 ? computeACF(residuals, maxResLag) : { lags: [0], values: [1] };

  const resAcfCtx = document.getElementById("residualsAcfChart").getContext("2d");

  if (residualsAcfChart) {
    residualsAcfChart.data.labels = resAcf.lags;
    residualsAcfChart.data.datasets[0].data = resAcf.values;
    residualsAcfChart.data.datasets[1].data = resAcf.lags.map(() => ciLevel);
    residualsAcfChart.data.datasets[2].data = resAcf.lags.map(() => -ciLevel);
    residualsAcfChart.update();
  } else {
    residualsAcfChart = new Chart(resAcfCtx, {
      type: "bar",
      data: {
        labels: resAcf.lags,
        datasets: [
          {
            label: "ACF(residuals)",
            data: resAcf.values,
          },
          {
            type: "line",
            label: "Upper CI",
            data: resAcf.lags.map(() => ciLevel),
            borderDash: [4, 4],
            pointRadius: 0,
          },
          {
            type: "line",
            label: "Lower CI",
            data: resAcf.lags.map(() => -ciLevel),
            borderDash: [4, 4],
            pointRadius: 0,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: {
            suggestedMin: -1,
            suggestedMax: 1,
            title: { display: true, text: "ACF" },
          },
          x: { title: { display: true, text: "Lag" } },
        },
      },
    });
  }

  // ================== RESIDUAL HISTOGRAM ================== //
  const hist = computeHistogram(residuals, 6);

  const resHistCtx = document.getElementById("residualsHistChart").getContext("2d");

  if (residualsHistChart) {
    residualsHistChart.data.labels = hist.bins;
    residualsHistChart.data.datasets[0].data = hist.counts;
    residualsHistChart.update();
  } else {
    residualsHistChart = new Chart(resHistCtx, {
      type: "bar",
      data: {
        labels: hist.bins,
        datasets: [
          {
            label: "Count",
            data: hist.counts,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Residual (bin)" } },
          y: { title: { display: true, text: "Frequency" } },
        },
      },
    });
  }

  // ================== ARIMA SUMMARY TEXT ================== //
  const summaryEl = document.getElementById("arimaSummary");
  let summaryText = (apiData.model_summary || "").trim();

  if (apiData.lb_test) {
    const lb = apiData.lb_test;
    if (
      typeof lb.lb_stat === "number" &&
      typeof lb.lb_pvalue === "number" &&
      isFinite(lb.lb_stat) &&
      isFinite(lb.lb_pvalue)
    ) {
      summaryText +=
        "\n\nLjung-Box Test (lag 1)\n" +
        `lb_stat = ${lb.lb_stat.toFixed(4)}, ` +
        `p-value = ${lb.lb_pvalue.toFixed(4)}`;
    }
  }

  summaryEl.textContent = summaryText;
}

// ================== WIRE UP DROPDOWN ================== //

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("specialization");
  if (!select) return;

  // INITIAL LOAD: if one is pre-selected
  if (select.value) {
    const initialOfo = select.value;
    const initialLabel = select.options[select.selectedIndex].textContent || "";
    fetch(`/api/ofo_analysis?ofo_code=${encodeURIComponent(initialOfo)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          showError(data.error || "Unknown error from server");
          return;
        }
        updateChartsFromApi(data, initialLabel);
      })
      .catch((err) => showError(err));
  }

  // On change
  select.addEventListener("change", async () => {
    const ofoCode = select.value;
    if (!ofoCode) return;

    const label = select.options[select.selectedIndex].textContent || ofoCode;

    try {
      const res = await fetch(`/api/ofo_analysis?ofo_code=${encodeURIComponent(ofoCode)}`);
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Unknown error from server");
        return;
      }
      updateChartsFromApi(data, label);
    } catch (err) {
      showError(err);
    }
  });
});
