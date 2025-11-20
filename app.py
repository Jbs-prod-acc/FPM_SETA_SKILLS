import os
from flask import Flask, request, render_template, jsonify, Response
from db_utils import get_db_connection
import pyodbc


import pandas as pd
import numpy as np
import pyodbc
import matplotlib.pyplot as plt
from ipywidgets import interact, Dropdown

from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.tsa.arima.model import ARIMA
# from pmdarima import auto_arima
from pmdarima import auto_arima
from scipy.stats import norm




import matplotlib
matplotlib.use('Agg')

app = Flask(__name__)
app.config['PROPAGATE_EXCEPTIONS'] = True
app.secret_key = 'secret_key'

from FUNCTIONS.ofo_codes import fetch_distinct_ofo_codes

@app.route('/')
def index():
    ofo_options = fetch_distinct_ofo_codes()
    return render_template('index.html', ofo_options=ofo_options)


from FUNCTIONS.ofo_analysis import analyze_ofo_code
@app.route('/api/ofo_analysis')
def api_ofo_analysis():
    ofo_code = request.args.get('ofo_code')
    if not ofo_code:
        return jsonify({"ok": False, "error": "ofo_code query parameter is required"}), 400

    try:
        result = analyze_ofo_code(ofo_code)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except Exception as e:
        # You can also print(e) here to see stack traces in the Flask console
        return jsonify({"ok": False, "error": f"Internal error: {e}"}), 500

    return jsonify({"ok": True, **result})






if __name__ == '__main__':
    app.run(port=8020, debug=True)
    # app.run(host="0.0.0.0", port=8080, debug=False)
