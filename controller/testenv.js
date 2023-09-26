require('dotenv').config({ path: "../.env" })

const algorithm = 'aes-256-cbc';
const key = process.env.KEY;
const iv = process.env.IV_KEY;


console.log(key, iv);