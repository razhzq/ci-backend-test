const swaggerAutogen = require('swagger-autogen')();

const outputFile = './swagger-output.json';
const endpointsFiles = ['./index.js']; // Replace with your app's entry point or route files

swaggerAutogen(outputFile, endpointsFiles);
