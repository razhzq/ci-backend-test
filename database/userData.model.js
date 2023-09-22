module.exports = (sequelize, DataTypes) => {
    const UserData = sequelize.define('userdata', {
        points: DataTypes.FLOAT,
        pnl: DataTypes.FLOAT,
        userName: DataTypes.STRING
    });

    return UserData;
}