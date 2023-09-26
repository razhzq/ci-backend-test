module.exports = (sequelize, DataTypes) => {
    const ErrorLog = sequelize.define('errorlog', {
        error: DataTypes.STRING,
        event: DataTypes.STRING 
    });

    return ErrorLog;
}