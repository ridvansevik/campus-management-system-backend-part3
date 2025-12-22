const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { protect } = require('../middleware/authMiddleware');

// GET /departments - Public (Register sayfası için gerekli)
// Diğer işlemler için protect middleware gerekli
router.get('/', departmentController.getAllDepartments);

// Diğer route'lar için protect middleware
router.use(protect);
// ... diğer protected route'lar buraya eklenebilir

module.exports = router;