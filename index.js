require("dotenv").config();
const cors = require('cors')
const express = require('express')
const { createServer } = require('http')
const bodyParser = require('body-parser')
const Sequelize = require('sequelize')
const db = require('./database/index');

const app = express()

app.use(bodyParser.json())
app.use(cors({
    origin: '*'
 }))


const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: 'postgres', // Replace 'mysql' with your actual database dialect (e.g., 'postgres' or 'sqlite')
  })

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
}).catch(err => {
   console.error('Unable to connect to the database:', err);
});

db.sequelize.sync({force: true}).then(() => {
  console.log("Drop and re-sync db.");
});


//ROUTES




const port = process.env.EA_PORT || 8080

app.listen(port, () => console.log(`app listening on port ${port}!`))



