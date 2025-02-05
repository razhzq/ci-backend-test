require("dotenv").config({ path: "../.env" });
const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const AWS = require("aws-sdk");
AWS.config.update({region: 'us-east-1'})
require("aws-sdk/lib/maintenance_mode_message").suppress = true;
const kms = new AWS.KMS();

const iv = Buffer.from(process.env.IV_KEY, "hex");
const keyAlias = 'arn:aws:kms:us-east-1:541838817617:alias/apedBotBackendKEY';

async function getKMSData(alias) {
  const params = {
    KeyId: alias,
  };

  const response = await kms.describeKey(params).promise();
  return response.KeyMetadata.Arn;
}

async function getKeyFromKMS(hash) {
  const keyArn = await getKMSData(keyAlias);
  const params = {
    CiphertextBlob: Buffer.from(hash, "base64"),
    KeyId: keyArn,
  };

  const { Plaintext } = await kms.decrypt(params).promise();
  return Plaintext.toString();
}

async function encryptKMS(data) {
    const params = {
        KeyId: keyAlias,
        Plaintext: Buffer.from(data, 'utf-8'),
      };
    
      const { CiphertextBlob } = await kms.encrypt(params).promise();
      return CiphertextBlob.toString('base64');
}

module.exports.decryptor = async (hash) => {
  const decryptedData = await getKeyFromKMS(hash);

//   const decipher = crypto.createDecipheriv(algorithm, key, iv);
//   let decryptedData = decipher.update(hash, "hex", "utf8");
//   decryptedData += decipher.final("utf8");

  return decryptedData;
};

module.exports.encryptor = async (hash) => {
  const encryptedKey = await encryptKMS(hash);
  console.log(encryptedKey)

  return encryptedKey;
};
