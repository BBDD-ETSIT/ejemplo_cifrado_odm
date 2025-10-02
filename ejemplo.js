// index.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const secretKey = 'clave-secreta-demo'; // -> en producción usa un gestor de secretos
const ALGO = 'aes-256-ctr';

// derive 32-byte key from passphrase (demo)
const key = crypto.createHash('sha256').update(secretKey).digest();

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16); // 16 bytes IV
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  // guardamos "iv:cipher" en hex
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text; // no tiene formato iv:cipher
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    // si no está cifrado o formato inválido -> devolvemos tal cual
    return text;
  }
}

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, set: encrypt, get: decrypt }
}, {
  toObject: { getters: true },
  toJSON: { getters: true }
});

const User = mongoose.model('User', UserSchema);


// demo de uso:
(async () => {
  await mongoose.connect('mongodb://localhost:27017/test');

  // borrar para demo limpia
  await User.deleteMany({});

  // guardamos (el setter cifrará el campo)
  const u = new User({ name: 'Ana', email: 'ana@example.com' });
  await u.save();

  // documento normal desde Mongoose -> getter lo devuelve descifrado
  const fromDb = await User.findOne({ name: 'Ana' });
  console.log('Desde Mongoose (getter):', fromDb.email); // -> "ana@example.com"

  // documento "raw" -> sin getters (lo que hay realmente en MongoDB)
  const raw = await User.findOne({ name: 'Ana' }).lean();
  console.log('Raw (lo que verías en mongosh):', raw.email); // -> "iv:cipherhex..."

  await mongoose.disconnect();
})();
