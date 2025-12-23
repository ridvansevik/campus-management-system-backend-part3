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
 * @param {Map} studentEnrollmentsMap - sectionId -> Array of enrollments (öğrenci kayıtları)
 * @returns {Array} Oluşturulan program
 */
exports.generateSchedule = (sections, classrooms, timeSlots, constraints = {}, studentEnrollmentsMap = new Map()) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const schedule = [];
  const assignments = new Map(); // section_id -> { day, time, classroom }
  
  // Çakışma takibi için haritalar
  const instructorSlots = new Map(); // instructorId -> Set of {day_time}
  const classroomSlots = new Map();  // classroomId -> Set of {day_time}
  
  // YENİ: Cohort (Grup) çakışması takibi. 
  // Örn: "Bilgisayar_1_Güz" anahtarı altında toplanan dersler aynı saate konamaz.
  const cohortSlots = new Map();     // "deptId_year_semester" -> Set of {day_time}
  
  // YENİ: Student schedule conflict takibi
  // Her öğrencinin mevcut programını takip et: studentId -> Set of {day_time}
  const studentSlots = new Map();    // studentId -> Set of {day_time}

  /**
   * Hard constraint kontrolü (Zorunlu Kurallar)
   */
  const checkHardConstraints = (section, day, timeSlot, classroom) => {
    const timeKey = `${day}_${timeSlot.start}`;

    // 1. Instructor double-booking kontrolü
    if (instructorSlots.has(section.instructorId)) {
      if (instructorSlots.get(section.instructorId).has(timeKey)) {
        return { valid: false, reason: 'Instructor double-booking' };
      }
    }

    // 2. Classroom double-booking kontrolü
    if (classroomSlots.has(classroom.id)) {
      if (classroomSlots.get(classroom.id).has(timeKey)) {
        return { valid: false, reason: 'Classroom double-booking' };
      }
    }

    // 3. Classroom capacity kontrolü
    if (classroom.capacity < section.capacity) {
      return { valid: false, reason: 'Classroom capacity insufficient' };
    }

    // 4. Student Cohort Conflict (Aynı sınıf/dönem dersleri çakışmamalı) [YENİ]
    if (section.course) {
      const cohortKey = `${section.course.departmentId}_${section.course.year}_${section.course.semester}`;
      if (cohortSlots.has(cohortKey)) {
        if (cohortSlots.get(cohortKey).has(timeKey)) {
          return { valid: false, reason: 'Student cohort conflict (Schedule overlap for same class)' };
        }
      }
    }

    // 5. Student Schedule Conflict (Öğrenci çakışması kontrolü) [YENİ - HARD CONSTRAINT]
    // Bu section'a kayıtlı öğrencilerin diğer dersleriyle çakışma var mı?
    const enrollments = studentEnrollmentsMap.get(section.id) || [];
    for (const enrollment of enrollments) {
      const studentId = enrollment.studentId || enrollment.student?.id;
      if (studentId && studentSlots.has(studentId)) {
        // Öğrencinin bu saatte başka bir dersi var mı?
        if (studentSlots.get(studentId).has(timeKey)) {
          return { valid: false, reason: `Student schedule conflict: Student ${studentId} already has a class at ${timeKey}` };
        }
      }
    }

    return { valid: true };
  };

  /**
   * Soft constraint skoru hesapla (Tercihler)
   */
  const evaluateSoftConstraints = (section, day, timeSlot, classroom) => {
    let score = 0;

    // 1. Instructor time preferences
    if (constraints.instructorPreferences) {
      const pref = constraints.instructorPreferences[section.instructorId];
      if (pref) {
        if (pref.preferredDays && pref.preferredDays.includes(day)) score += 10;
        if (pref.preferredTimes && pref.preferredTimes.includes(timeSlot.start)) score += 10;
      }
    }

    // 2. Morning slots for required courses
    if (section.course && section.course.is_required) {
      const hour = parseInt(timeSlot.start.split(':')[0]);
      if (hour >= 9 && hour < 12) score += 15;
    }

    // 3. Distribute courses evenly (Pazartesi'den Cumaya azalan ağırlık)
    const dayIndex = days.indexOf(day);
    score += (5 - dayIndex) * 2;

    // 4. Classroom features match
    if (section.course && section.course.required_features) {
      const requiredFeatures = section.course.required_features;
      const classroomFeatures = classroom.features || [];
      const matchCount = requiredFeatures.filter(f => classroomFeatures.includes(f)).length;
      score += matchCount * 5;
    }

    return score;
  };

  /**
   * Recursive Backtracking Algoritması
   */
  const backtrack = (sectionIndex) => {
    // Tüm section'lar atandıysa işlem başarılıdır
    if (sectionIndex >= sections.length) {
      return true;
    }

    const section = sections[sectionIndex];
    
    // Olası adayları (gün, saat, sınıf) topla
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

    // Adayları puana göre sırala (Heuristic: En iyi ihtimali önce dene)
    candidates.sort((a, b) => b.score - a.score);

    // Her adayı sırayla dene
    for (const candidate of candidates) {
      const timeKey = `${candidate.day}_${candidate.timeSlot.start}`;
      
      // --- DO --- (Atama Yap)
      
      // 1. Assignment kaydı
      const assignment = {
        section_id: section.id,
        day: candidate.day,
        start_time: candidate.timeSlot.start,
        end_time: candidate.timeSlot.end,
        classroom_id: candidate.classroom.id
      };
      assignments.set(section.id, assignment);
      schedule.push(assignment);

      // 2. Instructor slot kilitle
      if (!instructorSlots.has(section.instructorId)) instructorSlots.set(section.instructorId, new Set());
      instructorSlots.get(section.instructorId).add(timeKey);

      // 3. Classroom slot kilitle
      if (!classroomSlots.has(candidate.classroom.id)) classroomSlots.set(candidate.classroom.id, new Set());
      classroomSlots.get(candidate.classroom.id).add(timeKey);

      // 4. Cohort slot kilitle [YENİ] - DÜZELTME BURADA
      let cohortKey = null;
      if (section.course) {
        cohortKey = `${section.course.departmentId}_${section.course.year}_${section.course.semester}`;
        if (!cohortSlots.has(cohortKey)) cohortSlots.set(cohortKey, new Set());
        cohortSlots.get(cohortKey).add(timeKey);
      }

      // 5. Student slots kilitle [YENİ]
      const enrollments = studentEnrollmentsMap.get(section.id) || [];
      const affectedStudents = [];
      for (const enrollment of enrollments) {
        const studentId = enrollment.studentId || enrollment.student?.id;
        if (studentId) {
          if (!studentSlots.has(studentId)) studentSlots.set(studentId, new Set());
          studentSlots.get(studentId).add(timeKey);
          affectedStudents.push(studentId);
        }
      }

      // --- RECURSE --- (Bir sonraki ders için dene)
      if (backtrack(sectionIndex + 1)) {
        return true; // Zincirleme başarı
      }

      // --- UNDO --- (Backtrack: Atamayı geri al)
      
      schedule.pop();
      assignments.delete(section.id);
      
      instructorSlots.get(section.instructorId).delete(timeKey);
      classroomSlots.get(candidate.classroom.id).delete(timeKey);
      
      // Cohort slot'u geri al - DÜZELTME BURADA
      if (cohortKey) {
        cohortSlots.get(cohortKey).delete(timeKey);
      }

      // Student slots'u geri al [YENİ]
      for (const studentId of affectedStudents) {
        if (studentSlots.has(studentId)) {
          studentSlots.get(studentId).delete(timeKey);
        }
      }
    }

    return false; // Bu section için hiçbir uygun yer bulunamadı, bir önceki adıma dön
  };

  // Algoritmayı başlat
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