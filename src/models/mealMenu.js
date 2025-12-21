module.exports = (sequelize, DataTypes) => {
  const MealMenu = sequelize.define('MealMenu', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cafeteria_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    meal_type: {
      type: DataTypes.ENUM('lunch', 'dinner'),
      allowNull: false
    },
    items_json: { // Çorba, Ana Yemek, Tatlı listesi
      type: DataTypes.JSONB, 
      defaultValue: []
    },
    nutrition_json: { // Kalori bilgileri
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 20.00 // Varsayılan öğrenci fiyatı
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  MealMenu.associate = (models) => {
    MealMenu.belongsTo(models.Cafeteria, { foreignKey: 'cafeteria_id' });
    MealMenu.hasMany(models.MealReservation, { foreignKey: 'menu_id' });
  };

  return MealMenu;
};