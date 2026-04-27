import { Schema, model } from 'mongoose';

// Interface untuk type-safety
interface IUser {
  nik: string;
  nama: string;
  jabatan: string
}

const userSchema = new Schema<IUser>({
  nik: { type: String, required: true, unique: true },
  nama: { type: String, required: true },
  jabatan: {type: String, required: true}
});

export const User = model<IUser>('users', userSchema);
