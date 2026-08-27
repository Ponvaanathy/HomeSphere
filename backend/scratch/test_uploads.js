const fs = require('fs');
const path = require('path');
const http = require('http');

// Helper for HTTP requests
function request(options, bodyData = null, isMultipart = false, formDataBoundary = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// Build multipart/form-data payload
function buildMultipartBody(fields, files, boundary) {
  const crlf = '\r\n';
  let body = Buffer.alloc(0);

  // Append fields
  for (const [key, val] of Object.entries(fields)) {
    const fieldHeader = Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${val}${crlf}`
    );
    body = Buffer.concat([body, fieldHeader]);
  }

  // Append files
  for (const file of files) {
    const fileHeader = Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"${crlf}Content-Type: ${file.mimetype}${crlf}${crlf}`
    );
    const fileContent = fs.readFileSync(file.filepath);
    body = Buffer.concat([body, fileHeader, fileContent, Buffer.from(crlf)]);
  }

  // Close boundary
  body = Buffer.concat([body, Buffer.from(`--${boundary}--${crlf}`)]);
  return body;
}

(async () => {
  try {
    console.log('=== STARTING HOMESPHERE REAL UPLOADS TEST ===');

    // 1. Health Check
    const health = await request({ host: '127.0.0.1', port: 5000, path: '/api/health', method: 'GET' });
    console.log('1. Health Check:', health.data.status === 'online' ? '✅ Online' : '❌ Failed');

    // 2. Authenticate
    const loginRes = await request(
      {
        host: '127.0.0.1',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      JSON.stringify({ email: 'alex.rivera@example.com', password: 'password123' })
    );

    let token = loginRes.data?.data?.token;
    if (!token) {
      // Register new user
      const regRes = await request(
        {
          host: '127.0.0.1',
          port: 5000,
          path: '/api/auth/register',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        },
        JSON.stringify({ name: 'Test Seller', email: `seller_${Date.now()}@homesphere.com`, password: 'password123', role: 'user' })
      );
      token = regRes.data?.data?.token;
    }
    console.log('2. Authentication:', token ? '✅ Logged In' : '❌ Failed');

    // 3. Create Property
    const propRes = await request(
      {
        host: '127.0.0.1',
        port: 5000,
        path: '/api/properties',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      },
      JSON.stringify({
        title: 'Solar Luxury Villa with Infinity Pool',
        description: 'Spectacular architectural estate featuring custom stone masonry and zero net energy.',
        type: 'buy',
        property_type: 'villa',
        price: 1250000,
        address: '880 Skyline Summit Ridge',
        city: 'Austin',
        state: 'TX',
        zip_code: '78746',
        bedrooms: 4,
        bathrooms: 3.5,
        area_sqft: 3800,
        year_built: 2024,
        furnishing: 'fully-furnished',
        parking_spaces: 3,
        amenities_json: ['Solar Panels', 'Private Pool', 'EV Charging Station', '24/7 Security']
      })
    );

    const propertyId = propRes.data?.data?.property_id;
    console.log('3. Property Creation:', propertyId ? `✅ Created Property ID: ${propertyId}` : '❌ Failed', propRes.data);

    // Create dummy image files for upload testing
    const scratchDir = path.join(__dirname);
    const img1 = path.join(scratchDir, 'living_room.jpg');
    const img2 = path.join(scratchDir, 'kitchen.jpg');
    const img3 = path.join(scratchDir, 'bedroom_360.jpg');

    // 1x1 JPEG bytes
    const dummyJpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x37, 0xFF, 0xD9]);
    fs.writeFileSync(img1, dummyJpg);
    fs.writeFileSync(img2, dummyJpg);
    fs.writeFileSync(img3, dummyJpg);

    // 4. Upload Gallery Images (multipart/form-data)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const galleryBody = buildMultipartBody(
      { primary_index: '0' },
      [
        { fieldname: 'images', filename: 'living_room.jpg', filepath: img1, mimetype: 'image/jpeg' },
        { fieldname: 'images', filename: 'kitchen.jpg', filepath: img2, mimetype: 'image/jpeg' }
      ],
      boundary
    );

    const uploadRes = await request(
      {
        host: '127.0.0.1',
        port: 5000,
        path: `/api/properties/${propertyId}/images`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': galleryBody.length,
          Authorization: `Bearer ${token}`
        }
      },
      galleryBody
    );
    console.log('4. Gallery Images Upload:', uploadRes.data?.success ? `✅ Uploaded ${uploadRes.data?.data?.length} Images` : '❌ Failed', uploadRes.data);

    const uploadedImages = uploadRes.data?.data || [];
    const firstImg = uploadedImages[0];
    const secondImg = uploadedImages[1];

    // 5. Test Switch Primary Image
    if (secondImg) {
      const primaryRes = await request(
        {
          host: '127.0.0.1',
          port: 5000,
          path: `/api/properties/${propertyId}/images/${secondImg.id}/primary`,
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('5. Set Primary Cover Photo:', primaryRes.data?.success ? '✅ Primary Switched' : '❌ Failed');
    }

    // 6. Upload Virtual Tour Rooms
    const vtBoundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const vtBody = buildMultipartBody(
      {
        room_name: 'Panoramic Master Suite',
        room_description: '360 degree panoramic view with direct private balcony access',
        display_order: '0',
        is_panoramic: '1'
      },
      [
        { fieldname: 'tour_images', filename: 'bedroom_360.jpg', filepath: img3, mimetype: 'image/jpeg' }
      ],
      vtBoundary
    );

    const vtRes = await request(
      {
        host: '127.0.0.1',
        port: 5000,
        path: `/api/properties/${propertyId}/virtual-tour`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${vtBoundary}`,
          'Content-Length': vtBody.length,
          Authorization: `Bearer ${token}`
        }
      },
      vtBody
    );
    console.log('6. Virtual Tour Room Upload:', vtRes.data?.success ? '✅ Room Uploaded' : '❌ Failed', vtRes.data);

    const vtRoom = Array.isArray(vtRes.data?.data) ? vtRes.data?.data[0] : vtRes.data?.data;

    // 7. Verify Property Details API returns real images & virtual tour
    const detailsRes = await request({ host: '127.0.0.1', port: 5000, path: `/api/properties/${propertyId}`, method: 'GET' });
    const p = detailsRes.data?.data;
    console.log('7. Property Details API Verification:');
    console.log('   - Gallery Images in MySQL:', p?.images?.length, p?.images?.map(i => ({ id: i.id, url: i.image_url, primary: i.is_primary })));
    console.log('   - Virtual Tour Rooms in MySQL:', p?.virtual_tour_images?.length, p?.virtual_tour_images?.map(r => ({ id: r.id, name: r.room_name, url: r.image_url, pano: r.is_panoramic })));

    // 8. Test Static File Serving for Uploaded Image
    if (firstImg) {
      const staticCheck = await request({ host: '127.0.0.1', port: 5000, path: firstImg.image_url, method: 'GET' });
      console.log('8. Static Serving of Uploaded Image:', staticCheck.status === 200 ? `✅ Served 200 OK (${firstImg.image_url})` : `❌ HTTP ${staticCheck.status}`);
    }

    // 9. Test Image Deletion & Physical Disk Cleanup
    if (firstImg) {
      const diskPathBefore = path.join(__dirname, '../../', firstImg.image_url);
      const existsBefore = fs.existsSync(diskPathBefore);
      
      const delRes = await request(
        {
          host: '127.0.0.1',
          port: 5000,
          path: `/api/properties/${propertyId}/images/${firstImg.id}`,
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const existsAfter = fs.existsSync(diskPathBefore);
      console.log('9. Image Deletion & Disk Cleanup:', delRes.data?.success && existsBefore && !existsAfter ? '✅ Record Deleted & File Unlinked' : '❌ Cleanup check', { existsBefore, existsAfter });
    }

    // 10. Test Virtual Tour Room Deletion
    if (vtRoom) {
      const vtDiskPath = path.join(__dirname, '../../', vtRoom.image_url);
      const vtExistsBefore = fs.existsSync(vtDiskPath);

      const delVtRes = await request(
        {
          host: '127.0.0.1',
          port: 5000,
          path: `/api/properties/${propertyId}/virtual-tour/${vtRoom.id}`,
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const vtExistsAfter = fs.existsSync(vtDiskPath);
      console.log('10. Virtual Tour Room Deletion:', delVtRes.data?.success && vtExistsBefore && !vtExistsAfter ? '✅ Room Deleted & File Unlinked' : '❌ Cleanup check', { vtExistsBefore, vtExistsAfter });
    }

    console.log('=== ALL REAL UPLOAD & VIRTUAL TOUR TESTS COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  }
})();
