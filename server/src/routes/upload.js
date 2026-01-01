const express = require('express');
const multer = require('multer');
const ImageKit = require('imagekit');
const { auth, userAuth } = require('../middleware/auth');
const router = express.Router();

// Configure ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Upload image to ImageKit
/*
Example Request:
POST /api/upload/image
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (image file)

Example Response:
{
  "url": "https://ik.imagekit.io/your-id/image.jpg",
  "fileId": "64f8a1b2c3d4e5f6g7h8i9j0",
  "name": "image.jpg"
}
*/
router.post('/image', auth, userAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to ImageKit
    const result = await imagekit.upload({
      file: req.file.buffer.toString('base64'),
      fileName: `${Date.now()}_${req.file.originalname}`,
      folder: '/stackit-images',
      tags: ['user-upload', `user-${req.user._id}`],
    });

    res.json({
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      thumbnailUrl: result.thumbnailUrl,
    });
  } catch (error) {
    console.error('ImageKit upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload image', 
      error: error.message 
    });
  }
});

// Get ImageKit authentication parameters for client-side uploads
/*
Example Request:
GET /api/upload/auth
Authorization: Bearer <token>

Example Response:
{
  "signature": "xxxxx",
  "expire": 1234567890,
  "token": "xxxxx"
}
*/
router.get('/auth', auth, userAuth, async (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.json(authParams);
  } catch (error) {
    console.error('ImageKit auth error:', error);
    res.status(500).json({ 
      message: 'Failed to get authentication parameters', 
      error: error.message 
    });
  }
});

// Helper function to extract ImageKit file IDs from HTML content
const extractImageKitFileIds = (htmlContent) => {
  if (!htmlContent || !process.env.IMAGEKIT_URL_ENDPOINT) return [];
  
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  const regex = new RegExp(`${urlEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^"'\\s]+)`, 'g');
  const fileIds = [];
  let match;
  
  while ((match = regex.exec(htmlContent)) !== null) {
    // Extract the file path after the URL endpoint
    const filePath = match[1];
    fileIds.push(filePath);
  }
  
  return fileIds;
};

// Helper function to delete images from ImageKit
const deleteImagesFromContent = async (htmlContent) => {
  try {
    const filePaths = extractImageKitFileIds(htmlContent);
    
    if (filePaths.length === 0) return;
    
    // Delete each image from ImageKit
    for (const filePath of filePaths) {
      try {
        // Get file details to find the fileId
        const files = await imagekit.listFiles({
          searchQuery: `name="${filePath.split('/').pop()}"`,
        });
        
        if (files && files.length > 0) {
          await imagekit.deleteFile(files[0].fileId);
          console.log(`Deleted image from ImageKit: ${filePath}`);
        }
      } catch (deleteError) {
        console.error(`Failed to delete image ${filePath}:`, deleteError.message);
        // Continue with other deletions even if one fails
      }
    }
  } catch (error) {
    console.error('Error deleting images from ImageKit:', error);
    // Don't throw error - we don't want to prevent content deletion if image deletion fails
  }
};

module.exports = router;
module.exports.deleteImagesFromContent = deleteImagesFromContent;
