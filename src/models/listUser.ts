import mongoose from 'mongoose';

const ListUserSchema = new mongoose.Schema({
  nik: { type: String, required: true, unique: true },
  updatedAt: { type: Date, default: Date.now }
});

export const ListUser = mongoose.model('list_users', ListUserSchema);