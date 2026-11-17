# 🏋️ Gym Manager Automation: Complete Working Application & Deployment Suite

> **Based on the blueprint by Sachin Prajapati: "n8n Gym Manager Automation: Complete Setup Guide"**  
> Complete working full-stack application, automated schedulers, WhatsApp reminder engine, Razorpay webhook integration, Google Sheets database synchronization, and pre-built n8n workflow templates.

---

## 🌟 Key Capabilities & Features

| Feature | Description | Implementation Guide |
| :--- | :--- | :--- |
| **Workflow 1: Member Entry** | Front desk tablet kiosk form with phone normalization (`91...`), month-end date math (`addMonths`), and auto-deduplication on phone numbers. | Chapter 4 |
| **Workflow 2: Expiry Reminder** | Automated daily 09:00 AM scheduler checking members with 3 days or 0 days remaining (`REMIND_DAYS = [3, 0]`), WhatsApp Cloud API / direct `wa.me` instant dispatch, and daily dedup protection. | Chapter 5 |
| **Workflow 3: Payment Update** | **Route A:** Razorpay Webhook (`payment_link.paid`) with HMAC-SHA256 signature verification & idempotency key check.<br>**Route B:** Manual Cash/UPI recording form for the owner. Automatically extends membership from current expiry or today. | Chapter 6 |
| **Workflow 4: Daily Owner Report** | Automated 08:00 AM daily digest calculating Active, Expired, and Pending payments counts with member names, dispatched via Email (SMTP) & WhatsApp summary. | Chapter 7 |
| **Google Sheets 12-Column DB** | 100% compliant with the 12-column schema, instant CSV export, and Tab 2 Dashboard formula generators (`SUMPRODUCT` & `COUNTA`). | Chapter 3 & 8 |
| **n8n Workflows Included** | Ready-to-import JSON files for all 4 workflows + centralized Error Trigger handler. | Chapter 4–8 |

---

## 🚀 Quickstart (Run in 30 Seconds)

