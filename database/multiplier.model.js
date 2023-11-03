module.exports = (sequelize, DataTypes) => {
    const Multiplier = sequelize.define('multiplier', {
        pointsMultiplier: DataTypes.INTEGER
    });

    return Multiplier;
}