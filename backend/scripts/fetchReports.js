const fetch = require('node-fetch');

const API = process.env.API || 'http://localhost:5000/api/reports';
const TOKEN = process.env.TOKEN || '';

async function getWeekly(weeks = 10, productId) {
  const url = `${API}/weekly?weeks=${weeks}${productId ? `&productId=${productId}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: TOKEN ? `Bearer ${TOKEN}` : '' } });
  const json = await res.json();
  console.log('WEEKLY:', JSON.stringify(json, null, 2));
}

async function getMonthly(months = 5, productId) {
  const url = `${API}/monthly?months=${months}${productId ? `&productId=${productId}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: TOKEN ? `Bearer ${TOKEN}` : '' } });
  const json = await res.json();
  console.log('MONTHLY:', JSON.stringify(json, null, 2));
}

(async () => {
  await getWeekly();
  await getMonthly();
})();
