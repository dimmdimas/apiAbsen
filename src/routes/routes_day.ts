import { Router, Request, Response } from "express";
import { Day1, Day2 } from "../models/data.js";
import { FileModel } from "../models/file.js"; // SESUAIKAN PATH & NAMA MODEL FILE ANDA
import multer from "multer";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";
import xlsx from 'xlsx';

const routerData = Router();

const uploadDir = path.join(process.cwd(), 'uploads/excel');

// --- KONFIGURASI MULTER UNTUK EXCEL ---
const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        const dir = uploadDir;
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
// ------------------------------ SUBMIT ------------------------------
// --- HELPER: FUNGSI UNTUK MENYAMAKAN FORMAT TANGGAL ---
const bulanIndo: { [key: string]: number } = {
    'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
    'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
};

function parseCustomDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    const str = String(dateStr).toLowerCase().trim();

    // 1. Jika format excel berupa angka serial Excel
    if (!isNaN(Number(str)) && !str.includes('/')) {
        return new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    }

    // 2. Jika format DD/MM/YY atau DD/MM/YYYY (contoh: 29/6/26)
    if (str.includes('/')) {
        const parts = str.split('/');
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        let y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
    }

    // 3. Jika format teks Indonesia (contoh: 29 juni 2026)
    const parts = str.split(' ');
    if (parts.length >= 3) {
        const d = parseInt(parts[0], 10);
        const monthStr = parts[1];
        const m = bulanIndo[monthStr] !== undefined ? bulanIndo[monthStr] : 0;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d);
    }

    return new Date(dateStr);
}

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
            return res.status(404).json({ error: `Admin belum mengatur tanggal untuk ${targetDay}` });
        }

        let fileId = null;

        // --- LOGIKA VALIDASI, PENYIMPANAN DAN RENAME FILE EXCEL ---
        if (req.file) {
            // 1. BACA ISI EXCEL
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Ambil value dari cell A2 (NIK) dan B2 (Tanggal)
            const excelNikRaw = sheet['A2'] ? String(sheet['A2'].v).trim() : null;
            const excelDateRaw = sheet['B2'] ? sheet['B2'].v : null;

            // --- VALIDASI 1: CEK NIK (CELL A2) ---
            if (excelNikRaw !== String(nik).trim()) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    error: `Salah File! NIK di dalam Excel (${excelNikRaw || 'Kosong'}) tidak sama dengan NIK Anda (${nik}).`
                });
            }

            // --- VALIDASI 2: CEK TANGGAL (CELL B2) ---
            const dbDate = parseCustomDate(adminConfig.tanggal);
            const excelDate = parseCustomDate(excelDateRaw);

            let isDateMatch = false;
            if (excelDate && dbDate) {
                isDateMatch = (excelDate.getFullYear() === dbDate.getFullYear()) &&
                    (excelDate.getMonth() === dbDate.getMonth()) &&
                    (excelDate.getDate() === dbDate.getDate());
            }

            if (!isDateMatch) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                const formatTglExcel = excelDate ? `${excelDate.getDate()}/${excelDate.getMonth() + 1}/${excelDate.getFullYear()}` : 'Kosong/Tidak Terbaca';

                return res.status(400).json({
                    error: `Validasi Gagal! Tanggal di Excel (${formatTglExcel}) tidak cocok dengan jadwal ${targetDay.toUpperCase()} (${adminConfig.tanggal}).`
                });
            }

            // 2. TENTUKAN FOLDER TUJUAN (uploads/day1 atau uploads/day2)
            const targetFolder = path.join(process.cwd(), `uploads/${targetDay}`);

            // Buat folder secara otomatis jika belum ada
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            // 3. SUSUN NAMA FILE BARU
            const tglClean = adminConfig.tanggal.replace(/\s+/g, '_');
            const namaUser = nama ? nama.replace(/\s+/g, '_') : 'TanpaNama';
            const nikUser = nik || 'TanpaNIK';
            const ext = path.extname(req.file.originalname);

            // Format: 123_Dimas_export_day1_29_Juni_2026.xlsx
            const newFileName = `${nikUser}_${namaUser}_export_${tglClean}${ext}`;

            // 4. PINDAHKAN FILE KE FOLDER YANG BENAR
            const oldPath = req.file.path; // Ini masih di folder temporary multer (misal uploads/excel/)
            const newPath = path.join(targetFolder, newFileName);

            fs.renameSync(oldPath, newPath);

            // 5. SIMPAN KE DATABASE FILEMODEL
            const fileBaru = new FileModel({
                filename: newFileName,
                path: newPath, // Path sekarang menuju uploads/day1/ atau uploads/day2/
                originalName: req.file.originalname,
                mimetype: req.file.mimetype
            });

            const savedFile = await fileBaru.save();
            fileId = savedFile._id;

        } else {
            // Wajib upload
            const excelDateRaw = sheet['B2'] ? sheet['B2'].v : null;
            return res.status(400).json({ error: `Validasi Gagal! Tanggal di Excel (${excelDateRaw || 'Kosong'}) tidak cocok dengan jadwal sistem (${adminConfig.tanggal}).` });
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

        res.status(201).json({ message: `Absen dan Excel berhasil divalidasi & disimpan di ${targetDay}!` });
    } catch (error: any) {
        console.error("DEBUG ERROR DETAIL:", error);

        // Pastikan menghapus file temporary jika terjadi error di tengah proses (opsional tapi disarankan)
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Gagal memproses upload dan absensi',
            details: error.message,
            stack: error.stack
        });
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