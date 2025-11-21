// ================== GLOBAL CHART INSTANCES ================== //
let trendLineChart = null;
let trendBoxChart = null;
let acfChart = null;
let pacfChart = null;
let forecastChart = null;
let residualsSeriesChart = null;
let residualsAcfChart = null;
let residualsHistChart = null;

// Keep last data so we can explain it in the modal
let lastApiData = null;
let lastSpecializationLabel = "";

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

// Round nicely for explanations
function fmtNumber(v) {
  if (v === null || v === undefined || !isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  return v.toFixed(1);
}

// ================== MAIN UPDATE FUNCTION ================== //

function updateChartsFromApi(apiData, specializationLabel) {
  // Remember for explanations
  lastApiData = apiData;
  lastSpecializationLabel = specializationLabel;

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

  // Labels: existing years + next year
  const nextYear = years.length ? years[years.length - 1] + 1 : 1;
  const forecastLabels = [...years, nextYear];

  // Historical series: counts + null
  const histSeries = [...counts, null];

  // Forecast series: nulls except last point
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
  const resAcf = residuals.length ? computeACF(residuals, maxResLag) : { lags: [0], values: [1] };

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

// ================== EXPLANATION BUILDER ================== //

function buildExplanation(section, data, label) {
  const years = (data.trend && data.trend.years) || [];
  const counts = (data.trend && data.trend.counts) || [];
  const residuals = data.residuals || [];
  const acfVals = (data.acf && data.acf.values) || [];
  const pacfVals = (data.pacf && data.pacf.values) || [];
  const fc = data.forecast || {};

  switch (section) {
    case "trend": {
      if (!years.length) {
        return {
          title: `Trend for ${label}`,
          text: "No time-series information is available for this specialization.",
        };
      }
      const firstYear = years[0];
      const lastYear = years[years.length - 1];
      const firstVal = counts[0];
      const lastVal = counts[counts.length - 1];
      let direction = "remained roughly stable";
      if (lastVal > firstVal * 1.05) direction = "increased";
      else if (lastVal < firstVal * 0.95) direction = "decreased";

      const absChange = lastVal - firstVal;
      const pctChange = firstVal && isFinite(firstVal) ? ((absChange / firstVal) * 100).toFixed(1) : "N/A";

      const text =
        `For ${label}, the number of employees changed from about ${fmtNumber(firstVal)} in ${firstYear} to ${fmtNumber(
          lastVal
        )} in ${lastYear}. ` +
        `Overall, employment has ${direction} over the period, ` +
        `with an absolute change of ${fmtNumber(absChange)} employees ` +
        `(${pctChange}% change).`;

      return { title: `Trend for ${label}`, text };
    }

    case "box": {
      if (!counts.length) {
        return {
          title: `Spread of values for ${label}`,
          text: "No data is available to describe the spread of employee numbers.",
        };
      }
      const minVal = Math.min(...counts);
      const maxVal = Math.max(...counts);
      const range = maxVal - minVal;
      const text =
        `This chart shows how annual employee counts for ${label} vary across years. ` +
        `Values range from a minimum of about ${fmtNumber(minVal)} to a maximum of about ${fmtNumber(
          maxVal
        )}, giving a total range of ${fmtNumber(range)} employees. Larger ranges indicate more volatility over time.`;
      return { title: `Spread of values for ${label}`, text };
    }

    case "acf": {
      const lag1 = acfVals.length > 1 ? acfVals[1] : null;
      let interp;
      if (lag1 === null || !isFinite(lag1)) {
        interp = "There is insufficient data to compute meaningful autocorrelations.";
      } else if (Math.abs(lag1) < 0.2) {
        interp = "The lag-1 autocorrelation is weak, suggesting little year-to-year persistence.";
      } else if (lag1 > 0) {
        interp =
          "The lag-1 autocorrelation is positive, meaning high values tend to be followed by high values and low by low.";
      } else {
        interp =
          "The lag-1 autocorrelation is negative, meaning high values are often followed by lower values and vice versa.";
      }

      const text =
        `The ACF plot shows the correlation between employee counts in different years for ${label}. ` +
        `At lag 1 (one-year gap) the autocorrelation is about ${fmtNumber(lag1)}. ` +
        interp +
        " Bars that fall within the dashed confidence bands are not statistically distinguishable from zero.";

      return { title: `ACF for ${label}`, text };
    }

    case "pacf": {
      const lag1 = pacfVals.length > 1 ? pacfVals[1] : null;
      let interp;
      if (lag1 === null || !isFinite(lag1)) {
        interp = "There is insufficient data to compute meaningful partial autocorrelations.";
      } else if (Math.abs(lag1) < 0.2) {
        interp =
          "The partial correlation at lag 1 is weak, suggesting a simple AR structure is not strongly supported.";
      } else if (lag1 > 0) {
        interp = "The partial correlation at lag 1 is clearly positive, consistent with an AR(1)-type dynamic.";
      } else {
        interp =
          "The partial correlation at lag 1 is clearly negative, indicating a tendency to reverse from one year to the next.";
      }

      const text =
        `The PACF plot isolates the direct relationship between counts and their lagged values for ${label}. ` +
        `At lag 1 the partial autocorrelation is approximately ${fmtNumber(lag1)}. ` +
        interp;

      return { title: `PACF for ${label}`, text };
    }

    case "forecast": {
      const f = fc.value;
      const lo = fc.lo_95;
      const hi = fc.hi_95;
      const lastActual = counts.length ? counts[counts.length - 1] : null;
      let changeText = "";

      if (f !== null && f !== undefined && lastActual !== null && isFinite(f) && isFinite(lastActual)) {
        const diff = f - lastActual;
        const pct = lastActual !== 0 ? ((diff / lastActual) * 100).toFixed(1) : null;

        if (Math.abs(diff) < 0.05 * lastActual) {
          changeText = "This is broadly in line with the most recent observed level, indicating a stable outlook.";
        } else if (diff > 0) {
          changeText = `This is higher than the last observed value by about ${fmtNumber(
            diff
          )} employees (${pct}% increase), suggesting expected growth.`;
        } else {
          changeText = `This is lower than the last observed value by about ${fmtNumber(
            -diff
          )} employees (${pct}% decrease), suggesting a possible decline.`;
        }
      } else {
        changeText = "The model could not produce a fully reliable comparison with recent data.";
      }

      const text =
        `The ARIMA model forecasts that the next period's employment for ${label} will be around ${fmtNumber(
          f
        )} employees. ` +
        `The 95% confidence interval ranges from about ${fmtNumber(lo)} to ${fmtNumber(hi)}. ` +
        changeText;

      return { title: `Forecast for ${label}`, text };
    }

    case "residual-series": {
      if (!residuals.length) {
        return {
          title: "Residual series",
          text: "No residuals are available for this model.",
        };
      }
      const mean = residuals.reduce((s, v) => s + v, 0) / residuals.length || 0;
      const std = Math.sqrt(residuals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / residuals.length);

      const text =
        "The residual series shows the difference between the actual data and the fitted ARIMA values over time. " +
        `For this model, residuals are centered around ${fmtNumber(
          mean
        )} with a typical size (standard deviation) of about ${fmtNumber(std)}. ` +
        "If residuals fluctuate randomly around zero with no obvious pattern, the model is capturing the main structure in the data.";

      return { title: "Residual time series", text };
    }

    case "residual-acf": {
      const rAcfVals = computeACF(residuals, Math.min(residuals.length - 1, 10)).values;
      const lag1 = rAcfVals.length > 1 ? rAcfVals[1] : null;

      let interp;
      if (lag1 === null || !isFinite(lag1)) {
        interp = "There is not enough information to assess autocorrelation in the residuals.";
      } else if (Math.abs(lag1) < 0.2) {
        interp = "Residual autocorrelations are small, so the model does not leave strong structure unexplained.";
      } else {
        interp =
          "Some residual autocorrelations are relatively large, suggesting that the model may not fully capture all time-dependence in the data.";
      }

      const text =
        "The residual ACF plot checks whether there is remaining structure after fitting the model. " +
        `At lag 1 the residual autocorrelation is about ${fmtNumber(lag1)}. ` +
        interp +
        " Ideally, most bars should fall within the dashed confidence bands.";

      return { title: "ACF of residuals", text };
    }

    case "residual-hist": {
      if (!residuals.length) {
        return {
          title: "Residual histogram",
          text: "No residuals are available to plot a histogram.",
        };
      }
      const mean = residuals.reduce((s, v) => s + v, 0) / residuals.length || 0;

      const text =
        "The histogram of residuals shows how often different error sizes occur. " +
        `For this model, the residuals are centered around ${fmtNumber(mean)}. ` +
        "A roughly symmetric, bell-shaped histogram supports the assumption of normally distributed errors used by many time-series models.";

      return { title: "Residual distribution", text };
    }

    default:
      return {
        title: "Explanation",
        text: "No explanation is configured for this chart.",
      };
  }
}

// ================== WIRE UP DROPDOWN & MODAL BUTTONS ================== //

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("specialization");
  if (select) {
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
  }

  // Global click handler for all Explain buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-explain]");
    if (!btn) return;

    if (!lastApiData) {
      showError("Please select a specialization first so the results can be calculated.");
      return;
    }

    const section = btn.getAttribute("data-explain");
    const modalTitleEl = document.getElementById("explanationModalLabel");
    const modalBodyEl = document.getElementById("explanationModalBody");

    const { title, text } = buildExplanation(section, lastApiData, lastSpecializationLabel);

    modalTitleEl.textContent = title;
    modalBodyEl.textContent = text;
  });
});
