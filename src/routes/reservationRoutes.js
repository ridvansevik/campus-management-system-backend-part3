const express = require('express');
const { 
  createReservation, 
  getClassroomReservations, 
  updateReservationStatus 
} = require('../controllers/scheduleController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Part 3: Classroom Reservation Routes
// GET /api/v1/reservations - Rezervasyon listesi (filter by date, classroom, user)
router.get('/', protect, getClassroomReservations);

// POST /api/v1/reservations - Derslik rezerve etme
router.post('/', protect, createReservation);

// PUT /api/v1/reservations/:id/approve - Rezervasyon onaylama (admin)
router.put('/:id/approve', protect, authorize('admin'), async (req, res, next) => {
  req.body.status = 'approved';
  return updateReservationStatus(req, res, next);
});

// PUT /api/v1/reservations/:id/reject - Rezervasyon reddetme (admin)
router.put('/:id/reject', protect, authorize('admin'), async (req, res, next) => {
  req.body.status = 'rejected';
  return updateReservationStatus(req, res, next);
});

module.exports = router;

