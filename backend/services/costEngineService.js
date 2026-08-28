/**
 * HomeSphere - Dynamic Hidden Cost Engine Service
 * Central Configurable Rules, Mathematical Models & Transparent Line-by-Line Calculations
 */

const COST_CONFIG = {
  // Statutory and Market Benchmarks
  stampDuty: {
    sale_residential: { rate: 0.07, label: 'Statutory Stamp Duty (7.0%)' },
    sale_commercial: { rate: 0.08, label: 'Commercial Conveyance Stamp Duty (8.0%)' },
    sale_land_plots: { rate: 0.07, label: 'Land Conveyance Stamp Duty (7.0%)' },
    rent: { rate: 0.01, label: 'Tenancy Agreement Stamp Duty (1.0% of Annual Rent)' },
    lease: { rate: 0.01, label: 'Long-term Lease Stamp Duty (1.0% of Lease Consideration)' }
  },
  registration: {
    sale: { rate: 0.01, label: 'Registration Fee (1.0% of Property Value)' },
    rent: {
      tiers: [
        { maxRent: 20000, fee: 1000, label: 'Standard Tenancy e-Registration & Documentation (₹1,000)' },
        { maxRent: 50000, fee: 1500, label: 'Mid-Tier Tenancy e-Registration & Documentation (₹1,500)' },
        { maxRent: Infinity, fee: 2500, label: 'Premium Tenancy e-Registration & Notary (₹2,500)' }
      ]
    },
    lease: { fee: 2000, label: 'Lease Agreement Registration & Notary (₹2,000)' }
  },
  maintenancePerSqftMonthly: {
    apartment: 3.0,
    gated_community_home: 2.5,
    villa: 2.0,
    individual_home: 1.5,
    penthouse: 3.5,
    duplex: 2.5,
    commercial: 5.0,
    residential_plot: 0.5,
    commercial_plot: 1.0,
    pg: 4.0,
    default: 2.5
  },
  fitoutPerSqft: {
    sale: {
      'unfurnished': { rate: 250, label: 'Full Interior Fit-out & Modular Woodwork (₹250/sq.ft)' },
      'semi-furnished': { rate: 120, label: 'Modular Kitchen, Wardrobes & Fixtures (₹120/sq.ft)' },
      'fully-furnished': { rate: 40, label: 'Minor Customization & Move-in Refresh (₹40/sq.ft)' }
    },
    rent: {
      'unfurnished': { rate: 25, label: 'Essential Move-in Setup & Appliances (₹25/sq.ft)' },
      'semi-furnished': { rate: 10, label: 'Minor Fixtures & Utility Setup (₹10/sq.ft)' },
      'fully-furnished': { rate: 0, fixed: 3000, label: 'Deep Cleaning & Move-in Transition (₹3,000)' }
    },
    lease: {
      'unfurnished': { rate: 50, label: 'Leasehold Space Fit-out & Partitioning (₹50/sq.ft)' },
      'semi-furnished': { rate: 20, label: 'Leasehold Move-in Readiness (₹20/sq.ft)' },
      'fully-furnished': { rate: 0, fixed: 5000, label: 'Deep Cleaning & Key Handover (₹5,000)' }
    }
  },
  propertyTaxAnnualRate: 0.002, // 0.2% for purchase
  legalDueDiligenceBuffer: {
    rate: 0.002,
    min: 8000,
    max: 25000
  }
};

/**
 * Main Calculation Function for any property
 * @param {Object} property Property object from DB or listing form
 * @param {Object} overrides Optional user-provided cost overrides
 * @returns {Object} Comprehensive itemized cost breakdown with formulas and total
 */