### 1. Run Directly on Your Laptop
```powershell
# Navigate to the project directory
cd C:\Users\ENGG\.gemini\antigravity\scratch\gym-manager-app

# Install dependencies (already installed)
npm install

# Start the application
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 2. Run Edge-Case Test Suite
```powershell
npm test
```
Tests all 7 critical edge cases specified in Chapter 8:
- 31st January + 1 Month leap year rollover
- Phone number cleanup (`+91`, spaces, hyphens)
- Duplicate phone registration (updates without duplicate rows)
- Expired member renewal calculation (advances from today)
- Double webhook event / idempotency (prevents double-extending)
- Same-day reminder deduplication
- Daily report metric calculation integrity

### 3. Seed Realistic Demo Members
```powershell
npm run seed
```
Populates 7 realistic members in active, expiring (3 days), expiring today (0 days), and expired states for client demos!

---

## 📊 Google Sheets Database Design

### Tab 1: `Members` (12 Columns)
| Col | Field | Type | Managed By | Purpose |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `member_id` | Plain Text | System / Workflow 1 | Unique Member identifier (`GYM-XXXXXX`) |
| **B** | `name` | Plain Text | Form / Workflow 1 | Member's full name |
| **C** | `phone` | Plain Text | Form / Workflow 1 | Clean WhatsApp number (`91XXXXXXXXXX`) |
| **D** | `plan` | Plain Text | Form / Workflow 1 | `Monthly`, `Quarterly`, `Half-yearly`, `Yearly` |
| **E** | `plan_months` | Number | Form / Workflow 1 | Duration in months (1, 3, 6, 12) |
| **F** | `fee` | Number | Form / Workflow 1 | Membership fee in INR |
| **G** | `start_date` | Plain Text | Form / Workflow 1 | `YYYY-MM-DD` |
| **H** | `expiry_date` | Plain Text | Workflow 1 & 3 | `YYYY-MM-DD` |
| **I** | `payment_status` | Plain Text | Workflow 1 & 3 | `Paid` or `Pending` |
| **J** | `last_payment_date` | Plain Text | Workflow 3 | `YYYY-MM-DD` |
| **K** | `last_reminder_date`| Plain Text | Workflow 2 | `YYYY-MM-DD` |
| **L** | `last_payment_ref` | Plain Text | Workflow 3 | Razorpay Payment Link ID / Idempotency Key |

### Tab 2: `Dashboard` Formulas (Copy & Paste directly into Sheet)
- **Total members:**
  ```excel
  =COUNTA(Members!A2:A)
  ```
- **Active members:**
  ```excel
  =SUMPRODUCT((Members!H2:H<>"")*(Members!H2:H>=TEXT(TODAY(),"yyyy-mm-dd")))
  ```
- **Expired members:**
  ```excel
  =SUMPRODUCT((Members!H2:H<>"")*(Members!H2:H<TEXT(TODAY(),"yyyy-mm-dd")))
  ```
- **Pending payments:**
  ```excel
  =COUNTIF(Members!I2:I,"Pending")
  ```

---

## 🤖 Ready-to-Import n8n Workflow Templates

All 5 workflow templates are located in `public/n8n_workflows/` and can be downloaded directly from the web interface:
1. `1_new_member_entry.json`: Form Trigger &rarr; Code (`addMonths`) &rarr; Google Sheet Append/Update
2. `2_expiry_reminder.json`: Schedule (9 AM IST) &rarr; Sheet Read &rarr; Filter &rarr; WhatsApp Template &rarr; Update `last_reminder_date`
3. `3_payment_update.json`: Webhook (`payment_link.paid`) &rarr; HMAC SHA256 &rarr; Extract &rarr; Compute Expiry & Idempotency &rarr; Update Sheet
4. `4_daily_report.json`: Schedule (8 AM IST) &rarr; Sheet Read &rarr; Aggregate Counts &rarr; Email / WhatsApp Dispatch
5. `5_error_handler.json`: Centralized error notification workflow

---

## 🌐 Deployment Options

### Option A: Local Autostart with PM2 (Windows / Linux / Mac)
```powershell
npm install -g pm2
pm2 start server.js --name "gym-manager"
pm2 save
pm2 startup
```

### Option B: Docker & Docker Compose (Gym App + Self-hosted n8n)
Runs both the application on port `3000` and a full self-hosted n8n instance on port `5678`:
```powershell
docker compose up -d
```

### Option C: Cloud Deployment (Render / Railway)
- **Render:** Push this repository to GitHub and click **New Web Service** &rarr; select **Node Environment** (auto-configured by `render.yaml`).
- **Railway:** Connect repository and Railway detects `Dockerfile` or `package.json` automatically.

---

## 💼 Client Proposal & Sales Kit (Chapter 9)

### 10-Minute Live Demo Script
1. Open the **Dashboard** displaying live metrics.
2. Go to **Front Desk Entry**, fill out a dummy member with joining date today, and show instant expiry date calculation.
3. Switch to **Expiry Reminders**, demonstrate how members with 3 days left appear, and click **Send via WA Web** to show the prefilled WhatsApp reminder.
4. Record a **Cash/UPI Payment** or simulate a **Razorpay Webhook** to show how status flips to *Paid* and the expiry date automatically pushes forward.
5. Open **Daily Owner Report** and show the morning summary that gets sent to the owner's WhatsApp and Email.

### Proposal Terms (Justifying ₹10,000–₹15,000 Setup Fee)
- **Scope Included:** Web app, Google Sheet integration, 4 automated workflows, WhatsApp reminders, payment webhook, daily digest, testing, and 30 minutes staff training.
- **Client Responsibilities:** Meta WhatsApp Business Account approval, old member roster.
- **Running Costs:** Kept under client's accounts (Meta Cloud API utility rate ~₹0.115/message).
