const pool = require('../config/db');

// Helper to escape/sanitize message strings against XSS
const sanitizeText = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * GET /api/messages/conversations
 * Returns all unique conversation threads for the authenticated user,
 * grouped by property and the conversation partner with property details and unread count.
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT m.*, 
              p.title as property_title, p.price as property_price, p.city as property_city, p.type as property_type,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image,
              CASE WHEN m.sender_id = ? THEN u_rec.id ELSE u_snd.id END as other_user_id,
              CASE WHEN m.sender_id = ? THEN u_rec.name ELSE u_snd.name END as other_user_name,
              CASE WHEN m.sender_id = ? THEN u_rec.avatar_url ELSE u_snd.avatar_url END as other_user_avatar,
              CASE WHEN m.sender_id = ? THEN u_rec.role ELSE u_snd.role END as other_user_role
       FROM messages m
       JOIN properties p ON m.property_id = p.id
       JOIN users u_snd ON m.sender_id = u_snd.id
       JOIN users u_rec ON m.receiver_id = u_rec.id
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [userId, userId, userId, userId, userId, userId]
    );

    res.json({
      success: true,
      data: rows || []
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/messages/thread/:propertyId/:otherUserId
 * Returns the full ordered message exchange between logged-in user and other user for a property.
 */
const getThreadMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const propertyId = parseInt(req.params.propertyId);
    const otherUserId = parseInt(req.params.otherUserId);

    if (!propertyId || !otherUserId) {
      return res.status(400).json({ success: false, message: 'Property ID and recipient user ID are required.' });
    }

    // Verify property exists
    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (!propRows || propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    const property = propRows[0];

    // Fetch Other User
    const [userRows] = await pool.query('SELECT id, name, avatar_url, role FROM users WHERE id = ?', [otherUserId]);
    const otherUser = userRows[0] || { id: otherUserId, name: 'Member', avatar_url: '', role: 'user' };

    // Fetch Message History
    const [messages] = await pool.query(
      `SELECT m.*,
              s.name as sender_name, s.avatar_url as sender_avatar,
              r.name as receiver_name, r.avatar_url as receiver_avatar
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       WHERE m.property_id = ? 
         AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
       ORDER BY m.created_at ASC`,
      [propertyId, userId, otherUserId, otherUserId, userId]
    );

    // Automatically mark incoming messages as read
    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE property_id = ? AND receiver_id = ? AND sender_id = ?',
      [propertyId, userId, otherUserId]
    );

    // Fetch primary image for property context header
    const [imgRows] = await pool.query(
      'SELECT image_url FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, id ASC LIMIT 1',
      [propertyId]
    );
    const primaryImage = imgRows?.[0]?.image_url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80';

    res.json({
      success: true,
      data: {
        property: {
          id: property.id,
          title: property.title,
          price: property.price,
          type: property.type,
          city: property.city,
          state: property.state,
          address: property.address,
          owner_id: property.owner_id,
          primary_image: primaryImage
        },
        other_user: otherUser,
        messages: messages || []
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages
 * Sends a message regarding a property to another user.
 */
const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { property_id, receiver_id, message } = req.body;

    if (!property_id || !receiver_id || !message) {
      return res.status(400).json({
        success: false,
        message: 'Property ID, recipient ID, and message text are required.'
      });
    }

    const sanitizedMessage = sanitizeText(message);
    if (!sanitizedMessage || sanitizedMessage.length === 0) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    if (sanitizedMessage.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message cannot exceed 2,000 characters.' });
    }

    // Verify property exists
    const [propRows] = await pool.query('SELECT id, owner_id FROM properties WHERE id = ?', [property_id]);
    if (!propRows || propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Referenced property does not exist.' });
    }

    const [result] = await pool.query(
      'INSERT INTO messages (property_id, sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, ?, 0)',
      [parseInt(property_id), parseInt(senderId), parseInt(receiver_id), sanitizedMessage]
    );

    const newMessageId = result.insertId;

    res.status(201).json({
      success: true,
      message: 'Message delivered securely.',
      data: {
        id: newMessageId,
        property_id: parseInt(property_id),
        sender_id: senderId,
        receiver_id: parseInt(receiver_id),
        message: sanitizedMessage,
        is_read: 0,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/messages/read-all/:propertyId/:otherUserId
 * Marks all unread messages from a sender as read.
 */
const markThreadRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const propertyId = parseInt(req.params.propertyId);
    const otherUserId = parseInt(req.params.otherUserId);

    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE property_id = ? AND receiver_id = ? AND sender_id = ?',
      [propertyId, userId, otherUserId]
    );

    res.json({ success: true, message: 'Thread marked as read.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/messages/unread-count
 * Returns total unread messages count for navbar/dashboard badges.
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      'SELECT COUNT(*) as unread_count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [userId]
    );
    res.json({
      success: true,
      data: { unread_count: rows?.[0]?.unread_count || 0 }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages/ai-suggest
 * Generates 3 smart contextual replies based on property context and recent messages.
 * Does NOT send the message automatically.
 */
const getAISuggestedReply = async (req, res, next) => {
  try {
    const { property_id, last_message, is_seller } = req.body;
    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [property_id]);
    const prop = propRows?.[0] || { title: 'Property', price: 500000, type: 'buy' };

    let suggestions = [];

    const priceFormatted = Number(prop.price).toLocaleString();
    const isRent = prop.type === 'rent';

    if (is_seller) {
      // Seller / Landlord suggested responses
      suggestions = [
        `Thank you for your interest in ${prop.title}! Yes, the property is actively available and ready for showing.`,
        `I would be happy to host a private walkthrough or walk through the 360° virtual tour together. When works best for you?`,
        `We have verified all legal documentation and title deeds. Feel free to submit a formal offer or rental application whenever you're ready.`
      ];
    } else {
      // Buyer / Renter suggested responses
      if (isRent) {
        suggestions = [
          `Hi! I'm interested in leasing this property ($${priceFormatted}/mo). Is it available for immediate move-in?`,
          `Could we schedule an in-person or live guided 360° virtual tour this week?`,
          `Are utilities, parking, or high-speed fiber included in the monthly rent?`
        ];
      } else {
        suggestions = [
          `Hello! I've reviewed the 360° virtual tour and transparency report. Would you be open to discussing reasonable offers near $${priceFormatted}?`,
          `I would love to schedule a private walkthrough this Saturday. What times are available?`,
          `Are the custom fixtures, smart home controls, and solar systems included in the agreed purchase price?`
        ];
      }
    }

    // Contextual refinement if last_message contains keywords
    if (last_message) {
      const lower = last_message.toLowerCase();
      if (lower.includes('negotiab') || lower.includes('price') || lower.includes('discount')) {
        suggestions.unshift(
          is_seller
            ? `We have priced competitively according to neighborhood median benchmarks, but we welcome reasonable serious offers.`
            : `Would you consider an offer with a 10% earnest escrow deposit and a 21-day expedited closing timeline?`
        );
      } else if (lower.includes('visit') || lower.includes('walkthrough') || lower.includes('tour') || lower.includes('see')) {
        suggestions.unshift(
          is_seller
            ? `I have availability on Friday afternoon or Saturday between 1:00 PM and 4:00 PM. Which suits you?`
            : `Saturday at 2:00 PM works great for me. I'll also submit the visit booking through the Schedule Visit tool.`
        );
      }
    }

    res.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 3)
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getConversations,
  getThreadMessages,
  sendMessage,
  markThreadRead,
  getUnreadCount,
  getAISuggestedReply
};
