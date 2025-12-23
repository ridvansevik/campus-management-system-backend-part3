const { ACTIVE_SEMESTER, ACTIVE_YEAR } = require('../config/systemConfig');
const asyncHandler = require('../middleware/async');

// @desc    Aktif dönem bilgisini getir
// @route   GET /api/v1/system/active-term
// @access  Public (Herkes görebilir)
exports.getActiveTerm = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      semester: ACTIVE_SEMESTER,
      year: ACTIVE_YEAR,
      displayName: `${ACTIVE_YEAR} ${ACTIVE_SEMESTER === 'Fall' ? 'Güz' : ACTIVE_SEMESTER === 'Spring' ? 'Bahar' : 'Yaz'} Dönemi`
    }
  });
});

