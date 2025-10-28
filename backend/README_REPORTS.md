# Sales Reports

This file documents the lightweight report endpoints added to the backend.

Endpoints:

- GET /api/reports/weekly?weeks=10&productId=... — returns last N weeks (default 10)
  - Response: { success:true, weeks: [{ weekStart, totalSales, unitsSold }, ...] }

- GET /api/reports/monthly?months=5&productId=... — returns last N months (default 5)
  - Response: { success:true, months: [{ monthStart, totalSales, unitsSold }, ...] }

Notes:
- Both endpoints require an Authorization header with an admin or privileged JWT: `Authorization: Bearer <token>`.
- The endpoints perform server-side aggregation using MongoDB pipeline and return a fixed-length list for the requested periods; periods without sales will have zero totals.

Quick test script:

1. From the project root set env vars and run the helper script (PowerShell example):

```powershell
$env:API = 'http://localhost:5000/api/reports'
$env:TOKEN = '<your-admin-jwt>'
node backend/scripts/fetchReports.js
```

2. The script prints the weekly and monthly JSON payloads to the console.
