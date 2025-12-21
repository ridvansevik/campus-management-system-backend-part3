const express = require('express');
const { 
  getMySchedule, exportIcal, // Yeni
  createReservation, getClassroomReservations, updateReservationStatus,generateSchedule // Yeni
} = require('../controllers/scheduleController');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/my-schedule', protect, getMySchedule);
router.post('/reservations', protect, createReservation);
router.post('/generate', protect, authorize('admin'), generateSchedule);
router.put('/reservations/:id/status', protect, authorize('admin'), updateReservationStatus);
router.get('/my-schedule/ical', protect, exportIcal); // iCal indirme
router.get('/reservations', protect, authorize('admin'), getClassroomReservations); // Admin listeleme
module.exports = router;