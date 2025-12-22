const express = require('express');
const { 
  getMySchedule, exportIcal, getScheduleDetail, generateSchedule
} = require('../controllers/scheduleController');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Schedule routes
router.get('/my-schedule', protect, getMySchedule);
router.get('/my-schedule/ical', protect, exportIcal); // iCal indirme
router.get('/:scheduleId', protect, getScheduleDetail); // Part 3: Program detayı
router.post('/generate', protect, authorize('admin'), generateSchedule);

module.exports = router;