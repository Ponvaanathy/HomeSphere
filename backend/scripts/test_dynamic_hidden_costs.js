const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { calculateHiddenCosts } = require('../services/costEngineService');

async function runHiddenCostEngineTests() {
  console.log('================================================================');
  console.log('💰 TESTING DYNAMIC HIDDEN COST ENGINE & 5-YEAR FORECAST REMOVAL');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(` ✅ PASS: ${name} ${details ? '— ' + details : ''}`);
    } else {
      console.error(` ❌ FAIL: ${name} ${details ? '— ' + details : ''}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. TEST A: Rental Property A (₹15,000/mo, 1000 sqft)
    // -------------------------------------------------------------
    console.log('1️⃣ TEST A: Rental Property A (₹15,000/month, 1,000 sq.ft):');
    const propA = {
      type: 'rent',
      price: 15000,
      area_sqft: 1000,
      category: 'residential',
      subcategory: 'apartment',
      furnishing: 'semi-furnished'
    };
    const resA = calculateHiddenCosts(propA);

    test('TEST A: Correct Model', resA.listingType === 'rent');
    test('TEST A: Annual Rent Calculation', resA.annualRent === 180000, `Annual Rent: ₹${resA.annualRent}`);
    test('TEST A: Tenancy Stamp Duty (~1%)', resA.stampDuty === 1800, `Stamp Duty: ₹${resA.stampDuty}`);
    test('TEST A: Agreement Registration', resA.registration === 1000, `Registration: ₹${resA.registration}`);
    test('TEST A: Area Scaled Maintenance', resA.maintenance === 36000, `Annual Maint: ₹${resA.maintenance}`);
    test('TEST A: Fit-out for semi-furnished', resA.fitOut === 10000, `Fit-out: ₹${resA.fitOut}`);
    
    // Strict SUM check:
    const calculatedSumA = resA.items.reduce((sum, item) => sum + item.amount, 0);
    test('TEST A: Total strictly equals SUM(visible line items)', resA.totalEstimatedCost === calculatedSumA, `Total: ₹${resA.totalEstimatedCost} (Sum: ₹${calculatedSumA})`);

    // -------------------------------------------------------------
    // 2. TEST B: Rental Property B (₹25,000/mo, 1500 sqft)
    // -------------------------------------------------------------
    console.log('\n2️⃣ TEST B: Rental Property B (₹25,000/month, 1,500 sq.ft):');
    const propB = {
      type: 'rent',
      price: 25000,
      area_sqft: 1500,
      category: 'residential',
      subcategory: 'apartment',
      furnishing: 'semi-furnished'
    };
    const resB = calculateHiddenCosts(propB);

    test('TEST B: Result is DIFFERENT from Property A', resB.totalEstimatedCost !== resA.totalEstimatedCost, `Prop A Total: ₹${resA.totalEstimatedCost} vs Prop B Total: ₹${resB.totalEstimatedCost}`);
    test('TEST B: Annual Rent matches (₹25,000 × 12 = ₹3,00,000)', resB.annualRent === 300000, `Annual Rent: ₹${resB.annualRent}`);
    test('TEST B: Maintenance scales to 1,500 sqft', resB.maintenance === 54000, `Maintenance: ₹${resB.maintenance}`);

    // -------------------------------------------------------------
    // 3. TEST C: Buy / Sale Property C (₹50 Lakhs, 1200 sqft)
    // -------------------------------------------------------------
    console.log('\n3️⃣ TEST C: Buy / Sale Property C (₹50 Lakhs, 1,200 sq.ft):');
    const propC = {
      type: 'sale',
      price: 5000000,
      area_sqft: 1200,
      category: 'residential',
      subcategory: 'apartment',
      furnishing: 'semi-furnished'
    };
    const resC = calculateHiddenCosts(propC);

    test('TEST C: Uses Acquisition Model (NOT Rent Model)', resC.listingType === 'sale' && resC.propertyPrice === 5000000);
    test('TEST C: Statutory Stamp Duty (~7%)', resC.stampDuty === 350000, `Stamp Duty: ₹${resC.stampDuty}`);
    test('TEST C: Registration Fee (~1%)', resC.registration === 50000, `Registration: ₹${resC.registration}`);
    test('TEST C: Annual Maintenance scaled to 1,200 sqft', resC.maintenance === 43200, `Maintenance: ₹${resC.maintenance}`);
    test('TEST C: Interior Fit-out for semi-furnished (₹120/sqft)', resC.fitOut === 144000, `Fit-out: ₹${resC.fitOut}`);
    
    const calculatedSumC = resC.items.reduce((sum, item) => sum + item.amount, 0);
    test('TEST C: Total strictly equals SUM(visible line items)', resC.totalEstimatedCost === calculatedSumC, `Total Outlay: ₹${resC.totalEstimatedCost}`);

    // -------------------------------------------------------------
    // 4. TEST D: Buy / Sale Property D (₹1 Crore, 2000 sqft)
    // -------------------------------------------------------------
    console.log('\n4️⃣ TEST D: Buy / Sale Property D (₹1 Crore, 2,000 sq.ft):');
    const propD = {
      type: 'sale',
      price: 10000000,
      area_sqft: 2000,
      category: 'residential',
      subcategory: 'apartment',
      furnishing: 'fully-furnished'
    };
    const resD = calculateHiddenCosts(propD);

    test('TEST D: Result is DIFFERENT from Property C', resD.totalEstimatedCost !== resC.totalEstimatedCost, `Prop C: ₹${resC.totalEstimatedCost} vs Prop D: ₹${resD.totalEstimatedCost}`);
    test('TEST D: Stamp Duty scales with ₹1 Crore (₹7 Lakhs)', resD.stampDuty === 700000, `Stamp Duty: ₹${resD.stampDuty}`);

    // -------------------------------------------------------------
    // 5. TEST E: User-Provided Cost Overrides
    // -------------------------------------------------------------
    console.log('\n5️⃣ TEST E: User-Provided Cost Overrides:');
    const propE = {
      type: 'rent',
      price: 20000,
      area_sqft: 1200,
      category: 'residential',
      subcategory: 'apartment',
      furnishing: 'unfurnished'
    };
    const overridesE = {
      monthly_maintenance: 4500,
      fitout_budget: 150000,
      other_costs: 8000
    };
    const resE = calculateHiddenCosts(propE, overridesE);

    test('TEST E: User Monthly Maintenance overrides estimate (₹4,500 × 12 = ₹54,000)', resE.maintenance === 54000, `Maintenance: ₹${resE.maintenance}`);
    test('TEST E: User Fit-out budget overrides estimate (₹1,50,000)', resE.fitOut === 150000, `Fit-out: ₹${resE.fitOut}`);
    test('TEST E: User Other costs recorded (₹8,000)', resE.otherCosts === 8000, `Other: ₹${resE.otherCosts}`);
    
    const maintItem = resE.items.find(i => i.key === 'maintenance');
    test('TEST E: Maintenance item badge marked as "Owner Provided"', maintItem && !maintItem.isEstimated && maintItem.badge === 'Owner Provided');

    // -------------------------------------------------------------
    // 6. TEST F: API Endpoints (GET /api/properties/:id/hidden-costs)
    // -------------------------------------------------------------
    console.log('\n6️⃣ TEST F: HTTP Analytics & Hidden Costs Endpoints:');
    const httpRes = await fetch('http://localhost:5000/api/properties/1/hidden-costs').then(r => r.json());
    test('GET /api/properties/1/hidden-costs returns valid response', httpRes.success && !!httpRes.data?.totalEstimatedCost, `Total: ₹${httpRes.data?.totalEstimatedCost}`);
    test('Response includes line items array', Array.isArray(httpRes.data?.items) && httpRes.data.items.length >= 5, `Items Count: ${httpRes.data?.items?.length}`);
    test('Response includes transparent formulas array', Array.isArray(httpRes.data?.formulas) && httpRes.data.formulas.length >= 3, `Formulas Count: ${httpRes.data?.formulas?.length}`);

    // -------------------------------------------------------------
    // 7. TEST G: UI Check - 5-Year Capital Forecast Completely Removed
    // -------------------------------------------------------------
    console.log('\n7️⃣ TEST G: UI Check - 5-Year Capital Forecast Removal:');
    const detailsHtml = fs.readFileSync(path.join(__dirname, '../../property-details.html'), 'utf8');
    test('property-details.html does NOT contain id="forecastSection"', !detailsHtml.includes('id="forecastSection"'));
    test('property-details.html does NOT contain "5-YEAR CAPITAL FORECAST"', !detailsHtml.includes('5-YEAR CAPITAL FORECAST'));
    test('property-details.html does NOT contain "Appreciation & Liquidity"', !detailsHtml.includes('Appreciation & Liquidity'));
    test('property-details.html preserves Hidden Cost Engine (#hiddenCostContainer)', detailsHtml.includes('id="hiddenCostContainer"'));
    test('property-details.html preserves Locality LifeScore Radar (#localitySection)', detailsHtml.includes('id="localitySection"'));

    console.log('\n================================================================');
    console.log(`📊 RESULTS: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
    console.log('================================================================\n');

    await pool.end();
  } catch (err) {
    console.error('Test execution error:', err);
    try { await pool.end(); } catch (e) {}
  }
}

runHiddenCostEngineTests();
