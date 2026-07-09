import { Router } from "express";
import { User } from "../models/user.js";
import { Day1, Day2 } from "../models/data.js";
const routerUser = Router();
routerUser.get('/:nik', async (req, res) => {
    try {
        const { nik } = req.params;
        if (nik) {
            const user = await User.findOne({ nik: nik });
            if (!user) {
                return res.status(404).json({ message: 'User tidak ditemukan' });
            }
            res.json(user);
        }
        if (!nik) {
            return res.status(404).json({ message: 'NIK Null' });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
});
routerUser.get('/cek-absen/:nik', async (req, res) => {
    try {
        const { nik } = req.params;
        const cekDay1 = await Day1.findOne({ nik: String(nik) });
        const cekDay2 = await Day2.findOne({ nik: String(nik) });
        // Kembalikan statusnya (true jika sudah ada, false jika belum)
        res.status(200).json({
            day1: cekDay1 ? true : false,
            day2: cekDay2 ? true : false
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Gagal mengecek status absen" });
    }
});
export default routerUser;
//# sourceMappingURL=routes_user.js.map