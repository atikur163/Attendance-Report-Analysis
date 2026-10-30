# Deploying UniAttend to Render with MySQL

This guide walks you through deploying both the **Flask Backend** and **MySQL Database** to **Render** (https://render.com).

---

## 1. Local MySQL Setup (User: `root`, Pass: `1234`)

### A. Create the Database & Tables Locally
Open your terminal and run:
```bash
mysql -u root -p1234 -e "CREATE DATABASE IF NOT EXISTS uniattend_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p1234 uniattend_db < backend_python/schema_mysql.sql
```

### B. Run the Backend Locally with MySQL
```bash
cd backend_python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set local database URI
export DATABASE_URL="mysql+pymysql://root:1234@localhost:3306/uniattend_db?charset=utf8mb4"
python run.py
```
Your backend will start at `http://localhost:5000` connected to MySQL!

---

## 2. Setting Up MySQL for Cloud Deployment on Render

Render does not offer a shared free MySQL tier directly inside its dashboard (Render offers PostgreSQL natively), so you have two recommended, 100% free production options:

### Option A: Free Cloud MySQL Instance (Recommended & Instant)
Use a free managed cloud MySQL provider:
1. **Aiven (Free Tier)**: https://aiven.io (Free 5GB MySQL) OR
2. **Railway / TiDB Cloud (Free)**: https://tidbcloud.com (Free 5GB Serverless MySQL) OR
3. **Clever Cloud (Free)**: https://www.clever-cloud.com (Free MySQL database)
4. Create a database called `uniattend_db`.
5. Run `schema_mysql.sql` using any MySQL client (e.g. MySQL Workbench, DBeaver, or command line).
6. Copy the connection string provided by the cloud service:
   ```
   mysql+pymysql://<user>:<password>@<host>:<port>/uniattend_db?charset=utf8mb4
   ```

### Option B: Deploy MySQL on Render via Docker
1. On Render, click **New +** $\rightarrow$ **Web Service** or **Private Service**.
2. Select **Existing Image**: `mysql:8.0`.
3. Add Environment Variables:
   - `MYSQL_ROOT_PASSWORD`: `1234`
   - `MYSQL_DATABASE`: `uniattend_db`
   - `MYSQL_USER`: `uniadmin`
   - `MYSQL_PASSWORD`: `YourSecurePassword!`
4. Add a Persistent Disk mounted at `/var/lib/mysql`.
5. Render will assign an internal hostname: `uniattend-mysql.internal:3306`.
6. Your connection string will be:
   ```
   mysql+pymysql://uniadmin:YourSecurePassword!@uniattend-mysql.internal:3306/uniattend_db?charset=utf8mb4
   ```

---

## 3. Deploying the Python Backend Web Service on Render

### Step 1: Push Code to GitHub
Ensure your repository contains the `backend_python` folder.

### Step 2: Create Web Service on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Fill in the service configuration:
   - **Name**: `uniattend-backend`
   - **Region**: Choose closest to you (e.g. `Singapore` or `Frankfurt`)
   - **Root Directory**: `backend_python`
   - **Environment**: `Python 3`
   - **Build Command**:
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     gunicorn --workers=3 --bind=0.0.0.0:$PORT run:app
     ```
   - **Instance Type**: `Free`

### Step 3: Configure Environment Variables in Render
In the **Environment Variables** tab of your Render Web Service, add:

| Key | Value |
|---|---|
| `FLASK_ENV` | `production` |
| `PYTHON_VERSION` | `3.11.9` |
| `SECRET_KEY` | *(Click "Generate" or enter a 32-character random string)* |
| `DATABASE_URL` | `mysql+pymysql://<user>:<password>@<host>:<port>/uniattend_db?charset=utf8mb4` |
| `LATE_THRESHOLD_MINUTES` | `20` |
| `EXAM_ELIGIBILITY_PERCENTAGE` | `60.0` |
| `THREE_LATE_PENALTY_ENABLED` | `True` |

### Step 4: Click "Create Web Service"
Render will automatically:
1. Clone the repository.
2. Install dependencies (`Flask`, `SQLAlchemy`, `PyMySQL`, `Gunicorn`, `NumPy`, `Pandas`).
3. Bind to Render's dynamic `$PORT`.
4. Run health check at `/health`.
5. Issue an HTTPS SSL certificate (e.g., `https://uniattend-backend.onrender.com`).

---

## 4. Deploying the React Frontend on Render

1. On Render, click **New +** $\rightarrow$ **Static Site**.
2. Connect the same GitHub repository.
3. Configuration:
   - **Name**: `uniattend-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Click **Create Static Site**.
5. Your React application is now live on HTTPS!

---

## 5. Verification Checklist

- [x] Database tables created with UTF8MB4 charset.
- [x] PyMySQL driver connects without native compilation issues.
- [x] Health check returns `200 OK` at `https://your-service.onrender.com/health`.
- [x] 20-minute late threshold and 3-late penalty rules active.
- [x] Teacher 1-theory-course rule verified.
