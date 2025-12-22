module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    category: DataTypes.STRING, // Conference, Social, Sports
    date: DataTypes.DATEONLY,
    start_time: DataTypes.TIME,
    end_time: DataTypes.TIME,
    location: DataTypes.STRING,
    capacity: DataTypes.INTEGER,
    registered_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_paid: { type: DataTypes.BOOLEAN, defaultValue: false },
    price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    registration_deadline: DataTypes.DATEONLY,
    status: { type: DataTypes.ENUM('active', 'cancelled', 'completed'), defaultValue: 'active' }
  });

  Event.associate = (models) => {
    Event.hasMany(models.EventRegistration, { foreignKey: 'event_id' });
  };

  return Event;
};