function calculateHiddenCosts(property, overrides = {}) {
  const normType = String(property.type || property.listing_type || 'buy').toLowerCase().trim();
  const isRent = normType === 'rent';
  const isLease = normType === 'lease';
  const isSale = !isRent && !isLease; // 'buy' or 'sale'

  const rawPrice = Number(property.price) || 0;
  const areaSqft = Number(property.area_sqft) || Number(property.area) || 1000;
  const category = String(property.category || 'residential').toLowerCase().trim();
  const subtype = String(property.subcategory || property.property_subtype || property.property_type || 'apartment').toLowerCase().trim();
  const furnishing = String(property.furnishing || 'semi-furnished').toLowerCase().trim();

  // User-provided overrides if available (from parameter or DB breakdown_json)
  let dbBreakdown = {};
  if (property.breakdown_json) {
    try {
      dbBreakdown = typeof property.breakdown_json === 'string' ? JSON.parse(property.breakdown_json) : property.breakdown_json;
    } catch (e) {
      dbBreakdown = {};
    }
  }

  const userMonthlyMaint = overrides.monthly_maintenance !== undefined && overrides.monthly_maintenance !== null && overrides.monthly_maintenance !== ''
    ? Number(overrides.monthly_maintenance)
    : (dbBreakdown.monthly_maintenance !== undefined ? Number(dbBreakdown.monthly_maintenance) : (property.maintenance_est_annual ? Number(property.maintenance_est_annual) / 12 : null));

  const userFitout = overrides.fitout_budget !== undefined && overrides.fitout_budget !== null && overrides.fitout_budget !== ''
    ? Number(overrides.fitout_budget)
    : (dbBreakdown.fitout_budget !== undefined ? Number(dbBreakdown.fitout_budget) : null);

  const userOtherCosts = overrides.other_costs !== undefined && overrides.other_costs !== null && overrides.other_costs !== ''
    ? Number(overrides.other_costs)
    : (dbBreakdown.other_costs !== undefined ? Number(dbBreakdown.other_costs) : null);

  let result = {};

  if (isRent) {
    result = calculateRentModel(rawPrice, areaSqft, category, subtype, furnishing, userMonthlyMaint, userFitout, userOtherCosts);
  } else if (isLease) {
    result = calculateLeaseModel(rawPrice, areaSqft, category, subtype, furnishing, userMonthlyMaint, userFitout, userOtherCosts, property.lease_term);
  } else {
    result = calculateSaleModel(rawPrice, areaSqft, category, subtype, furnishing, userMonthlyMaint, userFitout, userOtherCosts);
  }

  return result;
}

/**
 * 1. RENT COST MODEL
 */
