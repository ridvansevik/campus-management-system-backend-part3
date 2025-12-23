const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// Aktif dönem bilgisi - Public (herkes görebilir)
router.get('/active-term', systemController.getActiveTerm);

module.exports = router;

