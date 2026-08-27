const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure persistent upload directories exist
const uploadsBaseDir = path.join(__dirname, '../../uploads');
const propertyUploadDir = path.join(uploadsBaseDir, 'properties');
const virtualTourUploadDir = path.join(uploadsBaseDir, 'virtual_tours');
const userUploadDir = path.join(uploadsBaseDir, 'users');
const docUploadDir = path.join(uploadsBaseDir, 'documents');

[uploadsBaseDir, propertyUploadDir, virtualTourUploadDir, userUploadDir, docUploadDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for Property Gallery Images
const propertyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, propertyUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `prop-${uniqueSuffix}${ext}`);
  }
});

// Storage configuration for Virtual Tour Room Images
const virtualTourStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, virtualTourUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `tour-${uniqueSuffix}${ext}`);
  }
});

// Storage configuration for User Avatars
const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, userUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

// Storage configuration for Documents
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, docUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// File filter for genuine image types (JPG, JPEG, PNG, WEBP)
const imageFileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype.toLowerCase();

  const isExtAllowed = allowedExtensions.test(ext);
  const isMimeAllowed = ['image/jpeg', 'image/png', 'image/webp', 'image/pjpeg', 'image/x-png'].includes(mimetype);

  if (isExtAllowed && isMimeAllowed) {
    return cb(null, true);
  }
  cb(new Error('Invalid image format! Only real image files (JPG, JPEG, PNG, WEBP) are supported.'), false);
};

const docFileFilter = (req, file, cb) => {
  const allowedExtensions = /pdf|doc|docx|jpeg|jpg|png|webp/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowedExtensions.test(ext)) {
    return cb(null, true);
  }
  cb(new Error('Only PDF, Word, or image documents (PDF, DOC, DOCX, JPG, PNG) are allowed!'), false);
};

const uploadPropertyImages = multer({
  storage: propertyStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
  fileFilter: imageFileFilter
});

const uploadVirtualTourImages = multer({
  storage: virtualTourStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per room image/panorama
  fileFilter: imageFileFilter
});

const uploadUserAvatar = multer({
  storage: userStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFileFilter
});

const uploadDocument = multer({
  storage: docStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: docFileFilter
});

module.exports = {
  uploadPropertyImages,
  uploadVirtualTourImages,
  uploadUserAvatar,
  uploadDocument,
  propertyUploadDir,
  virtualTourUploadDir,
  userUploadDir,
  docUploadDir
};
