const express = require('express');
const { 
  getMySchedule, exportIcal, getScheduleDetail, generateSchedule, getResourceUtilization,
  getSchedulesByDepartment, getAllDepartmentSchedules
} = require('../controllers/scheduleController');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Schedule routes
router.get('/my-schedule', protect, getMySchedule);
router.get('/my-schedule/ical', protect, exportIcal); // iCal indirme
router.get('/departments/all', protect, authorize('admin'), getAllDepartmentSchedules); // Tüm bölümlerin programları
router.get('/departments/:departmentId', protect, authorize('admin'), getSchedulesByDepartment); // Bölüm bazlı program
router.post('/generate', protect, authorize('admin'), generateSchedule);
router.get('/reports/utilization', protect, authorize('admin', 'staff'), getResourceUtilization);
router.get('/:scheduleId', protect, getScheduleDetail); // Part 3: Program detayı (en sonda olmalı)
module.exports = router;