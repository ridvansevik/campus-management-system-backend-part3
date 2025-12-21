const { Schedule, CourseSection, Classroom, Reservation, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getMySchedule = async (req, res) => {
  try {
    // Burada enrollment üzerinden öğrencinin dersleri çekilip program oluşturulmalı.
    // Şimdilik basitleştirilmiş bir örnek yapıyoruz.
    // Gerçek senaryoda: Enrollment -> Section -> Schedule bağlantısı kurulur.
    
    // Örnek: Tüm programı döndür (MVP için)
    const schedules = await Schedule.findAll({
      include: [
        { 
          model: CourseSection, 
          as: 'section',
          include: [{ model: Course, as: 'course' }] 
        },
        { model: Classroom, as: 'classroom' }
      ]
    });
    
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

// YENİ: Otomatik Program Oluşturma (Admin)
exports.generateSchedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 1. Mevcut programı temizle (İsteğe bağlı, dönemlik temizlik)
    // await Schedule.destroy({ where: {}, transaction: t });

    // 2. Programlanacak dersleri (section) ve derslikleri çek
    const sections = await CourseSection.findAll({ 
      where: { schedule_json: null } // Henüz programlanmamışlar
    });
    const classrooms = await Classroom.findAll();

    const createdSchedules = [];
    const timeSlots = [
      { start: '09:00', end: '11:50' },
      { start: '13:00', end: '15:50' },
      { start: '16:00', end: '18:50' }
    ];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Basit GREEDY Algoritması (Backtracking yerine)
    // Her ders için boş bir yer arar
    for (const section of sections) {
      let scheduled = false;

      for (const day of days) {
        if (scheduled) break;
        for (const slot of timeSlots) {
          if (scheduled) break;
          
          for (const room of classrooms) {
            // Hard Constraint 1: Kapasite
            if (room.capacity < section.capacity) continue;

            // Hard Constraint 2: Çakışma Kontrolü
            // Bu odada, bu gün ve saatte başka ders var mı?
            const conflict = await Schedule.findOne({
              where: {
                classroom_id: room.id,
                day_of_week: day,
                start_time: slot.start
              },
              transaction: t
            });

            if (!conflict) {
              // Uygun bulundu, ata!
              const newSchedule = await Schedule.create({
                section_id: section.id,
                classroom_id: room.id,
                day_of_week: day,
                start_time: slot.start,
                end_time: slot.end
              }, { transaction: t });

              createdSchedules.push(newSchedule);
              
              // Section'ı güncelle
              await section.update({ 
                schedule_json: { day, time: slot.start, room: room.code } 
              }, { transaction: t });

              scheduled = true;
              break; // Diğer odalara bakma, bir sonraki section'a geç
            }
          }
        }
      }
      
      if (!scheduled) {
        console.warn(`Section ${section.id} için uygun yer bulunamadı!`);
      }
    }

    await t.commit();
    res.json({ 
      success: true, 
      message: `${createdSchedules.length} ders başarıyla programlandı.`,
      data: createdSchedules 
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

// YENİ: Rezervasyon Listesi (Admin - Filtreleme ile)
exports.getClassroomReservations = async (req, res) => {
  try {
    const { status, date, classroomId } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (date) whereClause.date = date;
    if (classroomId) whereClause.classroom_id = classroomId;

    const reservations = await Reservation.findAll({
      where: whereClause,
      include: [
        { model: Classroom },
        { model: require('../models').User, as: 'requester', attributes: ['id', 'name'] }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// YENİ: iCal Export (Basit .ics oluşturucu)
exports.exportIcal = async (req, res) => {
  try {
    const userId = req.user.id;
    // Öğrencinin ders programını çek (Basitleştirilmiş)
    const schedules = await Schedule.findAll({
      include: [
        { model: CourseSection, as: 'section', include: [{ model: require('../models').Course, as: 'course' }] },
        { model: Classroom, as: 'classroom' }
      ]
      // Not: Gerçekte Enrollment -> Section -> Schedule ilişkisi kurulmalı
    });

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SmartCampus//EN\n";

    schedules.forEach(sch => {
      // iCal tarih formatı karmaşıktır, burada basitleştirilmiş örnek veriyorum.
      // Gerçek implementasyonda 'ical-generator' paketi kullanmak en iyisidir.
      // Haftalık tekrar eden etkinlikler için RRULE kullanılır.
      
      const dayMap = { 'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE', 'Thursday': 'TH', 'Friday': 'FR' };
      const rruleDay = dayMap[sch.day_of_week];

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `SUMMARY:${sch.section.course.code} - ${sch.section.course.name}\n`;
      icsContent += `LOCATION:${sch.classroom.code}\n`;
      icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay}\n`; 
      // DTSTART ve DTEND hesaplaması o haftanın ilk gününe göre yapılmalı
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename=my-schedule.ics');
    res.send(icsContent);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};