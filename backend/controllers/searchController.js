const pool = require('../config/db');

// GET /api/search/suggestions
const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const query = q.trim();

    if (!query || query.length < 2) {
      const [topLocalities] = await pool.query(`
        SELECT address, city, state, lat, lng, COUNT(*) as count
        FROM properties
        WHERE status = 'active' AND lat != 0 AND lng != 0
        GROUP BY address, city, state, lat, lng
        ORDER BY count DESC
        LIMIT 6
      `);
      return res.json({
        success: true,
        data: {
          locations: topLocalities.map((l) => ({
            name: `${l.address ? l.address + ', ' : ''}${l.city}`,
            locality: l.address,
            city: l.city,
            state: l.state,
            lat: Number(l.lat),
            lng: Number(l.lng),
            count: Number(l.count)
          })),
          types: ['apartment', 'villa', 'penthouse', 'townhouse', 'office', 'single_room']
        }
      });
    }

    const [matchedLocations] = await pool.query(
      `SELECT address, city, state, AVG(lat) as lat, AVG(lng) as lng, COUNT(*) as property_count
       FROM properties
       WHERE status = 'active' AND (address LIKE ? OR city LIKE ? OR state LIKE ? OR title LIKE ?)
       GROUP BY address, city, state
       LIMIT 6`,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    );

    const [titleRows] = await pool.query(
      'SELECT id, title, address, city, price, type, lat, lng FROM properties WHERE status = "active" AND title LIKE ? LIMIT 5',
      [`%${query}%`]
    );

    res.json({
      success: true,
      data: {
        locations: matchedLocations.map((r) => ({
          name: `${r.address ? r.address + ', ' : ''}${r.city}`,
          locality: r.address,
          city: r.city,
          state: r.state,
          lat: Number(r.lat),
          lng: Number(r.lng),
          property_count: Number(r.property_count)
        })),
        properties: titleRows.map((p) => ({
          ...p,
          lat: Number(p.lat),
          lng: Number(p.lng)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/search/filter-options
const getFilterOptions = async (req, res, next) => {
  try {
    const [cityRows] = await pool.query('SELECT DISTINCT city FROM properties WHERE status = "active" ORDER BY city ASC');
    const [typeRows] = await pool.query('SELECT DISTINCT property_type FROM properties WHERE status = "active" ORDER BY property_type ASC');
    const [priceStats] = await pool.query('SELECT MIN(price) as min_price, MAX(price) as max_price FROM properties WHERE status = "active"');

    res.json({
      success: true,
      data: {
        cities: cityRows.map((r) => r.city),
        property_types: typeRows.map((r) => r.property_type),
        price_range: {
          min: priceStats[0]?.min_price || 0,
          max: priceStats[0]?.max_price || 3000000
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSearchSuggestions,
  getFilterOptions
};
