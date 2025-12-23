const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAllEquipment, borrowEquipment, returnEquipment } = require('../controllers/equipmentController');
const router = express.Router();

router.get('/', protect, getAllEquipment);
router.post('/borrow', protect, borrowEquipment);
router.post('/return', protect, authorize('staff', 'admin'), returnEquipment); // İadeyi sadece yetkili onaylar

module.exports = router;