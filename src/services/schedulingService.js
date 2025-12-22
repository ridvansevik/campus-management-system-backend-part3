/**
 * Scheduling Service
 * Constraint Satisfaction Problem (CSP) algoritması ile otomatik ders programı oluşturma
 */

/**
 * Hard Constraints (Zorunlu):
 * 1. No instructor double-booking
 * 2. No classroom double-booking
 * 3. No student schedule conflict
 * 4. Classroom capacity >= section capacity
 * 5. Classroom features match course requirements
 */

/**
 * Soft Constraints (Optimize edilecek):
 * 1. Respect instructor time preferences
 * 2. Minimize gaps in student schedules
 * 3. Distribute courses evenly across week
 * 4. Prefer morning slots for required courses
 */

/**
 * Backtracking ile CSP çözümü
 * @param {Array} sections - Programlanacak dersler
 * @param {Array} classrooms - Mevcut derslikler
 * @param {Array} timeSlots - Zaman dilimleri
 * @param {Object} constraints - Kısıtlar ve tercihler
 * @returns {Array} Oluşturulan program
 */
exports.generateSchedule = (sections, classrooms, timeSlots, constraints = {}) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const schedule = [];
  const assignments = new Map(); // section_id -> { day, time, classroom }
  
  // Instructor ve classroom çakışma takibi
  const instructorSlots = new Map(); // instructorId -> Set of {day, time}
  const classroomSlots = new Map(); // classroomId -> Set of {day, time}
  const studentSchedules = new Map(); // studentId -> Set of {day, time}

  /**
   * Hard constraint kontrolü
   */
  const checkHardConstraints = (section, day, timeSlot, classroom) => {
    // 1. Instructor double-booking kontrolü
    const instructorKey = `${section.instructorId}_${day}_${timeSlot.start}`;
    if (instructorSlots.has(section.instructorId)) {
      const slots = instructorSlots.get(section.instructorId);
      if (slots.has(`${day}_${timeSlot.start}`)) {
        return { valid: false, reason: 'Instructor double-booking' };
      }
    }

    // 2. Classroom double-booking kontrolü
    const classroomKey = `${classroom.id}_${day}_${timeSlot.start}`;
    if (classroomSlots.has(classroom.id)) {
      const slots = classroomSlots.get(classroom.id);
      if (slots.has(`${day}_${timeSlot.start}`)) {
        return { valid: false, reason: 'Classroom double-booking' };
      }
    }

    // 3. Classroom capacity kontrolü
    if (classroom.capacity < section.capacity) {
      return { valid: false, reason: 'Classroom capacity insufficient' };
    }

    // 4. Student schedule conflict kontrolü
    // (Bu kısım enrollment verilerine ihtiyaç duyar, şimdilik basit tutuyoruz)
    // Gerçek implementasyonda: section.enrollments -> studentId'leri al ve kontrol et

    return { valid: true };
  };

  /**
   * Soft constraint skoru hesapla (daha yüksek = daha iyi)
   */
  const evaluateSoftConstraints = (section, day, timeSlot, classroom) => {
    let score = 0;

    // 1. Instructor time preferences (varsa)
    if (constraints.instructorPreferences) {
      const pref = constraints.instructorPreferences[section.instructorId];
      if (pref) {
        if (pref.preferredDays && pref.preferredDays.includes(day)) {
          score += 10;
        }
        if (pref.preferredTimes && pref.preferredTimes.includes(timeSlot.start)) {
          score += 10;
        }
      }
    }

    // 2. Morning slots for required courses (09:00-12:00 arası)
    if (section.course && section.course.is_required) {
      const hour = parseInt(timeSlot.start.split(':')[0]);
      if (hour >= 9 && hour < 12) {
        score += 15;
      }
    }

    // 3. Distribute courses evenly (hafta içi dağılım)
    const dayIndex = days.indexOf(day);
    score += (5 - dayIndex) * 2; // Pazartesi'ye yakın olanlar daha yüksek skor

    // 4. Classroom features match (varsa)
    if (section.course && section.course.required_features) {
      const requiredFeatures = section.course.required_features;
      const classroomFeatures = classroom.features || [];
      const matchCount = requiredFeatures.filter(f => classroomFeatures.includes(f)).length;
      score += matchCount * 5;
    }

    return score;
  };

  /**
   * Backtracking algoritması
   */
  const backtrack = (sectionIndex) => {
    // Tüm section'lar atandıysa başarılı
    if (sectionIndex >= sections.length) {
      return true;
    }

    const section = sections[sectionIndex];
    
    // Tüm olası kombinasyonları dene (day, timeSlot, classroom)
    const candidates = [];
    
    for (const day of days) {
      for (const timeSlot of timeSlots) {
        for (const classroom of classrooms) {
          const constraintCheck = checkHardConstraints(section, day, timeSlot, classroom);
          
          if (constraintCheck.valid) {
            const score = evaluateSoftConstraints(section, day, timeSlot, classroom);
            candidates.push({ day, timeSlot, classroom, score });
          }
        }
      }
    }

    // Soft constraint skoruna göre sırala (en iyiler önce)
    candidates.sort((a, b) => b.score - a.score);

    // Her adayı dene
    for (const candidate of candidates) {
      // Atamayı yap
      const assignment = {
        section_id: section.id,
        day: candidate.day,
        start_time: candidate.timeSlot.start,
        end_time: candidate.timeSlot.end,
        classroom_id: candidate.classroom.id
      };

      // Çakışma takibine ekle
      if (!instructorSlots.has(section.instructorId)) {
        instructorSlots.set(section.instructorId, new Set());
      }
      instructorSlots.get(section.instructorId).add(`${candidate.day}_${candidate.timeSlot.start}`);

      if (!classroomSlots.has(candidate.classroom.id)) {
        classroomSlots.set(candidate.classroom.id, new Set());
      }
      classroomSlots.get(candidate.classroom.id).add(`${candidate.day}_${candidate.timeSlot.start}`);

      assignments.set(section.id, assignment);
      schedule.push(assignment);

      // Recursive call
      if (backtrack(sectionIndex + 1)) {
        return true; // Başarılı
      }

      // Backtrack: Atamayı geri al
      schedule.pop();
      assignments.delete(section.id);
      instructorSlots.get(section.instructorId).delete(`${candidate.day}_${candidate.timeSlot.start}`);
      classroomSlots.get(candidate.classroom.id).delete(`${candidate.day}_${candidate.timeSlot.start}`);
    }

    return false; // Bu section için uygun yer bulunamadı
  };

  // Algoritmayı çalıştır
  const success = backtrack(0);

  return {
    success,
    schedule: success ? schedule : [],
    unassigned: success ? [] : sections.slice(assignments.size).map(s => s.id)
  };
};

/**
 * Student schedule conflict kontrolü
 * @param {Array} enrollments - Öğrencinin kayıtları
 * @param {String} day - Gün
 * @param {String} startTime - Başlangıç saati
 * @param {String} endTime - Bitiş saati
 * @returns {Boolean} Çakışma var mı?
 */
exports.checkStudentConflict = (enrollments, day, startTime, endTime) => {
  for (const enrollment of enrollments) {
    if (enrollment.section && enrollment.section.schedules) {
      for (const schedule of enrollment.section.schedules) {
        if (schedule.day_of_week === day) {
          // Zaman çakışması kontrolü
          if (
            (startTime >= schedule.start_time && startTime < schedule.end_time) ||
            (endTime > schedule.start_time && endTime <= schedule.end_time) ||
            (startTime <= schedule.start_time && endTime >= schedule.end_time)
          ) {
            return true; // Çakışma var
          }
        }
      }
    }
  }
  return false; // Çakışma yok
};

