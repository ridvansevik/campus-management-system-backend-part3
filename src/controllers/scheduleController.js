const { Schedule, CourseSection, Classroom, Reservation, Enrollment, Student, Faculty, Course, sequelize, User, Department } = require('../models');
const { Op } = require('sequelize');
const schedulingService = require('../services/schedulingService');

// YENİ: Program Detayı (Part 3: GET /api/v1/scheduling/:scheduleId)
exports.getScheduleDetail = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    const schedule = await Schedule.findByPk(scheduleId, {
      include: [
        { 
          model: CourseSection, 
          as: 'section',
          include: [
            { 
              model: Course, 
              as: 'course',
              include: [
                { model: Department, as: 'department' }
              ]
            },
            { 
              model: Faculty, 
              as: 'instructor',
              include: [
                { model: User, attributes: ['id', 'name', 'email'] }
              ]
            }
          ]
        },
        { model: Classroom, as: 'classroom' }
      ]
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Program bulunamadı' });
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Bölüm Bazlı Ders Programı Listesi (Admin için)
exports.getSchedulesByDepartment = async (req, res) => {
  try {
    const { departmentId, semester, year } = req.query;
    
    const whereClause = {};
    if (semester) whereClause.semester = semester;
    if (year) whereClause.year = year;

    // Bölüm bazlı filtreleme için Course üzerinden join yapacağız
    const includeClause = [
      { 
        model: CourseSection, 
        as: 'section',
        include: [
          { 
            model: Course, 
            as: 'course',
            include: [
              { model: Department, as: 'department' }
            ],
            ...(departmentId ? { where: { departmentId } } : {})
          },
          { 
            model: Faculty, 
            as: 'instructor',
            include: [
              { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
            ]
          }
        ],
        ...(Object.keys(whereClause).length > 0 ? { where: whereClause } : {})
      },
      { model: Classroom, as: 'classroom' }
    ];

    const schedules = await Schedule.findAll({
      include: includeClause,
      order: [
        ['day_of_week', 'ASC'],
        ['start_time', 'ASC']
      ]
    });

    // Eğer departmentId varsa, filtreleme yap
    let filteredSchedules = schedules;
    if (departmentId) {
      filteredSchedules = schedules.filter(schedule => 
        schedule.section?.course?.departmentId === departmentId
      );
    }

    res.json({ success: true, data: filteredSchedules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Tüm Bölümlerin Ders Programları (Admin için - Bölüm bazlı gruplandırılmış)
exports.getAllDepartmentSchedules = async (req, res) => {
  try {
    const { semester, year } = req.query;
    
    // Tüm bölümleri çek
    const departments = await Department.findAll({
      order: [['name', 'ASC']]
    });

    // Her bölüm için schedule'ları çek
    const schedulesByDepartment = await Promise.all(
      departments.map(async (department) => {
        const whereClause = {};
        if (semester) whereClause.semester = semester;
        if (year) whereClause.year = year;

        const schedules = await Schedule.findAll({
          include: [
            { 
              model: CourseSection, 
              as: 'section',
              where: whereClause,
              include: [
                { 
                  model: Course, 
                  as: 'course',
                  where: { departmentId: department.id },
                  include: [
                    { model: Department, as: 'department' }
                  ]
                },
                { 
                  model: Faculty, 
                  as: 'instructor',
                  include: [
                    { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
                  ]
                }
              ]
            },
            { model: Classroom, as: 'classroom' }
          ],
          order: [
            ['day_of_week', 'ASC'],
            ['start_time', 'ASC']
          ]
        });

        return {
          department: {
            id: department.id,
            name: department.name,
            code: department.code,
            faculty_name: department.faculty_name
          },
          schedules: schedules
        };
      })
    );

    res.json({ success: true, data: schedulesByDepartment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    
    let schedules = [];

    if (user.role === 'student') {
      // Öğrenci için: Enrollment -> Section -> Schedule
      const student = await Student.findOne({ where: { userId } });
      if (student) {
        const enrollments = await Enrollment.findAll({
          where: { 
            studentId: student.id,
            status: 'enrolled'
          },
          include: [{
            model: CourseSection,
            as: 'section',
            include: [
              { model: Course, as: 'course' },
              { model: Faculty, as: 'instructor' }
            ]
          }]
        });

        const sectionIds = enrollments.map(e => e.sectionId);
        
        schedules = await Schedule.findAll({
          where: { section_id: { [Op.in]: sectionIds } },
          include: [
            { 
              model: CourseSection, 
              as: 'section',
              include: [
                { model: Course, as: 'course' },
                { model: Faculty, as: 'instructor' }
              ]
            },
            { model: Classroom, as: 'classroom' }
          ],
          order: [
            ['day_of_week', 'ASC'],
            ['start_time', 'ASC']
          ]
        });
      }
    } else if (user.role === 'faculty') {
      // Öğretim üyesi için: Verdiği derslerin programı
      const faculty = await Faculty.findOne({ where: { userId } });
      if (faculty) {
        schedules = await Schedule.findAll({
          include: [
            { 
              model: CourseSection, 
              as: 'section',
              where: { instructorId: faculty.id },
              include: [
                { model: Course, as: 'course' }
              ]
            },
            { model: Classroom, as: 'classroom' }
          ],
          order: [
            ['day_of_week', 'ASC'],
            ['start_time', 'ASC']
          ]
        });
      }
    }
    
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Derslik Rezervasyon İsteği
exports.createReservation = async (req, res) => {
  try {
    const { classroomId, date, startTime, endTime, purpose } = req.body;
    
    // Çakışma kontrolü (Basit)
    const conflict = await Reservation.findOne({
      where: {
        classroom_id: classroomId,
        date: date,
        status: 'approved',
        [Op.or]: [
          {
            start_time: { [Op.between]: [startTime, endTime] }
          },
          {
            end_time: { [Op.between]: [startTime, endTime] }
          }
        ]
      }
    });

    if (conflict) {
      return res.status(400).json({ success: false, message: 'Seçilen saatte derslik dolu.' });
    }

    const reservation = await Reservation.create({
      classroom_id: classroomId,
      user_id: req.user.id,
      date,
      start_time: startTime,
      end_time: endTime,
      purpose,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Otomatik Program Oluşturma (Admin) - CSP Algoritması ile
exports.generateSchedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { semester, year, clearExisting = false } = req.body;

    // 1. Mevcut programı temizle (isteğe bağlı)
    if (clearExisting) {
      await Schedule.destroy({ where: {}, transaction: t });
    }

    // 2. Programlanacak dersleri (section) ve derslikleri çek
    const whereClause = {};
    if (semester) whereClause.semester = semester;
    if (year) whereClause.year = year;

    const sections = await CourseSection.findAll({ 
      where: whereClause,
      include: [
        { model: Course, as: 'course' },
        { 
          model: Faculty, 
          as: 'instructor',
          include: [
            { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
          ]
        }
      ]
    });

    // Debug: Section sayısını logla
    console.log(`[Schedule Generation] Bulunan section sayısı: ${sections.length}`, {
      semester,
      year,
      whereClause
    });

    if (sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Seçilen dönem (${semester}) ve yıl (${year}) için hiç ders bulunamadı. Lütfen önce dersler ve şubeler oluşturun.`,
        sections: []
      });
    }

    const classrooms = await Classroom.findAll();

    if (classrooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Hiç derslik bulunamadı. Lütfen önce derslikler oluşturun.',
        classrooms: []
      });
    }

    // 3. Öğrenci kayıtlarını çek (Student schedule conflict kontrolü için)
    const sectionIds = sections.map(s => s.id);
    const enrollments = await Enrollment.findAll({
      where: {
        sectionId: { [Op.in]: sectionIds },
        status: 'enrolled'
      },
      include: [
        { model: Student, as: 'student' },
        { 
          model: CourseSection, 
          as: 'section',
          include: [
            { 
              model: Schedule, 
              as: 'schedules',
              required: false // Mevcut programları da çek (optional)
            }
          ]
        }
      ]
    });

    // Enrollment'ları sectionId'ye göre grupla (Map)
    const studentEnrollmentsMap = new Map();
    for (const enrollment of enrollments) {
      const sectionId = enrollment.sectionId;
      if (!studentEnrollmentsMap.has(sectionId)) {
        studentEnrollmentsMap.set(sectionId, []);
      }
      studentEnrollmentsMap.get(sectionId).push(enrollment);
    }

    // 4. Zaman dilimleri tanımla
    const timeSlots = [
      { start: '09:00', end: '10:40' },
      { start: '11:00', end: '12:40' },
      { start: '13:00', end: '14:40' },
      { start: '15:00', end: '16:40' },
      { start: '17:00', end: '18:40' }
    ];

    // 5. Constraints (şimdilik boş, ileride instructor preferences eklenebilir)
    const constraints = {
      instructorPreferences: {} // İleride eklenebilir
    };

    // 6. CSP algoritması ile program oluştur (studentEnrollmentsMap'i gönder)
    console.log(`[Schedule Generation] CSP algoritması başlatılıyor...`, {
      sectionsCount: sections.length,
      classroomsCount: classrooms.length,
      enrollmentsCount: enrollments.length
    });

    const result = schedulingService.generateSchedule(sections, classrooms, timeSlots, constraints, studentEnrollmentsMap);

    console.log(`[Schedule Generation] CSP sonucu:`, {
      success: result.success,
      scheduleCount: result.schedule?.length || 0,
      unassignedCount: result.unassigned?.length || 0
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: `${result.unassigned?.length || 0} ders için uygun yer bulunamadı.`,
        unassigned: result.unassigned || [],
        schedule: result.schedule || []
      });
    }

    if (!result.schedule || result.schedule.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Program oluşturuldu ancak hiç ders programlanamadı. Lütfen derslik kapasitelerini ve çakışmaları kontrol edin.',
        schedule: [],
        unassigned: result.unassigned || []
      });
    }

    // 6. Oluşturulan programı veritabanına kaydet
    const createdSchedules = [];
    for (const assignment of result.schedule) {
      const schedule = await Schedule.create({
        section_id: assignment.section_id,
        classroom_id: assignment.classroom_id,
        day_of_week: assignment.day,
        start_time: assignment.start_time,
        end_time: assignment.end_time
      }, { transaction: t });

      createdSchedules.push(schedule);

      // Section'ı güncelle (schedule_json)
      const section = sections.find(s => s.id === assignment.section_id);
      if (section) {
        await section.update({
          schedule_json: {
            day: assignment.day,
            time: assignment.start_time,
            room: classrooms.find(c => c.id === assignment.classroom_id)?.code || ''
          }
        }, { transaction: t });
      }
    }

    await t.commit();

    const scheduleIds = createdSchedules.map(s => s.id);
    const populatedSchedules = await Schedule.findAll({
      where: { id: { [Op.in]: scheduleIds } },
      include: [
        { 
          model: CourseSection, 
          as: 'section',
          include: [
            { model: Course, as: 'course' },     // Ders adı için gerekli
            { 
              model: Faculty, 
              as: 'instructor',
              include: [
                { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
              ]
            }  // Hoca adı için gerekli
          ]
        },
        { model: Classroom, as: 'classroom' }     // Sınıf kodu için gerekli
      ],
      order: [['day_of_week', 'ASC'], ['start_time', 'ASC']]
    });
    // Başarı mesajı oluştur
    const successMessage = `${createdSchedules.length} ders başarıyla programlandı. ` +
      `Tüm çakışmalar kontrol edildi: Öğretim üyesi çakışması yok, öğrenci çakışması yok, derslik çakışması yok.`;
    
   res.json({ 
      success: true, 
      message: successMessage,
      data: populatedSchedules,
      stats: {
        totalSections: sections.length,
        scheduledSections: createdSchedules.length,
        totalClassrooms: classrooms.length,
        totalEnrollments: enrollments.length
      }
    });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Rezervasyon Onaylama/Reddetme (Admin)
exports.updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' veya 'rejected'

    const reservation = await Reservation.findByPk(id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Rezervasyon bulunamadı' });

    await reservation.update({ 
      status,
      approved_by: req.user.id
    });

    // Opsiyonel: Bildirim gönder (NotificationService)

    res.json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Rezervasyon Listesi (Part 3: filter by date, classroom, user)
exports.getClassroomReservations = async (req, res) => {
  try {
    const { status, date, classroomId, userId } = req.query;
    const whereClause = {};

    // Part 3: Filter by status, date, classroom, user
    if (status) whereClause.status = status;
    if (date) whereClause.date = date;
    if (classroomId) whereClause.classroom_id = classroomId;
    if (userId) whereClause.user_id = userId;

    // Admin değilse sadece kendi rezervasyonlarını görebilir
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      whereClause.user_id = req.user.id;
    }

    const reservations = await Reservation.findAll({
      where: whereClause,
      include: [
        { model: Classroom },
        { model: User, as: 'requester', attributes: ['id', 'name', 'email'] }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: iCal Export (.ics dosyası oluştur)
exports.exportIcal = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    
    let schedules = [];

    // getMySchedule mantığını kullan
    if (user.role === 'student') {
      const student = await Student.findOne({ where: { userId } });
      if (student) {
        const enrollments = await Enrollment.findAll({
          where: { studentId: student.id, status: 'enrolled' }
        });
        const sectionIds = enrollments.map(e => e.sectionId);
        
        schedules = await Schedule.findAll({
          where: { section_id: { [Op.in]: sectionIds } },
          include: [
            { model: CourseSection, as: 'section', include: [{ model: Course, as: 'course' }] },
            { model: Classroom, as: 'classroom' }
          ]
        });
      }
    } else if (user.role === 'faculty') {
      const faculty = await Faculty.findOne({ where: { userId } });
      if (faculty) {
        schedules = await Schedule.findAll({
          include: [
            { model: CourseSection, as: 'section', where: { instructorId: faculty.id }, include: [{ model: Course, as: 'course' }] },
            { model: Classroom, as: 'classroom' }
          ]
        });
      }
    }

    // iCal formatı oluştur
    const dayMap = { 'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE', 'Thursday': 'TH', 'Friday': 'FR' };
    
    // Haftanın ilk gününü bul (bugünden itibaren)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Pazar, 1=Pazartesi...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Pazartesi'ye kaç gün var
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    let icsContent = "BEGIN:VCALENDAR\r\n";
    icsContent += "VERSION:2.0\r\n";
    icsContent += "PRODID:-//SmartCampus//EN\r\n";
    icsContent += "CALSCALE:GREGORIAN\r\n";

    schedules.forEach(sch => {
      const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(sch.day_of_week);
      if (dayIndex === -1) return;

      const eventDate = new Date(monday);
      eventDate.setDate(monday.getDate() + dayIndex);

      // DTSTART ve DTEND hesapla
      const [startHour, startMin] = sch.start_time.split(':').map(Number);
      const [endHour, endMin] = sch.end_time.split(':').map(Number);

      const dtStart = new Date(eventDate);
      dtStart.setHours(startHour, startMin, 0, 0);

      const dtEnd = new Date(eventDate);
      dtEnd.setHours(endHour, endMin, 0, 0);

      // iCal format: YYYYMMDDTHHMMSS
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
      };

      const rruleDay = dayMap[sch.day_of_week];
      const summary = `${sch.section?.course?.code || 'Ders'} - ${sch.section?.course?.name || 'İsimsiz'}`;
      const location = sch.classroom?.code || 'Derslik';

      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `DTSTART:${formatDate(dtStart)}\r\n`;
      icsContent += `DTEND:${formatDate(dtEnd)}\r\n`;
      icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};COUNT=14\r\n`; // 14 hafta (bir dönem)
      icsContent += `SUMMARY:${summary}\r\n`;
      icsContent += `LOCATION:${location}\r\n`;
      icsContent += `DESCRIPTION:${sch.section?.course?.description || ''}\r\n`;
      icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=my-schedule.ics');
    res.send(icsContent);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: Kaynak Kullanım Raporu (Utilization Report)
exports.getResourceUtilization = async (req, res) => {
  try {
    // Tüm derslikleri çek
    const classrooms = await Classroom.findAll({
      include: [
        { 
          model: Schedule, // Ders programındaki kullanımlar
          required: false 
        },
        {
          model: Reservation, // Rezervasyonlar
          required: false,
          where: { status: 'approved' }
        }
      ]
    });

    const report = classrooms.map(room => {
      // Basit bir kullanım puanı hesaplama
      // Bir haftada toplam slot sayısı (5 gün * 9 saat = 45 slot) varsayalım
      const totalSlotsPerWeek = 45; 
      
      const scheduledSlots = room.Schedules ? room.Schedules.length : 0;
      // Rezervasyonları da kabaca slota çevirelim (her rezervasyon 1 slot sayılsın basitleştirme için)
      const reservationSlots = room.Reservations ? room.Reservations.length : 0;

      const totalUsage = scheduledSlots + reservationSlots;
      const utilizationRate = (totalUsage / totalSlotsPerWeek) * 100;

      return {
        classroomId: room.id,
        code: room.code,
        capacity: room.capacity,
        scheduledCourses: scheduledSlots,
        reservations: reservationSlots,
        utilizationRate: utilizationRate.toFixed(2) + '%'
      };
    });

    // Kullanım oranına göre sırala (En çok kullanılan en üstte)
    report.sort((a, b) => parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate));

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};