module.exports = (sequelize, DataTypes) => {
  const EventRegistration = sequelize.define('EventRegistration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    event_id: DataTypes.UUID,
    user_id: DataTypes.UUID,
    registration_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    qr_code: DataTypes.TEXT,
    custom_fields_json: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    checked_in: { type: DataTypes.BOOLEAN, defaultValue: false },
    checked_in_at: DataTypes.DATE
  });

  EventRegistration.associate = (models) => {
    EventRegistration.belongsTo(models.Event, { foreignKey: 'event_id' });
    EventRegistration.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return EventRegistration;
};