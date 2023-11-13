module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('user', {
        username: DataTypes.STRING,
        password: DataTypes.STRING,
        chatId: DataTypes.INTEGER
    });

    return User;
}