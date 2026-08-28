const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authMiddleware } = require('../middleware/authMiddleware');

// All message routes require user authentication
router.use(authMiddleware);

router.get('/conversations', messageController.getConversations);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/thread/:propertyId/:otherUserId', messageController.getThreadMessages);
router.post('/', messageController.sendMessage);
router.patch('/read-all/:propertyId/:otherUserId', messageController.markThreadRead);
router.post('/ai-suggest', messageController.getAISuggestedReply);
router.post('/translate', messageController.translateMessageContent);

module.exports = router;

