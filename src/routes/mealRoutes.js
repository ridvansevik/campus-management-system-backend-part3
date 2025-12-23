const express = require('express');
const { 
  getMenus, getMenuDetail, createMenu, updateMenu, deleteMenu,
  createReservation, getMyReservations, cancelReservation, useReservation,
  getCafeterias
} = require('../controllers/mealController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/cafeterias', protect, getCafeterias);
router.get('/menus', protect, getMenus);
router.get('/menus/:id', protect, getMenuDetail);
router.post('/reservations', protect, createReservation);
router.get('/reservations/my-reservations', protect, getMyReservations);
router.delete('/reservations/:id', protect, cancelReservation);
router.post('/reservations/use', protect, authorize('staff', 'admin'), useReservation); // Part 3: QR kod ile kullanım
router.post('/reservations/:id/use', protect, authorize('staff', 'admin'), useReservation); // Part 3: ID ile kullanım
router.post('/menus', protect, authorize('admin', 'staff'), createMenu);
router.put('/menus/:id', protect, authorize('admin', 'staff'), updateMenu);
router.delete('/menus/:id', protect, authorize('admin', 'staff'), deleteMenu);

module.exports = router;