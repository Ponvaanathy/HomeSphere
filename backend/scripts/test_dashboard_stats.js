const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';

async function testDashboardStats() {
  console.log('====================================================');
  console.log('🧪 TESTING REAL USER DASHBOARD STATS (SELL + BUY + RENT)');
  console.log('====================================================\n');

  // 1. Register User A (Alice - Seller & Landlord)
  console.log('1️⃣ Registering User A (Alice)...');
  const regARes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Cooper',
      email: `alice_${Date.now()}@example.com`,
      password: 'StrongPassword2026!',
      phone: '+1 (555) 111-2233'
    })
  });
  const regAData = await regARes.json();
  const tokenA = regAData.data.token;
  const userAId = regAData.data.user.id;
  console.log(` ✔ User A registered with ID: ${userAId}`);

  // 2. Check User A Initial Clean Stats
  console.log('\n2️⃣ Verifying User A initial clean 0 stats...');
  const statsA1Res = await fetch(`${API_BASE}/users/dashboard-stats`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const statsA1Data = await statsA1Res.json();
  console.log(' ✔ User A initial stats:', statsA1Data.data);
  if (
    statsA1Data.data.properties_for_sale !== 0 ||
    statsA1Data.data.properties_for_rent !== 0 ||
    statsA1Data.data.properties_purchased !== 0 ||
    statsA1Data.data.properties_rented !== 0
  ) {
    throw new Error('Expected 0 for all initial stats');
  }

  // 3. User A lists 3 properties for sale (type = 'buy')
  console.log('\n3️⃣ User A listing 3 properties for sale...');
  const salePropIds = [];
  for (let i = 1; i <= 3; i++) {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: `Luxury Villa #${i} For Sale`,
        description: `Modern smart villa with pool and garden #${i}`,
        type: 'buy',
        property_type: 'villa',
        price: 850000 + i * 50000,
        address: `${100 + i} Lakeview Blvd`,
        city: 'Austin',
        state: 'TX',
        area_sqft: 2800 + i * 100
      })
    });
    const data = await res.json();
    salePropIds.push(data.data.property_id);
  }
  console.log(` ✔ Listed 3 properties for sale. IDs: ${salePropIds.join(', ')}`);

  // 4. User A lists 2 properties for rent (type = 'rent')
  console.log('\n4️⃣ User A listing 2 properties for rent...');
  const rentPropIds = [];
  for (let i = 1; i <= 2; i++) {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        title: `Downtown Studio Loft #${i} For Rent`,
        description: `High-rise loft with skyline view #${i}`,
        type: 'rent',
        property_type: 'apartment',
        price: 2500 + i * 200,
        deposit: 2500,
        address: `${200 + i} Congress Ave`,
        city: 'Austin',
        state: 'TX',
        area_sqft: 950 + i * 50
      })
    });
    const data = await res.json();
    rentPropIds.push(data.data.property_id);
  }
  console.log(` ✔ Listed 2 properties for rent. IDs: ${rentPropIds.join(', ')}`);

  // 5. Verify User A updated stats (For Sale = 3, For Rent = 2)
  console.log('\n5️⃣ Verifying User A stats after listing properties...');
  const statsA2Res = await fetch(`${API_BASE}/users/dashboard-stats`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const statsA2Data = await statsA2Res.json();
  console.log(' ✔ User A updated stats:', statsA2Data.data);
  if (statsA2Data.data.properties_for_sale !== 3 || statsA2Data.data.properties_for_rent !== 2) {
    throw new Error(`Expected for_sale=3 and for_rent=2, got ${statsA2Data.data.properties_for_sale} and ${statsA2Data.data.properties_for_rent}`);
  }

  // 6. Register User B (Bob - Buyer & Renter)
  console.log('\n6️⃣ Registering User B (Bob)...');
  const regBRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Marley',
      email: `bob_${Date.now()}@example.com`,
      password: 'StrongPassword2026!',
      phone: '+1 (555) 444-5566'
    })
  });
  const regBData = await regBRes.json();
  const tokenB = regBData.data.token;
  const userBId = regBData.data.user.id;
  console.log(` ✔ User B registered with ID: ${userBId}`);

  // 7. Verify User B isolation (User B must have 0 for everything, not seeing User A's counts)
  console.log('\n7️⃣ Verifying User B isolation (must see 0, not User A listings)...');
  const statsB1Res = await fetch(`${API_BASE}/users/dashboard-stats`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const statsB1Data = await statsB1Res.json();
  console.log(' ✔ User B stats:', statsB1Data.data);
  if (statsB1Data.data.properties_for_sale !== 0 || statsB1Data.data.properties_for_rent !== 0) {
    throw new Error('User B must not see User A property counts');
  }

  // 8. User B completes a Purchase of 1 property (transactions table with status = 'completed')
  console.log('\n8️⃣ User B purchasing 1 property (Villa #1) with completed status...');
  const txRes = await fetch(`${API_BASE}/transactions/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      property_id: salePropIds[0],
      offer_amount: 900000,
      deposit_amount: 25000
    })
  });
  const txData = await txRes.json();
  const txId = txData.data.transaction_id || txData.data.id;

  // Advance transaction to completed
  await fetch(`${API_BASE}/transactions/${txId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ status: 'completed', notes: 'Closing signed and title transferred.' })
  });
  console.log(` ✔ Purchase transaction #${txId} marked as completed.`);

  // 9. User B rents 2 properties (1 via approved rental application, 1 via completed rental transaction)
  console.log('\n9️⃣ User B renting 2 properties (1 approved app + 1 completed rental deal)...');
  
  // Rental 1: Application approved
  const appRes = await fetch(`${API_BASE}/rental-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      property_id: rentPropIds[0],
      move_in_date: '2026-09-01',
      lease_duration_months: 12,
      applicant_income_monthly: 8500,
      applicant_credit_score: 750,
      employment_status: 'Full-time Senior Architect',
      emergency_contact_phone: '+1 555 999 8888'
    })
  });
  const appData = await appRes.json();
  const appId = appData.data.application_id || appData.data.id;

  // Landlord approves the rental application
  await fetch(`${API_BASE}/rental-applications/${appId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ status: 'approved' })
  });
  console.log(` ✔ Rental Application #${appId} approved.`);

  // Rental 2: Rental deal completed
  const rentTxRes = await fetch(`${API_BASE}/transactions/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      property_id: rentPropIds[1],
      deal_type: 'rent',
      offer_amount: 2700,
      deposit_amount: 2700
    })
  });
  const rentTxData = await rentTxRes.json();
  const rentTxId = rentTxData.data.transaction_id || rentTxData.data.id;

  await fetch(`${API_BASE}/transactions/${rentTxId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ status: 'completed', notes: 'Lease agreement finalized and deposit paid.' })
  });
  console.log(` ✔ Rental Deal #${rentTxId} completed.`);

  // 10. Verify User B Final Stats (Purchased: 1, Rented: 2, For Sale: 0, For Rent: 0)
  console.log('\n🔟 Verifying User B final stats (Purchased: 1, Rented: 2)...');
  const statsB2Res = await fetch(`${API_BASE}/users/dashboard-stats`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const statsB2Data = await statsB2Res.json();
  console.log(' ✔ User B final stats:', statsB2Data.data);

  if (
    statsB2Data.data.properties_purchased !== 1 ||
    statsB2Data.data.properties_rented !== 2 ||
    statsB2Data.data.properties_for_sale !== 0 ||
    statsB2Data.data.properties_for_rent !== 0
  ) {
    throw new Error(`User B stats mismatch! Expected purchased=1, rented=2, got ${JSON.stringify(statsB2Data.data)}`);
  }

  // 11. Verify User A Final Stats (For Sale: 3, For Rent: 2, Purchased: 0, Rented: 0)
  console.log('\n1️⃣1️⃣ Verifying User A final stats (For Sale: 3, For Rent: 2)...');
  const statsA3Res = await fetch(`${API_BASE}/users/dashboard-stats`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const statsA3Data = await statsA3Res.json();
  console.log(' ✔ User A final stats:', statsA3Data.data);

  if (
    statsA3Data.data.properties_for_sale !== 3 ||
    statsA3Data.data.properties_for_rent !== 2 ||
    statsA3Data.data.properties_purchased !== 0 ||
    statsA3Data.data.properties_rented !== 0
  ) {
    throw new Error(`User A stats mismatch! Expected for_sale=3, for_rent=2, got ${JSON.stringify(statsA3Data.data)}`);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL DASHBOARD ACTIVITY STATS TESTS PASSED PERFECTLY!');
  console.log('====================================================\n');
}

testDashboardStats().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
