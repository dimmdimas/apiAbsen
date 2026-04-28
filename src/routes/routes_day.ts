import { Router, Request, Response } from "express";
import { Day1, Day2 } from "../models/data.js";

const routerData = Router();

const formatTanggalIndo = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-').map(Number);
    const year = parts[0] || 0;
    const month = parts[1] || 1;
    const day = parts[2] || 1;

    const date = new Date(year, month - 1, day); 
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
};

//admin
routerData.post('/day1', async (req: Request, res: Response) => {
    try {
        const { tanggal, money, jam16 } = req.body

        const tanggalFix = formatTanggalIndo(tanggal);

        await Day2.deleteMany({});
        await Day1.deleteMany({});
        await Day1.create({
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16
        })

        res.status(200).json({
            message: 'Day 1 Berasil direset dan dibuat baru!',
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mereset Day 1.' });
    }
})

//admin
routerData.post('/day2', async (req: Request, res: Response) => {
    try {
        const { tanggal, money, jam16 } = req.body

        const tanggalFix = formatTanggalIndo(tanggal);

        await Day2.deleteMany({});
        await Day2.create({
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16
        })

        res.status(200).json({
            message: 'Day 2 Berasil direset dan dibuat baru!',
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mereset Day 2.' });
    }
})

routerData.get('/date', async (req: Request, res: Response) => {
    const targetDay = req.query.targetDay as string;

    try {
        // 2. Tentukan Model mana yang akan dicari datanya
        let SelectedModel;
        if (targetDay === 'day1') {
            SelectedModel = Day1;
        } else if (targetDay === 'day2') {
            SelectedModel = Day2;
        } else {
            return res.status(400).json({ error: 'Parameter targetDay tidak valid (harus day1 atau day2)' });
        }

        // 3. Cari dokumen pertama yang berisi setup tanggal dari Admin
        const adminConfig = await SelectedModel.findOne().sort({ _id: 1 });

        // 4. Jika datanya belum dibuat oleh Admin
        if (!adminConfig || !adminConfig.tanggal) {
            return res.status(404).json({ error: 'Tanggal belum diset oleh Admin' });
        }

        // 5. Berhasil! Kirim tanggalnya ke Frontend
        return res.status(200).json({
            message: 'Berhasil mengambil tanggal',
            tanggal: adminConfig.tanggal,
            jam16: adminConfig.jam16
        });

    } catch (error) {
        console.error("Error mengambil tanggal:", error);
        return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
})

routerData.post('/absen', async (req: Request, res: Response) => {
    try {
        const {
            nik,
            nama,
            posisi,
            tandaTangan,
            targetDay,
            startJam, startMenit, startDetik, // Data Start
            endJam, endMenit, endDetik        // Data End
        } = req.body;

        let SelectedModel;
        if (targetDay === 'day1') {
            SelectedModel = Day1;
        } else if (targetDay === 'day2') {
            SelectedModel = Day2;
        } else {
            return res.status(400).json({ error: 'Hari tidak valid' });
        }

        const adminConfig = await SelectedModel.findOne().sort({ _id: 1 });

        if (!adminConfig) {
            return res.status(404).json({ error: 'Admin belum mengatur tanggal untuk hari ini' });
        }

        const formatWaktuMulai = `${startJam || '00'}:${startMenit || '00'}:${startDetik || '00'}`;
        const formatWaktuSelesai = `${endJam || '00'}:${endMenit || '00'}:${endDetik || '00'}`;

        const absenBaru = new SelectedModel({
            tanggal: adminConfig.tanggal,
            nik: nik,
            nama: nama,
            posisi: posisi,
            tandaTangan: tandaTangan,
            waktuMulai: formatWaktuMulai,     // Simpan hasil gabungan start
            waktuSelesai: formatWaktuSelesai  // Simpan hasil gabungan end
        });

        await absenBaru.save();

        res.status(201).json({ message: `Absen berhasil disimpan di ${targetDay}!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal menyimpan absensi user' });
    }
})

export default routerData;