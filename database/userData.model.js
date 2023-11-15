module.exports = (sequelize, DataTypes) => {
    const UserData = sequelize.define('userdata', {
        points: DataTypes.FLOAT,
        pnl: DataTypes.FLOAT,
        username: DataTypes.STRING
    });

    return UserData;
}