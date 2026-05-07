import { User } from "../models/user.js";
import router from "./exportRouter.js";

// 1. GET: Ambil Semua Daftar User
router.get('/users', async (req, res) => {
    try {
        // Mengambil semua user dan diurutkan berdasarkan nama (A-Z)
        const users = await User.find().sort({ nik: 1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Gagal mengambil data user' });
    }
});

// 2. POST: Tambah User Baru
router.post('/users', async (req, res) => {
    try {
        const { nik, nama, jabatan } = req.body;

        // Cek apakah NIK sudah dipakai orang lain
        const existingUser = await User.findOne({ nik });
        if (existingUser) {
            return res.status(400).json({ error: 'NIK ini sudah terdaftar!' });
        }

        // Buat user baru
        const newUser = new User({ nik, nama, jabatan });
        await newUser.save();

        res.status(201).json({ message: 'User berhasil ditambahkan', user: newUser });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menambah user' });
    }
});

// 3. DELETE: Hapus User Berdasarkan NIK
router.delete('/users/:nik', async (req, res) => {
    try {
        const { nik } = req.params;
        const deletedUser = await User.findOneAndDelete({ nik });

        if (!deletedUser) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.status(200).json({ message: 'User berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal menghapus user' });
    }
});

export default router;