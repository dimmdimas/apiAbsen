import { Router, Request, Response } from "express";
import { Day1, Day2 } from "../models/data.js";
import { FileModel } from "../models/file.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';

const routerData = Router();

// --- STANDARISASI PATH PENYIMPANAN ---
const baseUploadPath = path.join(process.cwd(), 'uploads');
const tempUploadDir = path.join(baseUploadPath, 'excel');

// --- KONFIGURASI MULTER UNTUK EXCEL (PENYIMPANAN SEMENTARA) ---
const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        // Buat folder otomatis jika belum ada
        if (!fs.existsSync(tempUploadDir)) {
            fs.mkdirSync(tempUploadDir, { recursive: true });
        }
        cb(null, tempUploadDir);
    },
    filename: (req: any, file: any, cb: any) => {
        // Ambil NIK dari query (karena sekarang via URL Query)
        const nikUser = req.query.nik || 'TanpaNIK';
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

// --- HELPER FORMAT TANGGAL ---
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

const hapusFileLama = async () => {
    try {
        const semuaFile = await FileModel.find({});
        for (const file of semuaFile) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }
        await FileModel.deleteMany({});
        console.log("File Excel dari lembur sebelumnya berhasil dibersihkan.");
    } catch (error) {
        console.error("Gagal menghapus file lama:", error);
    }
};

const bulanIndo: { [key: string]: number } = {
    'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
    'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
};

function parseCustomDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    const str = String(dateStr).toLowerCase().trim();

    if (!isNaN(Number(str)) && !str.includes('/')) {
        return new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    }
    if (str.includes('/')) {
        const parts = str.split('/');
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        let y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
    }
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


// --- ROUTE ADMIN: SETUP DAY 1 & DAY 2 ---
routerData.post('/day1', async (req: Request, res: Response) => {
    try {
        const { tanggal, money, jam16, jam12 } = req.body;
        const tanggalFix = formatTanggalIndo(tanggal);
        await hapusFileLama();
        await Day2.deleteMany({});
        await Day1.deleteMany({});
        await Day1.create({ type: 'Date', tanggal: tanggalFix, money, jam16, jam12 });
        res.status(200).json({ message: 'Day 1 Berhasil direset!', type: 'Date', tanggal: tanggalFix, money, jam16, jam12 });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mereset Day 1.' });
    }
});

routerData.post('/day2', async (req: Request, res: Response) => {
    try {
        const { tanggal, money, jam16, jam12 } = req.body;
        const tanggalFix = formatTanggalIndo(tanggal);
        await Day2.deleteMany({});
        await Day2.create({ type: 'Date', tanggal: tanggalFix, money, jam16, jam12 });
        res.status(200).json({ message: 'Day 2 Berhasil direset!', type: 'Date', tanggal: tanggalFix, money, jam16, jam12 });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mereset Day 2.' });
    }
});

