module.exports = (sequelize, DataTypes) => {
    const ErrorLog = sequelize.define('errorlog', {
        error: DataTypes.STRING,
        event: DataTypes.STRING,
        address: DataTypes.STRING,
        timestamp: DataTypes.DATE 
    });

    return ErrorLog;
}