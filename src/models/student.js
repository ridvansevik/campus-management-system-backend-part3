module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define('Student', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    student_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    gpa: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0
    },
    current_semester: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    is_scholarship: { // Part 3: Yemekhane için eklendi
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });

  Student.associate = (models) => {
    Student.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Student.belongsTo(models.Department, { foreignKey: 'departmentId', as: 'department' });
    Student.hasMany(models.Enrollment, { foreignKey: 'studentId', as: 'enrollments' });
    Student.hasMany(models.AttendanceRecord, { foreignKey: 'studentId' });
  };

  return Student;
};