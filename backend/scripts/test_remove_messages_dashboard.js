const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity';

async function runTests() {
  console.log('========================================================================');
  console.log('💬 TESTING REMOVAL OF DASHBOARD MESSAGES & PRESERVATION OF IN-APP CHAT');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      if (details) console.log(`   ${details}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      if (details) console.error(`   ${details}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------------
  // 1. DASHBOARD UI INSPECTION: NO MESSAGES OPTION IN DASHBOARD
  // ------------------------------------------------------------------------
  console.log('1️⃣ TESTING DASHBOARD NAVIGATION:');
  const dashHtml = fs.readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

  test('dashboard.html does NOT contain a "Messages" sidebar navigation link',
    !dashHtml.includes('href="/messages.html"'),
    'Removed from dashboard.html sidebar'
  );

  test('dashboard.html does NOT contain "Messages" in menu or quick actions',
    !dashHtml.includes('>Messages<') && !dashHtml.includes('> Messages<'),
    'Cleanly removed from dashboard UI'
  );

  // ------------------------------------------------------------------------
  // 2. IN-APP CHAT & CONTACT SELLER PRESERVATION ON PROPERTY DETAILS
  // ------------------------------------------------------------------------
  console.log('\n2️⃣ TESTING IN-APP CHAT PRESERVATION:');
  const propDetailsHtml = fs.readFileSync(path.join(__dirname, '../../property-details.html'), 'utf8');
  test('property-details.html preserves "Chat with Owner" button',
    propDetailsHtml.includes('openInAppChat()') && propDetailsHtml.includes('Chat with Owner'),
    'In-app chat entry point active'
  );

  test('property-details.html preserves In-App Chat Modal (#inAppChatModal)',
    propDetailsHtml.includes('id="inAppChatModal"') && propDetailsHtml.includes('id="modalChatStream"'),
    'In-app modal active'
  );

  const propDetailsJs = fs.readFileSync(path.join(__dirname, '../../js/property-details.js'), 'utf8');
  test('js/property-details.js preserves openInAppChat and handleSendInAppMessage',
    propDetailsJs.includes('openInAppChat') && propDetailsJs.includes('handleSendInAppMessage'),
    'In-app chat handlers active'
  );

  // ------------------------------------------------------------------------
  // 3. BACKEND CHAT APIS & DATABASE STORAGE VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n3️⃣ TESTING IN-APP CHAT API & MESSAGE STORAGE:');

  const [users] = await pool.query('SELECT * FROM users ORDER BY id ASC LIMIT 3');
  const sender = users[0];
  const receiver = users[1] || users[0];

  const senderToken = jwt.sign({ id: sender.id, email: sender.email, name: sender.name, role: sender.role }, JWT_SECRET);

  // Test sending an in-app message
  const testMsgText = `Test In-App Chat Message ${Date.now()}`;
  const sendRes = await fetch('http://localhost:5000/api/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${senderToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      receiver_id: receiver.id,
      property_id: 1,
      message: testMsgText
    })
  }).then(r => r.json());

  test('POST /api/messages sends in-app chat message successfully',
    sendRes.success === true && !!sendRes.data?.id,
    `Message ID: #${sendRes.data?.id}`
  );

  // Verify persistence in MySQL database
  if (sendRes.data?.id) {
    const [msgDb] = await pool.query('SELECT * FROM messages WHERE id = ?', [sendRes.data.id]);
    test('MySQL messages table contains saved in-app chat message',
      msgDb.length === 1 && msgDb[0].message === testMsgText,
      `Stored text: "${msgDb[0]?.message}"`
    );
  }

  // ------------------------------------------------------------------------
  // 4. MULTILINGUAL IN-APP CHAT TRANSLATION API
  // ------------------------------------------------------------------------
  console.log('\n4️⃣ TESTING IN-APP CHAT TRANSLATION:');
  const transRes = await fetch('http://localhost:5000/api/messages/translate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${senderToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: 'Is this property available for immediate possession?',
      target_lang: 'ta'
    })
  }).then(r => r.json());

  test('POST /api/messages/translate translates in-app chat text',
    transRes.success === true && !!transRes.data?.translated_message,
    `Translated: "${transRes.data?.translated_message}"`
  );


  // ------------------------------------------------------------------------
  // 5. REGRESSION CHECK: DASHBOARD TITLE & PROFILE REMAIN HEALTHY
  // ------------------------------------------------------------------------
  console.log('\n5️⃣ REGRESSION TESTING DASHBOARD TITLE & PROFILE:');
  test('dashboard.html retains "HomeSphere Insights" title',
    dashHtml.includes('HomeSphere Insights'),
    'Main title preserved'
  );

  test('dashboard.html retains top profile link',
    dashHtml.includes('id="dashTopProfileLink"'),
    'Top profile link preserved'
  );

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await pool.end();
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
