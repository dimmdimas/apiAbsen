import mongoose from "mongoose";

const daySchema = new mongoose.Schema({
    tanggal: String,
    nik: String,
    nama: String,
    jabatan: String,
    tandaTangan: String,
    type: String,
    waktuMulai: String,
    waktuSelesai: String,
    createdAt: { type: Date, default: Date.now },
    money: Number,
    jam16: Boolean
});

export const Day1 = mongoose.model('Day1', daySchema, 'day1');
export const Day2 = mongoose.model('Day2', daySchema, 'day2');


