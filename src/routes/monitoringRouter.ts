import express from 'express';
// Sesuaikan import model kamu:
import { Day1, Day2 } from '../models/data.js';
import { ListUser } from '../models/listUser.js';
import { User } from '../models/user.js';

const router = express.Router();

router.post('/list-users', async (req, res) => {
  try {
    const { nils, isSemua } = req.body; // Terima parameter isSemua dari frontend

    // 1. Kosongkan daftar monitoring lama agar tidak tumpang tindih
    await ListUser.deleteMany({});

    if (isSemua) {
        // JIKA TOGGLE AKTIF: Ambil semua NIK dari Master Data Karyawan (koleksi User)
        const allUsers = await User.find({}, 'nik').lean();
        
        // Format agar sesuai dengan skema ListUser
        const dataToInsert = allUsers.map(u => ({ nik: String(u.nik).trim() }));
        
        // Masukkan ke koleksi list_users
        await ListUser.insertMany(dataToInsert);
        
        return res.status(200).json({ message: "Seluruh karyawan berhasil dimasukkan" });
    } else {
        // JIKA TOGGLE MATI: Gunakan array NIK (nils) yang diinput manual oleh Admin di modal
        const dataToInsert = nils.map((nik: string) => ({ nik: String(nik).trim() }));
        
        await ListUser.insertMany(dataToInsert);
        
        return res.status(200).json({ message: "Daftar manual berhasil diupdate" });
    }
  } catch (error) {
    console.error("Error saat update list:", error);
    res.status(500).json({ error: "Gagal menyimpan daftar" });
  }
});

router.get('/monitoring/status', async (req, res) => {
    try {
        const targetDay = req.query.day || 'day1';
        const isSemua = req.query.semua === 'true'; // Tangkap status toggle
        const TargetModel = targetDay === 'day2' ? Day2 : Day1;

        let targetNiks: string[] = [];

        if (isSemua) {
            // JIKA TOGGLE AKTIF: Ambil semua NIK dari master data karyawan (User)
            const allUsers = await User.find({}, 'nik').lean();
            targetNiks = allUsers.map(item => String(item.nik).trim());
        } else {
            // JIKA TOGGLE MATI: Ambil dari input manual (ListUser)
            const listData = await ListUser.find({}, 'nik').lean();
            targetNiks = listData.map(item => String(item.nik).trim());
        }

        const totalNik = targetNiks.length;

        if (totalNik === 0) {
            return res.status(200).json({ totalNik: 0, totalBelumAbsen: 0, listBelumAbsen: [] });
        }

        // 2. Cek siapa yang SUDAH absen
        const sudahAbsenData = await TargetModel.find({ nik: { $in: targetNiks } }, 'nik').lean();
        const sudahAbsenNiks = sudahAbsenData.map(item => String(item.nik).trim());

        // 3. Filter yang BELUM absen
        const belumAbsenNiks = targetNiks.filter(nik => !sudahAbsenNiks.includes(nik));

        // 4. Cari Nama Karyawan
        let listBelumAbsen: { nik: string; nama: string }[] = [];
        
        if (belumAbsenNiks.length > 0) {
            const usersInfo = await User.find({ nik: { $in: belumAbsenNiks } }, 'nik nama').lean();
            const userMap = new Map();
            usersInfo.forEach(u => userMap.set(String(u.nik).trim(), u.nama));

            listBelumAbsen = belumAbsenNiks.map(nik => ({
                nik: nik,
                nama: userMap.get(nik) || 'Nama tidak terdaftar di DB'
            }));
        }

        res.status(200).json({
            totalNik,
            totalBelumAbsen: listBelumAbsen.length,
            listBelumAbsen
        });

    } catch (error) {
        console.error("Error Monitoring:", error);
        res.status(500).json({ error: "Gagal memuat data monitoring" });
    }
});

export default router;