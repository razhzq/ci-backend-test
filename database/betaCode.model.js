module.exports = (sequelize, DataTypes) => {
    const BetaCode = sequelize.define('betacode', {
        code: DataTypes.STRING,
        validity: DataTypes.BOOLEAN,
        username: DataTypes.STRING
    });

    return BetaCode;
}