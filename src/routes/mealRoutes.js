const express = require('express');
const { 
  getMenus, createMenu, updateMenu, deleteMenu, // Yeni eklenenler
  createReservation, getMyReservations, cancelReservation, useReservation 
} = require('../controllers/mealController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/menus', protect, getMenus);
router.post('/reservations', protect, createReservation);
router.get('/reservations/my-reservations', protect, getMyReservations);
router.delete('/reservations/:id', protect, cancelReservation);
router.post('/reservations/use', protect, authorize('staff', 'admin'), useReservation); // Sadece personel
router.post('/menus', protect, authorize('admin', 'staff'), createMenu);
router.put('/menus/:id', protect, authorize('admin', 'staff'), updateMenu);
router.delete('/menus/:id', protect, authorize('admin', 'staff'), deleteMenu);

module.exports = router;