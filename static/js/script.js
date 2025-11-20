

    // ---------- MOCK DATA (approximate your screenshots) ---------- //
    const mockData = {
      "General Manager Public Service": {
        // trend
        years: [2016, 2017, 2018, 2019, 2020],
        employees: [16, 6, 7, 40, 25],           // time series
        boxValues: [16, 6, 7, 40, 23],           // vacancies / "boxplot" levels

        // ACF / PACF
        acfLags: [0, 1, 2, 3, 4],
        acfValues: [1.0, 0.0, -0.3, 0.0, 0.05],
        pacfLags: [1, 2, 3, 4],
        pacfValues: [0.0, -0.35, 0.02, -0.05],

        // forecast
        forecastSteps: [1, 2, 3, 4, 5, 6],
        forecastSeries: [18, 15, 15, 30, 25, 22],
        // CI around forecast (mock, same length)
        forecastLo: [12, 10, 10, 22, 18, 15],
        forecastHi: [24, 20, 20, 38, 32, 29],
        lastActualIndex: 4,  // steps 1-5 = actual, 6 = forecast horizon point

        // residuals
        residualIndex: [1, 2, 3, 4, 5],
        residualSeries: [15, 10, 5, 20, 15],

        residualAcfLags: [1, 2, 3, 4],
        residualAcfValues: [0.1, -0.2, 0.05, 0.0],

        residualHistBins: ["-20", "-10", "0", "10", "20", "30"],
        residualHistCounts: [1, 2, 4, 3, 2, 1]
      }
    };

    const arimaSummaryText =
      "Series: ts_data\n" +
      "ARIMA(0,0,0) with zero mean\n\n" +
      "sigma^2 = 200:  log likelihood = -22.42\n" +
      "AIC=47.24   AICc=48.58   BIC=46.85\n\n" +
      "Training set error measures (mock):\n" +
      "ME   RMSE   MAE   MPE   MAPE   ACF1\n" +
      "1.2  5.0    4.1   2.0   12.5   0.10\n\n" +
      "Box-Ljung test (mock):\n" +
      "data: auto.arima.model$residuals\n" +
      "X-squared = 9.59e-05, df = 1, p-value = 0.9992";

    // ---------- CHART INSTANCES ---------- //
    let trendLineChart = null;
    let trendBoxChart = null;
    let acfChart = null;
    let pacfChart = null;
    let forecastChart = null;
    let residualsSeriesChart = null;
    let residualsAcfChart = null;
    let residualsHistChart = null;

    function getDataForSpecialization(name) {
      return mockData[name] || mockData["General Manager Public Service"];
    }

    function initOrUpdateCharts(specialization) {
      const data = getDataForSpecialization(specialization);

      // Titles
      document.getElementById("trend-title").textContent = specialization;
      document.getElementById("boxplot-title").textContent = specialization;
      document.getElementById("acf-title").textContent = specialization;
      document.getElementById("pacf-title").textContent = specialization;
      document.getElementById("forecast-title").textContent = specialization;

      // ---------- TREND LINE ----------
      const trendLineCtx = document
        .getElementById("trendLineChart")
        .getContext("2d");
      if (trendLineChart) {
        trendLineChart.data.labels = data.years;
        trendLineChart.data.datasets[0].data = data.employees;
        trendLineChart.update();
      } else {
        trendLineChart = new Chart(trendLineCtx, {
          type: "line",
          data: {
            labels: data.years,
            datasets: [
              {
                label: "Number of Employees",
                data: data.employees,
                tension: 0.2
              }
            ]
          },
          options: {
            scales: {
              y: {
                title: { display: true, text: "Number of Employees" }
              },
              x: {
                title: { display: true, text: "Year" }
              }
            }
          }
        });
      }

      // ---------- TREND "BOXPLOT" (as bar) ----------
      const boxCtx = document
        .getElementById("trendBoxChart")
        .getContext("2d");
      if (trendBoxChart) {
        trendBoxChart.data.labels = data.years;
        trendBoxChart.data.datasets[0].data = data.boxValues;
        trendBoxChart.update();
      } else {
        trendBoxChart = new Chart(boxCtx, {
          type: "bar",
          data: {
            labels: data.years,
            datasets: [
              {
                label: "Vacancies (mock)",
                data: data.boxValues
              }
            ]
          },
          options: {
            scales: {
              y: {
                title: { display: true, text: "Number of Employees" }
              },
              x: {
                title: { display: true, text: "Year" }
              }
            }
          }
        });
      }

      // ---------- ACF ----------
      const acfCtx = document.getElementById("acfChart").getContext("2d");
      const ciLevel = 0.5; // mock CI bands
      if (acfChart) {
        acfChart.data.labels = data.acfLags;
        acfChart.data.datasets[0].data = data.acfValues;
        acfChart.data.datasets[1].data = data.acfLags.map(() => ciLevel);
        acfChart.data.datasets[2].data = data.acfLags.map(() => -ciLevel);
        acfChart.update();
      } else {
        acfChart = new Chart(acfCtx, {
          type: "bar",
          data: {
            labels: data.acfLags,
            datasets: [
              {
                label: "ACF",
                data: data.acfValues
              },
              {
                type: "line",
                label: "Upper CI",
                data: data.acfLags.map(() => ciLevel),
                borderDash: [4, 4],
                pointRadius: 0
              },
              {
                type: "line",
                label: "Lower CI",
                data: data.acfLags.map(() => -ciLevel),
                borderDash: [4, 4],
                pointRadius: 0
              }
            ]
          },
          options: {
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                suggestedMin: -1,
                suggestedMax: 1,
                title: { display: true, text: "ACF" }
              },
              x: {
                title: { display: true, text: "Lag" }
              }
            }
          }
        });
      }

      // ---------- PACF ----------
      const pacfCtx = document.getElementById("pacfChart").getContext("2d");
      if (pacfChart) {
        pacfChart.data.labels = data.pacfLags;
        pacfChart.data.datasets[0].data = data.pacfValues;
        pacfChart.data.datasets[1].data = data.pacfLags.map(() => ciLevel);
        pacfChart.data.datasets[2].data = data.pacfLags.map(() => -ciLevel);
        pacfChart.update();
      } else {
        pacfChart = new Chart(pacfCtx, {
          type: "bar",
          data: {
            labels: data.pacfLags,
            datasets: [
              {
                label: "PACF",
                data: data.pacfValues
              },
              {
                type: "line",
                label: "Upper CI",
                data: data.pacfLags.map(() => ciLevel),
                borderDash: [4, 4],
                pointRadius: 0
              },
              {
                type: "line",
                label: "Lower CI",
                data: data.pacfLags.map(() => -ciLevel),
                borderDash: [4, 4],
                pointRadius: 0
              }
            ]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              y: {
                suggestedMin: -1,
                suggestedMax: 1,
                title: { display: true, text: "Partial ACF" }
              },
              x: {
                title: { display: true, text: "Lag" }
              }
            }
          }
        });
      }

      // ---------- FORECAST MAIN ----------
      const forecastCtx = document
        .getElementById("forecastChart")
        .getContext("2d");

      const histMask = data.forecastSeries.map((v, i) =>
        i < data.lastActualIndex ? v : null
      );
      const forecastMask = data.forecastSeries.map((v, i) =>
        i >= data.lastActualIndex - 1 ? v : null
      );

      if (forecastChart) {
        forecastChart.data.labels = data.forecastSteps;
        forecastChart.data.datasets[0].data = histMask;
        forecastChart.data.datasets[1].data = forecastMask;
        forecastChart.data.datasets[2].data = data.forecastLo;
        forecastChart.data.datasets[3].data = data.forecastHi;
        forecastChart.update();
      } else {
        forecastChart = new Chart(forecastCtx, {
          type: "line",
          data: {
            labels: data.forecastSteps,
            datasets: [
              {
                label: "Historical",
                data: histMask,
                tension: 0.2
              },
              {
                label: "Forecast",
                data: forecastMask,
                tension: 0.2,
                borderDash: [5, 5]
              },
              {
                label: "Lo 95",
                data: data.forecastLo,
                pointRadius: 0,
                borderWidth: 1
              },
              {
                label: "Hi 95",
                data: data.forecastHi,
                pointRadius: 0,
                borderWidth: 1
              }
            ]
          },
          options: {
            scales: {
              x: {
                title: { display: true, text: "Step" }
              },
              y: {
                title: { display: true, text: "Value" }
              }
            }
          }
        });
      }

      // ---------- RESIDUAL SERIES ----------
      const resSeriesCtx = document
        .getElementById("residualsSeriesChart")
        .getContext("2d");
      if (residualsSeriesChart) {
        residualsSeriesChart.data.labels = data.residualIndex;
        residualsSeriesChart.data.datasets[0].data = data.residualSeries;
        residualsSeriesChart.update();
      } else {
        residualsSeriesChart = new Chart(resSeriesCtx, {
          type: "line",
          data: {
            labels: data.residualIndex,
            datasets: [
              {
                label: "Residuals",
                data: data.residualSeries,
                tension: 0.2
              }
            ]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { title: { display: true, text: "Index" } },
              y: { title: { display: true, text: "Residual" } }
            }
          }
        });
      }

      // ---------- RESIDUAL ACF ----------
      const resAcfCtx = document
        .getElementById("residualsAcfChart")
        .getContext("2d");
      if (residualsAcfChart) {
        residualsAcfChart.data.labels = data.residualAcfLags;
        residualsAcfChart.data.datasets[0].data = data.residualAcfValues;
        residualsAcfChart.data.datasets[1].data =
          data.residualAcfLags.map(() => ciLevel);
        residualsAcfChart.data.datasets[2].data =
          data.residualAcfLags.map(() => -ciLevel);
        residualsAcfChart.update();
      } else {
        residualsAcfChart = new Chart(resAcfCtx, {
          type: "bar",
          data: {
            labels: data.residualAcfLags,
            datasets: [
              {
                label: "ACF(residuals)",
                data: data.residualAcfValues
              },
              {
                type: "line",
                label: "Upper CI",
                data: data.residualAcfLags.map(() => ciLevel),
                borderDash: [4, 4],
                pointRadius: 0
              },
              {
                type: "line",
                label: "Lower CI",
                data: data.residualAcfLags.map(() => -ciLevel),
                borderDash: [4, 4],
                pointRadius: 0
              }
            ]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              y: {
                suggestedMin: -1,
                suggestedMax: 1,
                title: { display: true, text: "ACF" }
              },
              x: { title: { display: true, text: "Lag" } }
            }
          }
        });
      }

      // ---------- RESIDUAL HISTOGRAM ----------
      const resHistCtx = document
        .getElementById("residualsHistChart")
        .getContext("2d");
      if (residualsHistChart) {
        residualsHistChart.data.labels = data.residualHistBins;
        residualsHistChart.data.datasets[0].data = data.residualHistCounts;
        residualsHistChart.update();
      } else {
        residualsHistChart = new Chart(resHistCtx, {
          type: "bar",
          data: {
            labels: data.residualHistBins,
            datasets: [
              {
                label: "Count",
                data: data.residualHistCounts
              }
            ]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { title: { display: true, text: "Residual value (bin)" } },
              y: { title: { display: true, text: "Frequency" } }
            }
          }
        });
      }

      // ---------- TEXT SUMMARY ----------
      document.getElementById("arimaSummary").textContent = arimaSummaryText;
    }

    // ---------- INITIALISE ---------- //
    document.addEventListener("DOMContentLoaded", function () {
      const select = document.getElementById("specialization");
      initOrUpdateCharts(select.value);

      select.addEventListener("change", function () {
        initOrUpdateCharts(this.value);
      });
    });
