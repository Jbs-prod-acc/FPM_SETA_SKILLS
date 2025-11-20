# db_utils.py
import pyodbc





# RJ's connection string
def get_db_connection():
    s = 'APB-JBS02-66L'
    d = 'FPM_20_Nov_2025'
    u = 'CHATBOT_USER'
    p = '123456789'
    cstr = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={s};DATABASE={d};UID={u};PWD={p}'
    conn = pyodbc.connect(cstr)
    
    return conn  # Ensure the connection object is returned


# Sam's connection string
# def get_db_connection():
#     s = 'APB-JBS02-113L\SQLEXPRESS'
#     d = 'AuditPlanningDatabase'
#     u = 'CHATBOT_USER'
#     p = '123456789'
#     cstr = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={s};DATABASE={d};UID={u};PWD={p}'
#     conn = pyodbc.connect(cstr)
#     return conn  # Ensure the connection object is returned