module.exports = (sequelize, DataTypes) => {
    const UserData = sequelize.define('data', {
        points: DataTypes.FLOAT,
        pnl: DataTypes.FLOAT,
        username: DataTypes.STRING
    });

    return UserData;
}