routerData.get('/date', async (req: Request, res: Response) => {
    const targetDay = req.query.targetDay as string;
    try {
        let SelectedModel = targetDay === 'day1' ? Day1 : (targetDay === 'day2' ? Day2 : null);
        if (!SelectedModel) return res.status(400).json({ error: 'Hari tidak valid' });

        const adminConfig = await SelectedModel.findOne().sort({ _id: 1 });
        if (!adminConfig || !adminConfig.tanggal) return res.status(404).json({ error: 'Tanggal belum diset' });

        return res.status(200).json({ message: 'Berhasil', tanggal: adminConfig.tanggal, jam16: adminConfig.jam16, jam12: adminConfig.jam12 });
    } catch (error) {
        return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

// =======================================================================
// 1. ENDPOINT KHUSUS UPLOAD & VALIDASI EXCEL (Langkah Pertama)
// =======================================================================
routerData.post('/upload-excel', upload.single('fileExcel'), async (req: any, res: Response) => {
    try {
        // Ambil data penting dari query URL agar FormData tetap murni file
        const nik = req.query.nik as string;
        const nama = req.query.nama as string;
        const targetDay = req.query.targetDay as string;

        if (!req.file) {
            return res.status(400).json({ error: `Sistem menolak! File Excel gagal diterima oleh server.` });
        }
        if (!nik || !targetDay) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Parameter NIK dan targetDay wajib ada di URL' });
        }

        let SelectedModel = targetDay === 'day1' ? Day1 : (targetDay === 'day2' ? Day2 : null);
        if (!SelectedModel) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Hari tidak valid' });
        }

        const adminConfig = await SelectedModel.findOne().sort({ _id: 1 });
        if (!adminConfig) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: `Admin belum mengatur tanggal untuk ${targetDay}` });
        }

        // --- VALIDASI ISI EXCEL ---
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const excelNikRaw = sheet['A2'] ? String(sheet['A2'].v).trim() : null;
        const excelDateRaw = sheet['B2'] ? sheet['B2'].v : null;

        if (excelNikRaw !== String(nik).trim()) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                error: `Salah File! NIK di dalam Excel (${excelNikRaw || 'Kosong'}) tidak sama dengan NIK Anda (${nik}).`
            });
        }

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

        // --- PINDAHKAN FILE JIKA VALID ---
        const targetFolder = path.join(baseUploadPath, targetDay);
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const tglClean = adminConfig.tanggal.replace(/\s+/g, '_');
        const namaUser = nama ? nama.replace(/\s+/g, '_') : 'TanpaNama';
        const ext = path.extname(req.file.originalname);
        const newFileName = `${nik}_${namaUser}_export_${tglClean}${ext}`;

        const oldPath = req.file.path;
        const newPath = path.join(targetFolder, newFileName);

        fs.renameSync(oldPath, newPath);

        const fileBaru = new FileModel({
            filename: newFileName,
            path: newPath,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype
        });

        const savedFile = await fileBaru.save();

        // Kembalikan ID File untuk dikirim di proses ke-2
        res.status(201).json({
            message: `Excel valid untuk tanggal ${adminConfig.tanggal}!`,
            fileId: savedFile._id
        });

    } catch (error: any) {
        console.error("DEBUG ERROR UPLOAD:", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Gagal memproses upload file', details: error.message });
    }
});


// =======================================================================
// 2. ENDPOINT KHUSUS SIMPAN DATA TEKS ABSEN (Langkah Kedua)
// =======================================================================
routerData.post('/absen', async (req: Request, res: Response) => {
    try {
        // Endpoint ini HANYA menerima JSON biasa (Tidak ada Multer)
        const {
            nik, nama, jabatan, tandaTangan, targetDay,
            startJam, startMenit, endJam, endMenit, isApprovalMode, fileId
        } = req.body;

        let SelectedModel = targetDay === 'day1' ? Day1 : (targetDay === 'day2' ? Day2 : null);
        if (!SelectedModel) return res.status(400).json({ error: 'Hari tidak valid' });

        const adminConfig = await SelectedModel.findOne().sort({ _id: 1 });
        if (!adminConfig) return res.status(404).json({ error: `Admin belum mengatur tanggal untuk ${targetDay}` });

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
            isApprovalMode: isApprovalMode === 'true' || isApprovalMode === true,
            fileId: fileId || null // Mendapatkan ID file dari proses pertama
        });

        await absenBaru.save();
        res.status(201).json({ message: `Data Teks Absen berhasil disimpan di ${targetDay}!` });

    } catch (error: any) {
        console.error("DEBUG ERROR ABSEN:", error);
        res.status(500).json({ error: 'Gagal menyimpan data absensi', details: error.message });
    }
});


