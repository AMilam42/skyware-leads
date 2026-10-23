// Makes a staff login line for config.js.  Usage:  node make-login.js <username> <password>
const [user, pass] = process.argv.slice(2);
if (!user || !pass) { console.log('Usage: node make-login.js <username> <password>'); process.exit(1); }
const hash = require('crypto').createHash('sha256').update(`${user.toLowerCase()}:${pass}`).digest('hex');
console.log(`    { username: "${user.toLowerCase()}", passwordHash: "${hash}" },`);
