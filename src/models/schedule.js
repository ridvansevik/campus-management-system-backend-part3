module.exports = (sequelize, DataTypes) => {
  const Schedule = sequelize.define('Schedule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    classroom_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    day_of_week: {
      type: DataTypes.ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    }
  });

  Schedule.associate = (models) => {
    Schedule.belongsTo(models.CourseSection, { foreignKey: 'section_id', as: 'section' });
    Schedule.belongsTo(models.Classroom, { foreignKey: 'classroom_id', as: 'classroom' });
  };

  return Schedule;
};