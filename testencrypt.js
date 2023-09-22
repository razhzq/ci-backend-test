const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32); // Replace with your secret key
const iv = crypto.randomBytes(16);   // Initialization vector

// Encrypt data
const cipher = crypto.createCipheriv(algorithm, key, iv);
let encryptedData = cipher.update('2xsdsadasd22321sasdsdsadasd', 'utf8', 'hex');
encryptedData += cipher.final('hex');

// Decrypt data
const decipher = crypto.createDecipheriv(algorithm, key, iv);
let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
decryptedData += decipher.final('utf8');


console.log('key: ', key.toString('hex'));
console.log('iv ', iv.toString('hex'));
console.log('Encrypted Data:', encryptedData);
console.log('Decrypted Data:', decryptedData);