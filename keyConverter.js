const fs = require('fs');
const key = fs.readFileSync('./b12-a11-client-firebase-adminsdk-fbsvc-818e3ba087.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)