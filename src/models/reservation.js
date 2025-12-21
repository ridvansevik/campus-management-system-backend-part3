module.exports = (sequelize, DataTypes) => {
  const Reservation = sequelize.define('Reservation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    classroom_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: { // Rezervasyonu yapan kişi
      type: DataTypes.UUID,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    approved_by: { // Onaylayan admin ID'si
      type: DataTypes.UUID
    }
  });

  Reservation.associate = (models) => {
    Reservation.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    Reservation.belongsTo(models.User, { foreignKey: 'user_id', as: 'requester' });
    Reservation.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
  };

  return Reservation;
};