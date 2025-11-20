# FUNCTIONS/ofo_codes.py
import pyodbc
from db_utils import get_db_connection   # use your existing helper

def fetch_distinct_ofo_codes():
    """
    Returns a list of dicts:
    [
      {"value": "265412 - Media Producer", "label": "Media Producer"},
      ...
    ]
    taken DISTINCT from Biodata_2022..2025.
    """
    sql = """
        SELECT DISTINCT [OFO CODE   ] AS ofo_code
        FROM (
            SELECT [OFO CODE   ] FROM [dbo].[Biodata_2022]
            UNION ALL
            SELECT [OFO CODE   ] FROM [dbo].[Biodata_2023]
            UNION ALL
            SELECT [OFO CODE   ] FROM [dbo].[Biodata_2024]
            UNION ALL
            SELECT [OFO CODE   ] FROM [dbo].[Biodata_2025]
        ) AS src
        WHERE [OFO CODE   ] IS NOT NULL
          AND LTRIM(RTRIM([OFO CODE   ])) <> ''
        ORDER BY [OFO CODE   ];
    """

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
    finally:
        conn.close()

    options = []
    for (full_val,) in rows:
        full_str = str(full_val).strip()
        if " - " in full_str:
            _, label = full_str.split(" - ", 1)
            label = label.strip()
        else:
            label = full_str  # fallback if no " - "
        options.append({"value": full_str, "label": label})

    return options
