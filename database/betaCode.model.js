module.exports = (sequelize, DataTypes) => {
    const BetaCode = sequelize.define('betacode', {
        code: DataTypes.STRING,
        validity: DataTypes.BOOLEAN
    });

    return BetaCode;
}