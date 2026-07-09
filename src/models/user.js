import { Schema, model } from 'mongoose';
const userSchema = new Schema({
    nik: { type: String, required: true, unique: true },
    nama: { type: String, required: true },
    jabatan: { type: String, required: true }
});
export const User = model('users', userSchema);
//# sourceMappingURL=user.js.map