function calculateRentModel(monthlyRent, areaSqft, category, subtype, furnishing, userMonthlyMaint, userFitout, userOtherCosts) {
  const annualRent = Math.round(monthlyRent * 12);
  const items = [];
  const formulas = [];

  // Line Item 1: Annual Rent
  items.push({
    key: 'base_rent',
    name: 'Annual Rent (12 Months)',
    amount: annualRent,
    isEstimated: false,
    badge: 'Base Commitment',
    subtitle: `₹${monthlyRent.toLocaleString('en-IN')}/month × 12 months`,
    formula: `₹${monthlyRent.toLocaleString('en-IN')} × 12 = ₹${annualRent.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Annual Rent', formula: `₹${monthlyRent.toLocaleString('en-IN')} × 12 = ₹${annualRent.toLocaleString('en-IN')}`, basis: 'Actual Monthly Rent' });

  // Line Item 2: Stamp Duty / Tenancy Agreement
  const stampRate = COST_CONFIG.stampDuty.rent.rate;
  const stampDuty = Math.max(500, Math.round(annualRent * stampRate));
  items.push({
    key: 'stamp_duty',
    name: 'Tenancy Agreement Stamp Duty',
    amount: stampDuty,
    isEstimated: true,
    badge: 'Estimated ~1%',
    subtitle: 'Standard 11-month residential lease agreement stamp duty',
    formula: `₹${annualRent.toLocaleString('en-IN')} × 1.0% = ₹${stampDuty.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Tenancy Stamp Duty', formula: `₹${annualRent.toLocaleString('en-IN')} (Annual Rent) × 1.0% = ₹${stampDuty.toLocaleString('en-IN')}`, basis: 'State Tenancy Slabs' });

  // Line Item 3: Agreement Registration / Notary Fee
  let regFee = 1000;
  for (const tier of COST_CONFIG.registration.rent.tiers) {
    if (monthlyRent <= tier.maxRent) {
      regFee = tier.fee;
      break;
    }
  }
  items.push({
    key: 'registration',
    name: 'Agreement Drafting & e-Registration',
    amount: regFee,
    isEstimated: true,
    badge: 'Estimated',
    subtitle: 'Notary verification, drafting and e-filing fee buffer',
    formula: `Tiered fee based on monthly rent slab (≤ ₹${monthlyRent.toLocaleString('en-IN')}) = ₹${regFee.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Registration & Drafting', formula: `Rental slab ≤ ₹${monthlyRent.toLocaleString('en-IN')} → ₹${regFee.toLocaleString('en-IN')}`, basis: 'Standard Notary Slabs' });

  // Line Item 4: Annual Society Maintenance
  let annualMaint = 0;
  let maintSubtitle = '';
  let maintFormula = '';
  let isMaintEst = true;

  if (userMonthlyMaint !== null && !isNaN(userMonthlyMaint) && userMonthlyMaint >= 0) {
    annualMaint = Math.round(userMonthlyMaint * 12);
    isMaintEst = false;
    maintSubtitle = `User-provided: ₹${userMonthlyMaint.toLocaleString('en-IN')}/month × 12`;
    maintFormula = `₹${userMonthlyMaint.toLocaleString('en-IN')}/mo × 12 = ₹${annualMaint.toLocaleString('en-IN')}/year`;
    formulas.push({ item: 'Annual Maintenance', formula: maintFormula, basis: 'Owner-Provided Monthly Rate' });
  } else {
    const ratePerSqft = COST_CONFIG.maintenancePerSqftMonthly[subtype] || COST_CONFIG.maintenancePerSqftMonthly.default;
    annualMaint = Math.round(areaSqft * ratePerSqft * 12);
    maintSubtitle = `Estimated: ${areaSqft.toLocaleString('en-IN')} sq.ft × ₹${ratePerSqft}/sq.ft/month × 12`;
    maintFormula = `${areaSqft} sq.ft × ₹${ratePerSqft}/sq.ft/mo × 12 = ₹${annualMaint.toLocaleString('en-IN')}/year`;
    formulas.push({ item: 'Annual Maintenance', formula: maintFormula, basis: 'Area-Scaled Estimation Model' });
  }

  items.push({
    key: 'maintenance',
    name: 'Annual Society Maintenance',
    amount: annualMaint,
    isEstimated: isMaintEst,
    badge: isMaintEst ? 'Estimated' : 'Owner Provided',
    subtitle: maintSubtitle,
    formula: maintFormula
  });

  // Line Item 5: Fit-out / Move-in Setup
  let fitoutCost = 0;
  let fitoutSubtitle = '';
  let fitoutFormula = '';
  let isFitoutEst = true;

  if (userFitout !== null && !isNaN(userFitout) && userFitout >= 0) {
    fitoutCost = Math.round(userFitout);
    isFitoutEst = false;
    fitoutSubtitle = 'User-provided move-in setup budget';
    fitoutFormula = `Owner-specified budget = ₹${fitoutCost.toLocaleString('en-IN')}`;
    formulas.push({ item: 'Fit-out / Move-in Setup', formula: fitoutFormula, basis: 'Owner-Provided Budget' });
  } else {
    const cfg = COST_CONFIG.fitoutPerSqft.rent[furnishing] || COST_CONFIG.fitoutPerSqft.rent['semi-furnished'];
    if (cfg.fixed !== undefined) {
      fitoutCost = cfg.fixed;
      fitoutSubtitle = `${cfg.label} (Fully Furnished)`;
      fitoutFormula = `Fixed deep-cleaning & handover buffer = ₹${fitoutCost.toLocaleString('en-IN')}`;
    } else {
      fitoutCost = Math.round(areaSqft * cfg.rate);
      fitoutSubtitle = `${areaSqft.toLocaleString('en-IN')} sq.ft × ₹${cfg.rate}/sq.ft (${furnishing.replace('_', ' ')})`;
      fitoutFormula = `${areaSqft} sq.ft × ₹${cfg.rate}/sq.ft (${furnishing}) = ₹${fitoutCost.toLocaleString('en-IN')}`;
    }
    formulas.push({ item: 'Fit-out / Move-in Setup', formula: fitoutFormula, basis: `Furnishing Status (${furnishing})` });
  }

  items.push({
    key: 'fitout',
    name: 'Fit-out / Move-in Setup',
    amount: fitoutCost,
    isEstimated: isFitoutEst,
    badge: isFitoutEst ? 'Estimated' : 'Owner Provided',
    subtitle: fitoutSubtitle,
    formula: fitoutFormula
  });

  // Line Item 6: Other Applicable Costs
  let otherAmount = 0;
  let otherSubtitle = 'No additional owner costs specified';
  let isOtherEst = false;

  if (userOtherCosts !== null && !isNaN(userOtherCosts) && userOtherCosts > 0) {
    otherAmount = Math.round(userOtherCosts);
    otherSubtitle = 'Owner-specified additional move-in / society charges';
    formulas.push({ item: 'Other Applicable Costs', formula: `Owner specified = ₹${otherAmount.toLocaleString('en-IN')}`, basis: 'Owner-Provided' });
  } else {
    formulas.push({ item: 'Other Applicable Costs', formula: '₹0 (No arbitrary extra charges added)', basis: 'Zero Extra Charges' });
  }

  items.push({
    key: 'other',
    name: 'Other Applicable Costs',
    amount: otherAmount,
    isEstimated: isOtherEst,
    badge: otherAmount > 0 ? 'Owner Provided' : 'None',
    subtitle: otherSubtitle,
    formula: `₹${otherAmount.toLocaleString('en-IN')}`
  });

  // Calculate strict mathematical SUM of all visible line items
  const totalFirstYearOutlay = items.reduce((acc, it) => acc + it.amount, 0);

  return {
    listingType: 'rent',
    modelTitle: 'First-Year Tenant Outlay Model',
    monthlyRent,
    annualRent,
    stampDuty,
    registration: regFee,
    maintenance: annualMaint,
    fitOut: fitoutCost,
    otherCosts: otherAmount,
    totalEstimatedCost: totalFirstYearOutlay,
    items,
    formulas,
    assumptions: `Tenancy calculation model based on ₹${monthlyRent.toLocaleString('en-IN')}/mo base rent. Includes annual rent (₹${annualRent.toLocaleString('en-IN')}), 1% state tenancy stamp duty (₹${stampDuty.toLocaleString('en-IN')}), standard agreement registration (₹${regFee.toLocaleString('en-IN')}), ${isMaintEst ? 'area-scaled' : 'owner-provided'} annual maintenance (₹${annualMaint.toLocaleString('en-IN')}), and ${isFitoutEst ? 'estimated' : 'owner-provided'} move-in setup for ${furnishing.replace('_', ' ')} specifications (₹${fitoutCost.toLocaleString('en-IN')}). Total strictly equals the sum of all visible line items.`
  };
}

/**
 * 2. BUY / SALE COST MODEL
 */
function calculateSaleModel(propertyPrice, areaSqft, category, subtype, furnishing, userMonthlyMaint, userFitout, userOtherCosts) {
  const items = [];
  const formulas = [];

  // Line Item 1: Property Purchase Price
  items.push({
    key: 'base_price',
    name: 'Property Purchase Price',
    amount: propertyPrice,
    isEstimated: false,
    badge: 'Base Price',
    subtitle: 'Primary agreed transaction value',
    formula: `Base Listing Price = ₹${propertyPrice.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Property Price', formula: `Agreed purchase price = ₹${propertyPrice.toLocaleString('en-IN')}`, basis: 'Listing Value' });

  // Line Item 2: Stamp Duty
  const stampConfig = category === 'commercial' ? COST_CONFIG.stampDuty.sale_commercial : COST_CONFIG.stampDuty.sale_residential;
  const stampRate = stampConfig.rate;
  const stampDuty = Math.round(propertyPrice * stampRate);
  items.push({
    key: 'stamp_duty',
    name: 'Statutory Stamp Duty',
    amount: stampDuty,
    isEstimated: true,
    badge: `Estimated ~${(stampRate * 100).toFixed(0)}%`,
    subtitle: `Conveyance stamp duty on sale deed (~${(stampRate * 100).toFixed(0)}% benchmark)`,
    formula: `₹${propertyPrice.toLocaleString('en-IN')} × ${(stampRate * 100).toFixed(1)}% = ₹${stampDuty.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Stamp Duty', formula: `₹${propertyPrice.toLocaleString('en-IN')} × ${(stampRate * 100).toFixed(1)}% = ₹${stampDuty.toLocaleString('en-IN')}`, basis: 'State Conveyance Slabs' });

  // Line Item 3: Registration Fee
  const regRate = COST_CONFIG.registration.sale.rate;
  const registration = Math.round(propertyPrice * regRate);
  items.push({
    key: 'registration',
    name: 'Sub-Registrar Registration Fee',
    amount: registration,
    isEstimated: true,
    badge: `Estimated ~${(regRate * 100).toFixed(0)}%`,
    subtitle: `Official property registration fee (~${(regRate * 100).toFixed(0)}% benchmark)`,
    formula: `₹${propertyPrice.toLocaleString('en-IN')} × ${(regRate * 100).toFixed(1)}% = ₹${registration.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Registration Fee', formula: `₹${propertyPrice.toLocaleString('en-IN')} × ${(regRate * 100).toFixed(1)}% = ₹${registration.toLocaleString('en-IN')}`, basis: 'Municipal Registration Benchmark' });

  // Line Item 4: Annual Society Maintenance
  let annualMaint = 0;
  let maintSubtitle = '';
  let maintFormula = '';
  let isMaintEst = true;

  if (userMonthlyMaint !== null && !isNaN(userMonthlyMaint) && userMonthlyMaint >= 0) {
    annualMaint = Math.round(userMonthlyMaint * 12);
    isMaintEst = false;
    maintSubtitle = `User-provided: ₹${userMonthlyMaint.toLocaleString('en-IN')}/month × 12`;
    maintFormula = `₹${userMonthlyMaint.toLocaleString('en-IN')}/mo × 12 = ₹${annualMaint.toLocaleString('en-IN')}/year`;
    formulas.push({ item: 'Annual Maintenance', formula: maintFormula, basis: 'Owner-Provided Monthly Rate' });
  } else {
    const ratePerSqft = COST_CONFIG.maintenancePerSqftMonthly[subtype] || COST_CONFIG.maintenancePerSqftMonthly.default;
    annualMaint = Math.round(areaSqft * ratePerSqft * 12);
    maintSubtitle = `Estimated: ${areaSqft.toLocaleString('en-IN')} sq.ft × ₹${ratePerSqft}/sq.ft/month × 12`;
    maintFormula = `${areaSqft} sq.ft × ₹${ratePerSqft}/sq.ft/mo × 12 = ₹${annualMaint.toLocaleString('en-IN')}/year`;
    formulas.push({ item: 'Annual Maintenance', formula: maintFormula, basis: 'Area-Scaled Maintenance Benchmark' });
  }

  items.push({
    key: 'maintenance',
    name: 'Annual Society Maintenance',
    amount: annualMaint,
    isEstimated: isMaintEst,
    badge: isMaintEst ? 'Estimated' : 'Owner Provided',
    subtitle: maintSubtitle,
    formula: maintFormula
  });

  // Line Item 5: Fit-out / Interior Budget
  let fitoutCost = 0;
  let fitoutSubtitle = '';
  let fitoutFormula = '';
  let isFitoutEst = true;

  if (userFitout !== null && !isNaN(userFitout) && userFitout >= 0) {
    fitoutCost = Math.round(userFitout);
    isFitoutEst = false;
    fitoutSubtitle = 'User-provided interior fit-out budget';
    fitoutFormula = `Owner-specified budget = ₹${fitoutCost.toLocaleString('en-IN')}`;
    formulas.push({ item: 'Fit-out / Interior Budget', formula: fitoutFormula, basis: 'Owner-Provided Budget' });
  } else {
    const cfg = COST_CONFIG.fitoutPerSqft.sale[furnishing] || COST_CONFIG.fitoutPerSqft.sale['semi-furnished'];
    fitoutCost = Math.round(areaSqft * cfg.rate);
    fitoutSubtitle = `${areaSqft.toLocaleString('en-IN')} sq.ft × ₹${cfg.rate}/sq.ft (${furnishing.replace('_', ' ')})`;
    fitoutFormula = `${areaSqft} sq.ft × ₹${cfg.rate}/sq.ft (${furnishing}) = ₹${fitoutCost.toLocaleString('en-IN')}`;
    formulas.push({ item: 'Fit-out / Interior Budget', formula: fitoutFormula, basis: `Furnishing Status (${furnishing})` });
  }

  items.push({
    key: 'fitout',
    name: 'Fit-out / Interior Budget',
    amount: fitoutCost,
    isEstimated: isFitoutEst,
    badge: isFitoutEst ? 'Estimated' : 'Owner Provided',
    subtitle: fitoutSubtitle,
    formula: fitoutFormula
  });

  // Line Item 6: Property Tax & Legal Due Diligence
  let otherAmount = 0;
  let otherSubtitle = '';
  let isOtherEst = true;

  if (userOtherCosts !== null && !isNaN(userOtherCosts) && userOtherCosts >= 0) {
    otherAmount = Math.round(userOtherCosts);
    isOtherEst = false;
    otherSubtitle = 'Owner-specified additional costs / society transfer buffer';
    formulas.push({ item: 'Other Applicable Costs', formula: `Owner specified = ₹${otherAmount.toLocaleString('en-IN')}`, basis: 'Owner-Provided' });
  } else {
    const propTax = Math.round(propertyPrice * COST_CONFIG.propertyTaxAnnualRate);
    const legalFee = Math.min(COST_CONFIG.legalDueDiligenceBuffer.max, Math.max(COST_CONFIG.legalDueDiligenceBuffer.min, Math.round(propertyPrice * COST_CONFIG.legalDueDiligenceBuffer.rate)));
    otherAmount = propTax + legalFee;
    otherSubtitle = `Estimated legal title verification buffer (₹${legalFee.toLocaleString('en-IN')}) + 1st year municipal property tax (₹${propTax.toLocaleString('en-IN')})`;
    formulas.push({ item: 'Legal & Property Tax Buffer', formula: `Legal Due Diligence (₹${legalFee.toLocaleString('en-IN')}) + Annual Municipal Tax (0.2% = ₹${propTax.toLocaleString('en-IN')}) = ₹${otherAmount.toLocaleString('en-IN')}`, basis: 'Statutory Benchmark' });
  }

  items.push({
    key: 'other',
    name: 'Legal Due Diligence & Municipal Tax',
    amount: otherAmount,
    isEstimated: isOtherEst,
    badge: isOtherEst ? 'Estimated' : 'Owner Provided',
    subtitle: otherSubtitle,
    formula: `₹${otherAmount.toLocaleString('en-IN')}`
  });

  // Strict SUM of all visible line items
  const totalOutlay = items.reduce((acc, it) => acc + it.amount, 0);

  return {
    listingType: 'sale',
    modelTitle: 'Complete Acquisition Outlay Model',
    propertyPrice,
    stampDuty,
    registration,
    maintenance: annualMaint,
    fitOut: fitoutCost,
    otherCosts: otherAmount,
    totalEstimatedCost: totalOutlay,
    items,
    formulas,
    assumptions: `Acquisition cost model for purchase price ₹${propertyPrice.toLocaleString('en-IN')}. Includes base purchase price (₹${propertyPrice.toLocaleString('en-IN')}), statutory stamp duty (~${(stampRate * 100).toFixed(0)}% = ₹${stampDuty.toLocaleString('en-IN')}), registration fee (~${(regRate * 100).toFixed(0)}% = ₹${registration.toLocaleString('en-IN')}), ${isMaintEst ? 'area-scaled' : 'owner-provided'} annual maintenance (₹${annualMaint.toLocaleString('en-IN')}), ${isFitoutEst ? 'estimated' : 'owner-provided'} fit-out for ${furnishing.replace('_', ' ')} (₹${fitoutCost.toLocaleString('en-IN')}), and legal/tax buffer (₹${otherAmount.toLocaleString('en-IN')}). Total strictly equals the sum of all visible line items.`
  };
}

/**
 * 3. LEASE COST MODEL
 */
function calculateLeaseModel(leaseAmount, areaSqft, category, subtype, furnishing, userMonthlyMaint, userFitout, userOtherCosts, leaseTerm = '12 months') {
  const items = [];
  const formulas = [];

  // Line Item 1: Lease Consideration
  items.push({
    key: 'base_lease',
    name: `Lease Consideration (${leaseTerm})`,
    amount: leaseAmount,
    isEstimated: false,
    badge: 'Agreed Lease',
    subtitle: `Total consideration for ${leaseTerm} term`,
    formula: `Agreed Lease Consideration = ₹${leaseAmount.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Lease Consideration', formula: `Total lease value = ₹${leaseAmount.toLocaleString('en-IN')}`, basis: 'Listing Consideration' });

  // Line Item 2: Lease Stamp Duty
  const stampRate = COST_CONFIG.stampDuty.lease.rate;
  const stampDuty = Math.max(1000, Math.round(leaseAmount * stampRate));
  items.push({
    key: 'stamp_duty',
    name: 'Lease Agreement Stamp Duty',
    amount: stampDuty,
    isEstimated: true,
    badge: 'Estimated ~1%',
    subtitle: `Stamp duty on commercial/residential lease agreement (~1% of lease value)`,
    formula: `₹${leaseAmount.toLocaleString('en-IN')} × 1.0% = ₹${stampDuty.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Lease Stamp Duty', formula: `₹${leaseAmount.toLocaleString('en-IN')} × 1.0% = ₹${stampDuty.toLocaleString('en-IN')}`, basis: 'State Lease Slabs' });

  // Line Item 3: Lease Registration
  const regFee = COST_CONFIG.registration.lease.fee;
  items.push({
    key: 'registration',
    name: 'Lease Deed Registration & Notary',
    amount: regFee,
    isEstimated: true,
    badge: 'Estimated',
    subtitle: 'Sub-registrar lease deed documentation fee',
    formula: `Standard lease registration buffer = ₹${regFee.toLocaleString('en-IN')}`
  });
  formulas.push({ item: 'Lease Registration', formula: `Standard fee buffer = ₹${regFee.toLocaleString('en-IN')}`, basis: 'Statutory Notary Slabs' });

  // Line Item 4: Annual Society Maintenance
  let annualMaint = 0;
  let maintSubtitle = '';
  let maintFormula = '';
  let isMaintEst = true;

  if (userMonthlyMaint !== null && !isNaN(userMonthlyMaint) && userMonthlyMaint >= 0) {
    annualMaint = Math.round(userMonthlyMaint * 12);
    isMaintEst = false;
    maintSubtitle = `User-provided: ₹${userMonthlyMaint.toLocaleString('en-IN')}/month × 12`;
    maintFormula = `₹${userMonthlyMaint.toLocaleString('en-IN')}/mo × 12 = ₹${annualMaint.toLocaleString('en-IN')}/year`;
    formulas.push({ item: 'Annual Maintenance', formula: maintFormula, basis: 'Owner-Provided Monthly Rate' });
  } else {
    const ratePerSqft = COST_CONFIG.maintenancePerSqftMonthly[subtype] || COST_CONFIG.maintenancePerSqftMonthly.default;
    annualMaint = Math.round(areaSqft * ratePerSqft * 12);
    maintSubtitle = `Estimated: ${areaSqft.toLocaleString('en-IN')} sq.ft × ₹${ratePerSqft}/sq.ft/month × 12`;
    maintFormula = `${areaSqft} sq.ft × ₹${ratePerSqft}/sq.ft/mo × 12 = ₹${annualMaint.toLocaleString('en-IN')}/year`;
    formulas.push({ item: 'Annual Maintenance', formula: maintFormula, basis: 'Area-Scaled Maintenance Benchmark' });
  }

  items.push({
    key: 'maintenance',
    name: 'Annual Maintenance Charge',
    amount: annualMaint,
    isEstimated: isMaintEst,
    badge: isMaintEst ? 'Estimated' : 'Owner Provided',
    subtitle: maintSubtitle,
    formula: maintFormula
  });

  // Line Item 5: Fit-out / Setup
  let fitoutCost = 0;
  let fitoutSubtitle = '';
  let isFitoutEst = true;

  if (userFitout !== null && !isNaN(userFitout) && userFitout >= 0) {
    fitoutCost = Math.round(userFitout);
    isFitoutEst = false;
    fitoutSubtitle = 'User-provided lease fit-out budget';
    formulas.push({ item: 'Fit-out / Setup', formula: `Owner specified = ₹${fitoutCost.toLocaleString('en-IN')}`, basis: 'Owner-Provided Budget' });
  } else {
    const cfg = COST_CONFIG.fitoutPerSqft.lease[furnishing] || COST_CONFIG.fitoutPerSqft.lease['semi-furnished'];
    if (cfg.fixed !== undefined) {
      fitoutCost = cfg.fixed;
      fitoutSubtitle = `${cfg.label} (Fully Furnished)`;
    } else {
      fitoutCost = Math.round(areaSqft * cfg.rate);
      fitoutSubtitle = `${areaSqft.toLocaleString('en-IN')} sq.ft × ₹${cfg.rate}/sq.ft (${furnishing.replace('_', ' ')})`;
    }
    formulas.push({ item: 'Fit-out / Setup', formula: `${areaSqft} sq.ft × ₹${cfg.rate || 0}/sq.ft = ₹${fitoutCost.toLocaleString('en-IN')}`, basis: `Furnishing Status (${furnishing})` });
  }

  items.push({
    key: 'fitout',
    name: 'Leasehold Fit-out / Setup',
    amount: fitoutCost,
    isEstimated: isFitoutEst,
    badge: isFitoutEst ? 'Estimated' : 'Owner Provided',
    subtitle: fitoutSubtitle,
    formula: `₹${fitoutCost.toLocaleString('en-IN')}`
  });

  // Line Item 6: Other Applicable Costs
  let otherAmount = 0;
  let otherSubtitle = 'No additional owner costs specified';
  let isOtherEst = false;

  if (userOtherCosts !== null && !isNaN(userOtherCosts) && userOtherCosts > 0) {
    otherAmount = Math.round(userOtherCosts);
    otherSubtitle = 'Owner-specified legal / documentation charges';
    formulas.push({ item: 'Other Applicable Costs', formula: `Owner specified = ₹${otherAmount.toLocaleString('en-IN')}`, basis: 'Owner-Provided' });
  } else {
    formulas.push({ item: 'Other Applicable Costs', formula: '₹0 (No arbitrary extra charges added)', basis: 'Zero Extra Charges' });
  }

  items.push({
    key: 'other',
    name: 'Other Applicable Costs',
    amount: otherAmount,
    isEstimated: isOtherEst,
    badge: otherAmount > 0 ? 'Owner Provided' : 'None',
    subtitle: otherSubtitle,
    formula: `₹${otherAmount.toLocaleString('en-IN')}`
  });

  // Strict SUM
  const totalLeaseOutlay = items.reduce((acc, it) => acc + it.amount, 0);

  return {
    listingType: 'lease',
    modelTitle: 'Total Leasehold Outlay Model',
    leaseAmount,
    leaseTerm,
    stampDuty,
    registration: regFee,
    maintenance: annualMaint,
    fitOut: fitoutCost,
    otherCosts: otherAmount,
    totalEstimatedCost: totalLeaseOutlay,
    items,
    formulas,
    assumptions: `Lease cost model based on ₹${leaseAmount.toLocaleString('en-IN')} total consideration (${leaseTerm}). Includes lease stamp duty (₹${stampDuty.toLocaleString('en-IN')}), registration fee (₹${regFee.toLocaleString('en-IN')}), ${isMaintEst ? 'area-scaled' : 'owner-provided'} annual maintenance (₹${annualMaint.toLocaleString('en-IN')}), and ${isFitoutEst ? 'estimated' : 'owner-provided'} fit-out setup (₹${fitoutCost.toLocaleString('en-IN')}). Total strictly equals the sum of all visible line items.`
  };
}

module.exports = {
  COST_CONFIG,
  calculateHiddenCosts
};
