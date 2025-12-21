module.exports = (sequelize, DataTypes) => {
  const Cafeteria = sequelize.define('Cafeteria', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    location: DataTypes.STRING,
    capacity: DataTypes.INTEGER
  });
  
  Cafeteria.associate = (models) => {
    Cafeteria.hasMany(models.MealMenu, { foreignKey: 'cafeteria_id' });
  };

  return Cafeteria;
};