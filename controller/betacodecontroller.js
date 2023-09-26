require('dotenv').config()
const {Sequelize} = require('sequelize');
const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })

const betaCode = require("../database/betaCode.model")(sequelize, Sequelize);



module.exports.createBetaCodes = async (req, res) => {
     const {codes} = req.body;

    try{
        for(let i = 0; i < codes.length; i++) {
            betaCode.create({
                code: codes[i],
                vailidity: true
            })
        }

        res.status(200).json('code successfully created')

    } catch (error) {
        res.status(400).json({
            error: error
        })
    }
    
}

module.exports.useBetaCode = async (req, res) => {
    const {code} = req.body;

    const checkCode = await betaCode.findOne({where: {code: code}})

    try {

        if(checkCode.validity == true) {
            await betaCode.update({validity: false}, {where: {code: code}});
            res.status(200).json(`code ${code} used`);
        } else {
            res.status(400).json(`code ${code} already used`);
        }

    } catch(error) {
        res.status(400).json({
            error: error
        })
    }
}
