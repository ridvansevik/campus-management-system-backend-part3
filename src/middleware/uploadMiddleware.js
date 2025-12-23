const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Cloudinary Ayarları
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Custom Storage Engine for Cloudinary v2
const cloudinaryStorage = {
  _handleFile: async (req, file, cb) => {
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'kampus-profil-fotolari',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          return cb(error);
        }
        cb(null, {
          url: result.secure_url,
          public_id: result.public_id,
          ...result,
        });
      }
    );

    stream.pipe(uploadStream);
  },
  _removeFile: (req, file, cb) => {
    // Cloudinary'den silme işlemi (isteğe bağlı)
    if (file.public_id) {
      cloudinary.uploader.destroy(file.public_id, cb);
    } else {
      cb(null);
    }
  },
};

const upload = multer({ 
  storage: cloudinaryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = upload;