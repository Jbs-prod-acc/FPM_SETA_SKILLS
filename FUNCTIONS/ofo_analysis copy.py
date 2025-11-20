# FUNCTIONS/ofo_analysis.py

import numpy as np
import pandas as pd

from db_utils import get_db_connection

from statsmodels.tsa.stattools import acf, pacf
from statsmodels.stats.diagnostic import acorr_ljungbox
from pmdarima import auto_arima


def fetch_ofo_time_series(ofo_code: str) -> pd.DataFrame:
    """
    Returns a DataFrame with columns:
        year (int), n_employees (float)
    aggregated across Biodata_2022 .. Biodata_2025 for a single OFO code.
    """
    sql = """
        SELECT
            CAST([FINANCIAL YEAR   ] AS INT) AS year,
            SUM([NUMBER OF EMPLOYEES   ])    AS n_employees
        FROM (
            SELECT [OFO CODE   ], [FINANCIAL YEAR   ], [NUMBER OF EMPLOYEES   ]
            FROM [dbo].[Biodata_2022]

            UNION ALL
            SELECT [OFO CODE   ], [FINANCIAL YEAR   ], [NUMBER OF EMPLOYEES   ]
            FROM [dbo].[Biodata_2023]

            UNION ALL
            SELECT [OFO CODE   ], [FINANCIAL YEAR   ], [NUMBER OF EMPLOYEES   ]
            FROM [dbo].[Biodata_2024]

            UNION ALL
            SELECT [OFO CODE   ], [FINANCIAL YEAR   ], [NUMBER OF EMPLOYEES   ]
            FROM [dbo].[Biodata_2025]
        ) AS src
        WHERE [OFO CODE   ] = ?
        GROUP BY [FINANCIAL YEAR   ]
        ORDER BY [FINANCIAL YEAR   ];
    """

    conn = get_db_connection()
    try:
        df = pd.read_sql_query(sql, conn, params=[ofo_code])
    finally:
        conn.close()

    # normalise columns
    df.rename(columns={"year": "year", "n_employees": "n_employees"}, inplace=True)
    # make sure counts are numeric and drop NaNs
    df["n_employees"] = pd.to_numeric(df["n_employees"], errors="coerce")
    df = df.dropna(subset=["n_employees"]).sort_values("year")

    return df


def _safe_ljung_box(residuals: np.ndarray) -> tuple[float, float]:
    """
    Run Ljung–Box at lag 1 and work with both old and new statsmodels APIs.
    """
    if len(residuals) < 3:
        return float("nan"), float("nan")

    try:
        # Newer statsmodels (return_df=True available)
        lb_df = acorr_ljungbox(residuals, lags=[1], return_df=True)
        lb_stat = float(lb_df["lb_stat"].iloc[0])
        lb_pvalue = float(lb_df["lb_pvalue"].iloc[0])
    except TypeError:
        # Older statsmodels: returns 2 arrays
        lb_stat_arr, lb_pvalue_arr = acorr_ljungbox(residuals, lags=[1])
        lb_stat = float(lb_stat_arr[0])
        lb_pvalue = float(lb_pvalue_arr[0])

    return lb_stat, lb_pvalue


def analyze_ofo_code(ofo_code: str) -> dict:
    """
    Runs:
      - Trend (years + counts, "boxplot" values)
      - ACF & PACF
      - ARIMA forecast (auto_arima) when possible
      - Residual diagnostics + Ljung-Box test

    Returns a pure-JSON-friendly dict (lists & floats only).
    """
    df = fetch_ofo_time_series(ofo_code)

    if df.empty:
        raise ValueError("No data found for the selected OFO code.")

    years = df["year"].astype(int).tolist()
    counts = df["n_employees"].astype(float).tolist()
    ts = np.asarray(counts, dtype=float)

    # ---------- ACF & PACF (for correlations tab) ----------
    n = len(ts)
    if n < 3:
        # Too short – trivial ACF/PACF
        acf_vals = [1.0]
        acf_lags = [0]
        pacf_vals = [1.0]
        pacf_lags = [0]
    else:
        # ACF: up to n-1 but capped at 10
        max_acf_lag = min(n - 1, 10)
        acf_vals_arr = acf(ts, nlags=max_acf_lag, fft=False)
        acf_vals = acf_vals_arr.tolist()
        acf_lags = list(range(len(acf_vals)))

        # PACF constraint: nlags < 0.5 * sample_size
        # So we choose at most floor(n/2) - 1, and also <= max_acf_lag
        max_pacf_lag = min(max_acf_lag, max(int(np.floor(n / 2)) - 1, 1))

        try:
            pacf_vals_arr = pacf(ts, nlags=max_pacf_lag, method="yw")
            pacf_vals = pacf_vals_arr.tolist()
            pacf_lags = list(range(len(pacf_vals)))
        except Exception:
            # If anything goes wrong, fall back to trivial PACF
            pacf_vals = [1.0]
            pacf_lags = [0]

    # ---------- ARIMA Forecast (for forecast tab) ----------
    if n >= 3:
        model = auto_arima(
            ts,
            seasonal=False,
            trace=False,
            error_action="ignore",
            suppress_warnings=True,
        )

        forecast, conf_int = model.predict(n_periods=1, return_conf_int=True)
        f = float(forecast[0])
        lo_95, hi_95 = map(float, conf_int[0])

        residuals = np.asarray(model.resid(), dtype=float)
        lb_stat, lb_pvalue = _safe_ljung_box(residuals)
        summary_text = model.summary().as_text()
    else:
        # Fallback for very short series: naive forecast
        f = float(ts[-1])
        lo_95 = float(ts[-1])
        hi_95 = float(ts[-1])
        residuals = ts - np.mean(ts)
        lb_stat, lb_pvalue = float("nan"), float("nan")
        summary_text = (
            f"Naive forecast used (series too short for ARIMA, length={n})."
        )

    return {
        # Trend tab
        "trend": {
            "years": years,
            "counts": counts,
        },
        "boxplot": {
            "values": counts,
        },
        # Correlations tab
        "acf": {
            "lags": acf_lags,
            "values": acf_vals,
        },
        "pacf": {
            "lags": pacf_lags,
            "values": pacf_vals,
        },
        # Forecast tab
        "forecast": {
            "time_index": n + 1,
            "value": f,
            "lo_95": lo_95,
            "hi_95": hi_95,
        },
        "residuals": residuals.tolist(),
        "lb_test": {
            "lb_stat": lb_stat,
            "lb_pvalue": lb_pvalue,
        },
        "model_summary": summary_text,
    }
