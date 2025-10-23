import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_CLOUD_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_CLOUD_SECRET || process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  if (!localFilePath) return null;

  // ensure we have a proper absolute path with forward slashes (safe for Cloudinary)
  const resolvedPath = path.resolve(localFilePath).replace(/\\/g, '/');
  try {
    const response = await cloudinary.uploader.upload(resolvedPath, {
      resource_type: 'auto',
    });

    // delete local temp file if exists
    if (fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (e) { console.warn('Failed to delete local file:', e); }
    }

    return response;
  } catch (error) {
  console.error('Cloudinary upload error:', error.message, 'for file:', localFilePath);

  // try to remove the local file if present
  if (localFilePath && fs.existsSync(localFilePath)) {
    console.log("Deleting local file due to upload failure:", localFilePath);
    try {
      fs.unlinkSync(localFilePath);
    } catch (e) {
      console.warn('Failed to delete local file after error:', e);
    }
  }

    return null;
  }
};

export { uploadOnCloudinary };
