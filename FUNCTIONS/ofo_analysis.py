# FUNCTIONS/ofo_analysis.py

import math
import numpy as np
import pandas as pd

from db_utils import get_db_connection

from statsmodels.tsa.stattools import acf, pacf
from statsmodels.stats.diagnostic import acorr_ljungbox
from pmdarima import auto_arima


# ---------------------------------------------------------------------
# Helpers to keep JSON clean (no NaN / inf)
# ---------------------------------------------------------------------

def _safe_number(x):
    """
    Convert x to a JSON-safe float.
    - If x is NaN or ±inf or cannot be cast, returns None (-> null in JSON).
    - Otherwise returns a plain Python float.
    """
    if x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    return v


def _safe_list(arr):
    """
    Apply _safe_number to each element of an iterable.
    """
    return [_safe_number(v) for v in arr]


# ---------------------------------------------------------------------
# 1. Fetch time-series for one OFO code
# ---------------------------------------------------------------------

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

    # Ensure numeric + sorted
    df["n_employees"] = pd.to_numeric(df["n_employees"], errors="coerce")
    df = df.dropna(subset=["n_employees"]).sort_values("year")

    return df


# ---------------------------------------------------------------------
# 2. Safe Ljung–Box wrapper
# ---------------------------------------------------------------------

def _safe_ljung_box(residuals: np.ndarray) -> tuple[float | None, float | None]:
    """
    Run Ljung–Box at lag 1 and work with both old and new statsmodels APIs.
    Returns (lb_stat, lb_pvalue) but may return NaN which we will clean later.
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


# ---------------------------------------------------------------------
# 3. Full analysis for Trend + Corr + Forecast
# ---------------------------------------------------------------------

def analyze_ofo_code(ofo_code: str) -> dict:
    """
    Runs:
      - Trend (years + counts, "boxplot" values)
      - ACF & PACF
      - ARIMA forecast (auto_arima)
      - Residual diagnostics + Ljung-Box test

    Returns a pure-JSON-friendly dict (lists & floats/None only).
    """
    df = fetch_ofo_time_series(ofo_code)

    if df.empty:
        raise ValueError("No data found for the selected OFO code.")

    years = df["year"].astype(int).tolist()
    counts = df["n_employees"].astype(float).tolist()
    ts = np.asarray(counts, dtype=float)

    # ---------- ACF & PACF (for correlations tab) ----------
    if len(ts) < 2:
        acf_vals = [1.0]
        pacf_vals = [1.0]
        lags = [0]
    else:
        max_lag = min(len(ts) - 1, 10)

        # ACF is usually safe
        acf_vals = acf(ts, nlags=max_lag, fft=False).tolist()

        # PACF can complain if nlags is too big; keep <= n/2 - 1
        safe_nlags = min(max_lag, max(1, len(ts) // 2 - 1))
        try:
            pacf_vals = pacf(ts, nlags=safe_nlags, method="ywunbiased").tolist()
            # align lags with pacf length
            lags = list(range(len(pacf_vals)))
            acf_vals = acf_vals[: len(lags)]
        except Exception:
            # Fallback if pacf still fails
            pacf_vals = [1.0] + [0.0] * max_lag
            lags = list(range(len(pacf_vals)))
            acf_vals = acf_vals[: len(lags)]

    # Clean ACF/PACF values
    acf_vals = _safe_list(acf_vals)
    pacf_vals = _safe_list(pacf_vals)

    # ---------- ARIMA Forecast ----------
    if len(ts) >= 3:
        model = auto_arima(
            ts,
            seasonal=False,
            trace=False,
            error_action="ignore",
            suppress_warnings=True,
        )

        forecast, conf_int = model.predict(n_periods=1, return_conf_int=True)
        f_raw = forecast[0]
        lo_raw, hi_raw = conf_int[0]

        residuals = np.asarray(model.resid(), dtype=float)
        lb_stat_raw, lb_pvalue_raw = _safe_ljung_box(residuals)
        summary_text = model.summary().as_text()
    else:
        # Fallback for very short series: naive forecast = last observed value
        f_raw = ts[-1]
        lo_raw = ts[-1]
        hi_raw = ts[-1]
        residuals = ts - np.mean(ts)
        lb_stat_raw, lb_pvalue_raw = float("nan"), float("nan")
        summary_text = (
            f"Naive forecast used (series too short for ARIMA, length={len(ts)})."
        )

    # Clean forecast & diagnostics
    f = _safe_number(f_raw)
    lo_95 = _safe_number(lo_raw)
    hi_95 = _safe_number(hi_raw)

    residuals_list = _safe_list(residuals)
    lb_stat = _safe_number(lb_stat_raw)
    lb_pvalue = _safe_number(lb_pvalue_raw)

    return {
        # A) Trend tab
        "trend": {
            "years": years,
            "counts": _safe_list(counts),
        },
        # Boxplot: reuse counts
        "boxplot": {
            "values": _safe_list(counts),
        },
        # B) Correlations tab
        "acf": {
            "lags": lags,
            "values": acf_vals,
        },
        "pacf": {
            "lags": lags,
            "values": pacf_vals,
        },
        # C) Forecast tab
        "forecast": {
            "time_index": len(ts) + 1,
            "value": f,
            "lo_95": lo_95,
            "hi_95": hi_95,
        },
        "residuals": residuals_list,
        "lb_test": {
            "lb_stat": lb_stat,
            "lb_pvalue": lb_pvalue,
        },
        "model_summary": summary_text,
    }
