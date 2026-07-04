import { Router, Request, Response } from "express";
import { Day1, Day2 } from "../models/data.js";
import { FileModel } from "../models/file.js"; // SESUAIKAN PATH & NAMA MODEL FILE ANDA
import multer from "multer";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";

const routerData = Router();

// --- KONFIGURASI MULTER UNTUK EXCEL ---
const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        const dir = './uploads/excel';
        // Buat folder otomatis jika belum ada
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req: any, file: any, cb: any) => {
        // Format nama file: NIK-Timestamp.ext agar tidak ada nama yang duplikat
        const nikUser = req.body.nik || 'TanpaNIK';
        cb(null, `${nikUser}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file .xls dan .xlsx yang diperbolehkan!'));
        }
    }
});

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

// --- FUNGSI BANTUAN: HAPUS FILE LAMA ---
const hapusFileLama = async () => {
    try {
        const semuaFile = await FileModel.find({});
        for (const file of semuaFile) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path); // Hapus file fisik
            }
        }
        await FileModel.deleteMany({}); // Hapus data di database
        console.log("File Excel dari lembur sebelumnya berhasil dibersihkan.");
    } catch (error) {
        console.error("Gagal menghapus file lama:", error);
    }
};

// --- ROUTE ADMIN: SETUP DAY 1 ---
routerData.post('/day1', async (req: Request, res: Response) => {
    try {
        const { tanggal, money, jam16, jam12 } = req.body;
        const tanggalFix = formatTanggalIndo(tanggal);

        // Bersihkan file Excel lama HANYA saat setup Day 1
        await hapusFileLama();

        await Day2.deleteMany({});
        await Day1.deleteMany({});
        await Day1.create({
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16,
            jam12
        });

        res.status(200).json({
            message: 'Day 1 Berhasil direset! File Excel lama telah dibersihkan.',
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16,
            jam12
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mereset Day 1.' });
    }
});

// --- ROUTE ADMIN: SETUP DAY 2 ---
routerData.post('/day2', async (req: Request, res: Response) => {
    try {
        const { tanggal, money, jam16, jam12 } = req.body;
        const tanggalFix = formatTanggalIndo(tanggal);

        // TIDAK ADA PENGHAPUSAN FILE DI SINI (File Day 1 tetap dipertahankan)

        await Day2.deleteMany({});
        await Day2.create({
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16,
            jam12
        });

        res.status(200).json({
            message: 'Day 2 Berhasil direset dan dibuat baru!',
            type: 'Date',
            tanggal: tanggalFix,
            money,
            jam16,
            jam12
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal mereset Day 2.' });
    }
});

// --- ROUTE GET DATE ---
routerData.get('/date', async (req: Request, res: Response) => {
    const targetDay = req.query.targetDay as string;

    try {
        let SelectedModel;
        if (targetDay === 'day1') {
            SelectedModel = Day1;
        } else if (targetDay === 'day2') {
            SelectedModel = Day2;
        } else {
            return res.status(400).json({ error: 'Parameter targetDay tidak valid (harus day1 atau day2)' });
        }

        const adminConfig = await SelectedModel.findOne().sort({ _id: 1 });

        if (!adminConfig || !adminConfig.tanggal) {
            return res.status(404).json({ error: 'Tanggal belum diset oleh Admin' });
        }

        return res.status(200).json({
            message: 'Berhasil mengambil tanggal',
            tanggal: adminConfig.tanggal,
            jam16: adminConfig.jam16,
            jam12: adminConfig.jam12
        });
    } catch (error) {
        console.error("Error mengambil tanggal:", error);
        return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

// --- ROUTE USER: ABSEN & UPLOAD EXCEL ---
routerData.post('/absen', upload.single('fileExcel'), async (req: any, res: Response) => {
    try {
        const {
            nik, nama, jabatan, tandaTangan, targetDay,
            startJam, startMenit, endJam, endMenit, isApprovalMode
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

        let fileId = null;

        // --- LOGIKA PENYIMPANAN DAN RENAME FILE EXCEL ---
        if (req.file) {
            // 1. Ambil data tanggal Day 1 dan Day 2 dari database
            const configDay1 = await Day1.findOne().sort({ _id: 1 });
            const configDay2 = await Day2.findOne().sort({ _id: 1 });

            // 2. Bersihkan spasi pada data untuk dijadikan nama file yang valid
            // Jika tanggalnya "4 Juli 2026", akan menjadi "4_Juli_2026"
            const tgl1 = configDay1?.tanggal ? configDay1.tanggal.replace(/\s+/g, '_') : 'Day1';
            const tgl2 = configDay2?.tanggal ? configDay2.tanggal.replace(/\s+/g, '_') : 'Day2';
            const namaUser = nama ? nama.replace(/\s+/g, '_') : 'TanpaNama';
            const nikUser = nik || 'TanpaNIK';

            // 3. Susun nama file baru
            const ext = path.extname(req.file.originalname); // Mendapatkan ekstensi (.xlsx / .xls)
            
            // Format: export_tanggal1_dan_tanggal2_nik_nama_timestamp.xlsx
            // (Timestamp ditambahkan sedikit di belakang agar jika karyawan upload 2x, filenya tidak saling timpa)
            const newFileName = `${nikUser}_${namaUser}_export_${tgl1}_dan_${tgl2}${ext}`;

            // 4. Tentukan lokasi path yang baru
            const oldPath = req.file.path;
            const newPath = path.join(req.file.destination, newFileName);

            // 5. Ubah (Rename) nama file fisiknya di folder server!
            fs.renameSync(oldPath, newPath);

            // 6. Simpan ke Database menggunakan data file yang sudah direname
            const fileBaru = new FileModel({
                filename: newFileName,
                path: newPath,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype
            });
            
            const savedFile = await fileBaru.save();
            fileId = savedFile._id;
            
        } else {
            // Wajib upload jika Day 1
            if (targetDay === 'day1') {
                return res.status(400).json({ error: 'File Excel wajib diupload untuk Day 1!' });
            }
        }

        // --- LANJUTAN SIMPAN DATA ABSENSI ---
        const formatWaktuMulai = `${startJam || '00'}:${startMenit || '00'}`;
        const formatWaktuSelesai = `${endJam || '00'}:${endMenit || '00'}`;

        const absenBaru = new SelectedModel({
            tanggal: adminConfig.tanggal,
            nik: nik,
            nama: nama,
            jabatan: jabatan,
            tandaTangan: tandaTangan,
            waktuMulai: formatWaktuMulai,     
            waktuSelesai: formatWaktuSelesai, 
            isApprovalMode: isApprovalMode === 'true', 
            fileId: fileId 
        });

        await absenBaru.save();

        res.status(201).json({ message: `Absen berhasil disimpan di ${targetDay}!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Gagal menyimpan absensi user' });
    }
});
// --- ROUTE ADMIN: DOWNLOAD SEMUA EXCEL (ZIP) ---
routerData.get('/admin/download-zip', async (req: Request, res: Response) => {
    try {
        const semuaFile = await FileModel.find({});
        if (semuaFile.length === 0) {
            return res.status(404).json({ error: 'Belum ada file Excel yang diupload.' });
        }

        // 1. Ambil data tanggal dari Day 1 dan Day 2
        const configDay1 = await Day1.findOne().sort({ _id: 1 });
        const configDay2 = await Day2.findOne().sort({ _id: 1 });

        // 2. Susun nama file secara dinamis
        let namaFileBase = "Lampiran Excel Lembur";
        
        if (configDay1?.tanggal && configDay2?.tanggal) {
            namaFileBase += ` ${configDay1.tanggal} dan ${configDay2.tanggal}`;
        } else if (configDay1?.tanggal) {
            namaFileBase += ` ${configDay1.tanggal}`;
        } else if (configDay2?.tanggal) {
            namaFileBase += ` ${configDay2.tanggal}`;
        }

        const finalFileName = `${namaFileBase}.zip`;

        // 3. Set Header (PENTING: Gunakan tanda kutip ganda untuk filename yang mengandung spasi)
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);

        // 4. Proses pembuatan ZIP
        const archive = new ZipArchive({ 
            zlib: { level: 9 } 
        });

        archive.on('error', (err: Error) => {
            console.error('Archiver Error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat ZIP' });
        });
        
        archive.pipe(res);

        for (const fileData of semuaFile) {
            if (fs.existsSync(fileData.path)) {
                archive.file(fileData.path, { name: fileData.filename });
            }
        }
        
        await archive.finalize();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Gagal mendownload ZIP' });
        }
    }
});

export default routerData;