// --- ROUTE ADMIN: DOWNLOAD SEMUA EXCEL (ZIP) ---
routerData.get('/admin/download-zip', async (req: Request, res: Response) => {
    try {
        const targetDay = req.query.targetDay as string;

        if (!targetDay || (targetDay !== 'day1' && targetDay !== 'day2')) {
            return res.status(400).json({ error: 'Harap sertakan ?targetDay=day1 atau ?targetDay=day2 di URL' });
        }

        const semuaFile = await FileModel.find({});
        const filesDipilih = semuaFile.filter(file => file.path.includes(targetDay));

        if (filesDipilih.length === 0) {
            return res.status(404).json({ error: `Data file untuk ${targetDay.toUpperCase()} belum ada di database.` });
        }

        let configDay = null;
        if (targetDay === 'day1') configDay = await Day1.findOne().sort({ _id: 1 });
        if (targetDay === 'day2') configDay = await Day2.findOne().sort({ _id: 1 });

        const tanggalTeks = configDay?.tanggal ? ` ${configDay.tanggal}` : '';
        // Ubah ekstensi menjadi .xlsx
        const finalFileName = `Lampiran_Lembur_${targetDay.toUpperCase()}${tanggalTeks}.xlsx`;

        // 1. Tentukan path file template Anda
        // Sesuaikan nama file template dengan yang Anda simpan di server
        // KODE BARU YANG BENAR
        // Gunakan process.cwd() agar otomatis mendeteksi folder utama project
        const templatePath = path.join(process.cwd(), 'src', 'templates', 'Lampiran_Lembur.xlsx');

        if (!fs.existsSync(templatePath)) {
            return res.status(500).json({ error: 'File template Excel tidak ditemukan di server.' });
        }

        // 2. Load file template
        const workbookTemplate = new ExcelJS.Workbook();
        await workbookTemplate.xlsx.readFile(templatePath);

        // Ambil sheet pertama dari template
        const worksheetTemplate = workbookTemplate.getWorksheet(1);
        if (!worksheetTemplate) {
            return res.status(500).json({ error: 'Sheet tidak ditemukan di dalam template.' });
        }

        let adaFileTerproses = false;
        
        // 1. BUAT WADAH PENAMPUNG DATA
        let semuaDataBaris: any[] = []; 

        for (const fileData of filesDipilih) {
            const rawPath = String(fileData.path).replace(/\\/g, '/');
            const fileNameFromDB = path.basename(rawPath).trim();
            const folderFisik = path.join(process.cwd(), 'uploads', targetDay);

            if (fs.existsSync(folderFisik)) {
                const daftarFileFisik = fs.readdirSync(folderFisik);
                const fileDitemukan = daftarFileFisik.find(f => 
                    f.toLowerCase().includes(fileNameFromDB.toLowerCase()) || 
                    fileNameFromDB.toLowerCase().includes(f.toLowerCase())
                );

                if (fileDitemukan) {
                    const realPath = path.join(folderFisik, fileDitemukan);
                    
                    try {
                        const wbKaryawan = new ExcelJS.Workbook();
                        await wbKaryawan.xlsx.readFile(realPath);
                        const wsKaryawan = wbKaryawan.getWorksheet(1);

                        if (wsKaryawan) {
                            const rowCount = wsKaryawan.rowCount;
                            for (let i = 2; i <= rowCount; i++) {
                                const row = wsKaryawan.getRow(i);
                                if (row.hasValues) {
                                    // BUKAN DI-ADD KE EXCEL, TAPI DIMASUKKAN KE ARRAY DULU
                                    semuaDataBaris.push(row.values); 
                                }
                            }
                            adaFileTerproses = true;
                        }
                    } catch (err: any) {
                        console.log(`[DEBUG] ❌ Gagal memproses excel: ${err.message}`);
                    }
                }
            }
        }

        if (!adaFileTerproses || semuaDataBaris.length === 0) {
            return res.status(404).json({ error: 'Data gagal diproses atau semua Excel kosong.' });
        }

        // 2. FUNGSI BANTUAN UNTUK MENGAMBIL NILAI SEL DENGAN AMAN
        const getCellValue = (val: any) => {
            if (val === null || val === undefined) return '';
            if (val instanceof Date) return val.getTime().toString(); // Urutkan tanggal
            if (typeof val === 'object') return (val.result || val.text || '').toString();
            return val.toString();
        };

        // 3. PROSES SORTING (KOLOM B DULU, JIKA SAMA BARU KOLOM A)
        semuaDataBaris.sort((baris1, baris2) => {
            // Di exceljs, index array selalu dimulai dari 1 (0 selalu kosong)
            // Kolom A = index 1, Kolom B = index 2
            const valA1 = getCellValue(baris1[1]);
            const valA2 = getCellValue(baris2[1]);
            const valB1 = getCellValue(baris1[2]);
            const valB2 = getCellValue(baris2[2]);

            // Urutkan berdasarkan Kolom B (A - Z)
            if (valB1 < valB2) return -1;
            if (valB1 > valB2) return 1;

            // Jika Kolom B nilainya sama, urutkan berdasarkan Kolom A (A - Z)
            if (valA1 < valA2) return -1;
            if (valA1 > valA2) return 1;

            return 0;
        });

        // 4. MASUKKAN DATA YANG SUDAH RAPI KE DALAM TEMPLATE
        for (const baris of semuaDataBaris) {
            worksheetTemplate.addRow(baris);
        }

        // 5. BUNGKUS DAN KIRIM KE BROWSER SEPERTI BIASA
        const buffer = await workbookTemplate.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
        res.setHeader('Content-Length', buffer.byteLength);

        res.send(buffer);

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Gagal mendownload Excel gabungan' });
        }
    }
});

export default routerData;