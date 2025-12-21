const express = require('express');
const { 
  getEvents, createEvent, updateEvent, deleteEvent, getEventRegistrations, // Yeni eklenenler
  registerEvent, getMyEvents, cancelRegistration, checkInEvent 
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', protect, getEvents);
router.post('/:eventId/register', protect, registerEvent);
router.get('/my-events', protect, getMyEvents);
router.post('/', protect, authorize('admin', 'staff'), createEvent); // Sadece yetkili
router.delete('/registrations/:id', protect, cancelRegistration);
router.post('/:eventId/registrations/:registrationId/checkin', protect, authorize('staff', 'admin'), checkInEvent);
router.get('/', protect, getEvents);
router.post('/', protect, authorize('admin', 'staff'), createEvent);
router.put('/:id', protect, authorize('admin', 'staff'), updateEvent);
router.delete('/:id', protect, authorize('admin', 'staff'), deleteEvent);

router.get('/:eventId/registrations', protect, authorize('admin', 'staff'), getEventRegistrations);
module.exports = router;