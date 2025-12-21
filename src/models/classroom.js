module.exports = (sequelize, DataTypes) => {
  const Classroom = sequelize.define('Classroom', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: { 
      type: DataTypes.STRING,
      // Seeder'da 'MB-101' gibi kodlar kullandık, unique olması iyi olur
    },
    building: {
      type: DataTypes.STRING,
      allowNull: false
    },
    room_number: {
      type: DataTypes.STRING,
      allowNull: false
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING, // 'lab', 'lecture_hall', etc.
      defaultValue: 'classroom'
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 6)
    },
    longitude: {
        type: DataTypes.DECIMAL(10, 6)
    }
  });

  Classroom.associate = (models) => {
    Classroom.hasMany(models.CourseSection, { foreignKey: 'classroomId' });
    Classroom.hasMany(models.Reservation, { foreignKey: 'classroom_id' });
    Classroom.hasMany(models.Schedule, { foreignKey: 'classroom_id' });
  };

  return Classroom;
};