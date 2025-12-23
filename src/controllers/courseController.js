const db = require('../models');
const Course = db.Course;
const Department = db.Department;
const CourseSection = db.CourseSection;
const { Op } = require('sequelize');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const { ACTIVE_SEMESTER, ACTIVE_YEAR } = require('../config/systemConfig');

// @desc    Tüm dersleri getir (Arama, Filtreleme, Sayfalama)
// @route   GET /api/v1/courses
// @access  Private (Herkes görebilir)
exports.getAllCourses = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100; // Limit artırıldı
  const offset = (page - 1) * limit;

  const { search, department_id, active_term_only } = req.query;
  const whereClause = {};

  // Departmana göre filtrele
  if (department_id) {
    whereClause.departmentId = department_id;
  }

  // Arama (Kod veya İsim)
  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } }, // Case-insensitive (Postgres)
      { code: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Eğer active_term_only=true ise, sadece aktif dönemde şubesi olan dersleri göster
  let includeOptions = [
    { model: Department, as: 'department', attributes: ['id', 'name', 'code'] }
  ];

  if (active_term_only === 'true' || active_term_only === true) {
    // Aktif dönemde şubesi olan dersleri filtrele
    includeOptions.push({
      model: CourseSection,
      as: 'sections',
      where: {
        semester: ACTIVE_SEMESTER,
        year: ACTIVE_YEAR
      },
      required: true, // INNER JOIN - sadece şubesi olan dersler
      attributes: [] // Section detaylarını getirme
    });
  }

  const { count, rows } = await Course.findAndCountAll({
    where: whereClause,
    limit,
    offset,
    include: includeOptions,
    distinct: true, // Section join'i nedeniyle duplicate'leri önle
    order: [['code', 'ASC']]
  });

  res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    }
  });
});

// @desc    Tek bir dersi getir
// @route   GET /api/v1/courses/:id
exports.getCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findByPk(req.params.id, {
    include: [
      { 
        model: Course, 
        as: 'prerequisite', // <--- DÜZELTİLDİ: 'prerequisites' değil 'prerequisite'
        attributes: ['id', 'code', 'name'] 
      },
      {
        model: Department,
        as: 'department',
        attributes: ['name']
      }
    ]
  });

  if (!course) {
    return next(new ErrorResponse(`Ders bulunamadı (ID: ${req.params.id})`, 404));
  }

  res.status(200).json({
    success: true,
    data: course
  });
});

// @desc    Yeni ders oluştur
// @route   POST /api/v1/courses
// @access  Private (Sadece Admin)
exports.createCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.create(req.body);

  // Eğer ön koşul ders ID'leri gönderildiyse ekle
  if (req.body.prerequisites && Array.isArray(req.body.prerequisites)) {
    await course.setPrerequisites(req.body.prerequisites);
  }

  res.status(201).json({
    success: true,
    data: course
  });
});

// @desc    Ders güncelle
// @route   PUT /api/v1/courses/:id
// @access  Private (Sadece Admin)
exports.updateCourse = asyncHandler(async (req, res, next) => {
  let course = await Course.findByPk(req.params.id);

  if (!course) {
    return next(new ErrorResponse(`Ders bulunamadı (ID: ${req.params.id})`, 404));
  }

  course = await course.update(req.body);

  // Ön koşulları güncelle
  if (req.body.prerequisites && Array.isArray(req.body.prerequisites)) {
    await course.setPrerequisites(req.body.prerequisites);
  }

  res.status(200).json({
    success: true,
    data: course
  });
});

// @desc    Ders sil
// @route   DELETE /api/v1/courses/:id
// @access  Private (Sadece Admin)
exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findByPk(req.params.id);

  if (!course) {
    return next(new ErrorResponse(`Ders bulunamadı (ID: ${req.params.id})`, 404));
  }

  await course.destroy();

  res.status(200).json({
    success: true,
    data: {}
  });
});