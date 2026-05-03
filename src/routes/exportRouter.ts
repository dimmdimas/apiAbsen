import express, { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import path from 'path';
import { Day1, Day2 } from '../models/data.js';
import { fileURLToPath } from 'url';
import { imageSize } from 'image-size';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PENTING: Sesuaikan import model dengan path/lokasi file model Anda 

const router = express.Router();

// --- HELPER: Fungsi Hitung Selisih Jam ---const hitungTotalJam = (waktuMulai: string, waktuSelesai: string) => {
// --- HELPER: Fungsi Hitung Selisih Jam (Sampai Detik) ---
const hitungTotalJam = (waktuMulai?: string | null, waktuSelesai?: string | null): string => {
    // Jika data kosong atau 00:00:00, langsung kembalikan string kosong
    if (!waktuMulai || !waktuSelesai || waktuSelesai === '00:00:00' || waktuMulai === '00:00:00') {
        return '';
    }

    // Pecah string jam:menit:detik
    const partsMulai = waktuMulai.split(':');
    const startJam = Number(partsMulai[0]) || 0;
    const startMenit = Number(partsMulai[1]) || 0;

    const partsSelesai = waktuSelesai.split(':');
    const endJam = Number(partsSelesai[0]) || 0;
    const endMenit = Number(partsSelesai[1]) || 0; // Tambahan untuk detik

    // Jadikan semua perhitungan ke satuan detik
    let totalMulaiDetik = (startJam * 3600) + (startMenit * 60);
    let totalSelesaiDetik = (endJam * 3600) + (endMenit * 60);

    // Penanganan jika lewat tengah malam (misal lembur sampai pagi)
    if (totalSelesaiDetik < totalMulaiDetik) {
        totalSelesaiDetik += 24 * 3600;
    }

    const selisihDetik = totalSelesaiDetik - totalMulaiDetik;

    // Konversi kembali dari total detik ke jam, menit, detik
    const jam = Math.floor(selisihDetik / 3600);
    const sisaDetikSetelahJam = selisihDetik % 3600;
    const menit = Math.floor(sisaDetikSetelahJam / 60);

    // Output dengan format HH:mm:ss
    return `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;
};

// --- HELPER: Fungsi Dapatkan Hari ---
const getHariDanTanggal = (tanggalStr?: string | null): string => {
    // Jika tanggal kosong dari database, kembalikan teks default
    if (!tanggalStr) return 'Tanggal Belum Diatur';

    const hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const bulanIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const parts = tanggalStr.split(' ');

    // Jika format bukan "Tanggal Bulan Tahun" (3 kata), kembalikan teks aslinya saja
    if (parts.length !== 3) return tanggalStr;

    // Tambahkan || '0' dan || '' agar TypeScript yakin ini selalu string
    const tgl = parseInt(parts[0] || '0');
    const namaBulan = parts[1] || '';
    const tahun = parseInt(parts[2] || '0');

    const bulanIndex = bulanIndo.indexOf(namaBulan);

    // Jika nama bulan tidak valid (salah eja di database), kembalikan string asli
    if (bulanIndex === -1) return tanggalStr;

    const dateObj = new Date(tahun, bulanIndex, tgl);
    const namaHari = hariIndo[dateObj.getDay()];

    return `${namaHari}, ${tanggalStr}`;
};

// --- ROUTER GET EXPORT EXCEL ---
router.get('/export-excel/:day', async (req: Request, res: Response) => {
    try {
        const { day } = req.params;

        // 1. Pilih Model berdasarkan parameter URL
        let SelectedModel;
        if (day === 'day1') SelectedModel = Day1;
        else if (day === 'day2') SelectedModel = Day2;
        else return res.status(400).json({ error: 'Parameter hari tidak valid' });

        // 2. Ambil data dari database (Diurutkan berdasarkan nama)
        const dataAbsen = await SelectedModel.find().sort({ nik: 1, jabatan: 1 });
        if (!dataAbsen || dataAbsen.length === 0) {
            return res.status(404).json({ error: 'Tidak ada data absen untuk diekspor.' });
        }

        // 3. Setup ExcelJS & Load Template
        const workbook = new ExcelJS.Workbook();
        // PENTING: Sesuaikan path ini mengarah ke file Template Excel Anda (Form_Absen.xlsx)
        const templatePath = path.join(__dirname, '../../src/templates/Form_Absen.xlsx');

        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            // Tambahkan log untuk debug di terminal
            console.error("Daftar sheet yang ditemukan:", workbook.worksheets.map(s => s.name));
            return res.status(500).json({ error: 'Worksheet tidak ditemukan. Pastikan file template memiliki minimal 1 sheet.' });
        }

        // 4. Update Header Template (Tanggal dan Hari Lembur)
        const tanggalDatabase = dataAbsen[0]?.tanggal;

        // C7: Format Lengkap (Senin, 29 April 2026)
        const infoTanggalFormatted = getHariDanTanggal(tanggalDatabase);
        worksheet.getCell('C7').value = `: ${infoTanggalFormatted}`;

        // C8: Ambil nama hari, pastikan teks tersedia sebelum di-split
        // Kita beri fallback string kosong '' jika infoTanggalFormatted undefined
        const hariSaja = (infoTanggalFormatted || "").split(',')[0]?.toLowerCase() || "";

        worksheet.getCell('C8').value = `: Lembur hari ${hariSaja}`;

        let currentRow = 12; // Data dimulai dari baris ke-11

        // =========================================================
        // 5. LOOPING ISI DATA KE DALAM TABEL
        // =========================================================
        dataAbsen.slice(1).forEach((item: any, index: number) => {
            const row = worksheet.getRow(currentRow);

            const nik = item.nik || '';
            const nama = item.nama || '';
            const jabatan = item.jabatan || '';
            const waktuMulai = item.waktuMulai || '';
            const waktuSelesai = item.waktuSelesai || '';

            const isTidakLembur = (waktuMulai.startsWith('00:00') && waktuSelesai.startsWith('00:00'));

            row.getCell(1).value = index + 1;
            row.getCell(2).value = nik;
            row.getCell(3).value = nama;
            row.getCell(4).value = jabatan;
            row.getCell(5).value = waktuMulai;
            row.getCell(6).value = waktuSelesai;

            // Logika Pengecekan Jam
            if (isTidakLembur) {
                // 1. Merge cell E sampai H
                worksheet.mergeCells(`E${currentRow}:H${currentRow}`);

                // 2. Akses sel utama (E) dan tulis teks
                const mergedCell = worksheet.getCell(`E${currentRow}`);
                mergedCell.value = 'Tidak Ikut Lembur';

                // Format Rata Tengah
                mergedCell.alignment = { vertical: 'middle', horizontal: 'center' };
                // Opsional: Buat teks tebal / miring
                mergedCell.font = { italic: true, bold: true };
                
            } else {
                // JIKA IKUT LEMBUR: Tulis jam seperti biasa
                row.getCell(5).value = waktuMulai;
                row.getCell(6).value = waktuSelesai;
                
                const selisihJam = hitungTotalJam(waktuMulai, waktuSelesai);
                row.getCell(7).value = selisihJam;

                // Logika Uang Makan
                let uangMakan: number | string = '';
                if (waktuSelesai && waktuSelesai !== '00:00:00' && waktuSelesai !== '') {
                    const nominalDatabase = item.money || dataAbsen[0]?.money || 0;
                    uangMakan = Number(nominalDatabase);
                }
                row.getCell(8).value = uangMakan;
            }

            // 1. MEMBUAT BORDER & FORMATTING (Mengikuti setiap baris data yang diisi)
            for (let i = 1; i <= 10; i++) {
                const cell = row.getCell(i);
                console.log(cell)

                // Buat garis kotak tipis berwarna hitam pekat untuk setiap sel
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };

                if (i === 3) {
                    // Rata Kiri dengan sedikit jarak (indent) agar teks tidak menabrak garis tepi
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
                } else if (i === 8) {
                    // Kolom H: Format Rupiah & Rata Tengah
                    cell.numFmt = '"Rp"#,##0';
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                } else {
                    // Kolom lainnya Rata Tengah
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                }
                if (cell.font) {
                    cell.font.bold = false;
                }
            }

            // Atur tinggi dasar baris (akan disesuaikan jika ada TTD)
            row.height = 35;

            // 2. MEMASUKKAN GAMBAR DENGAN UKURAN PROPORSIONAL & RATA TENGAH
            if (item.tandaTangan && typeof item.tandaTangan === 'string' && item.tandaTangan.includes('base64')) {
                const base64Data = item.tandaTangan.replace(/^data:image\/\w+;base64,/, "");
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const dimensions = imageSize(imageBuffer);
                const originalWidth = dimensions.width || 1;
                const originalHeight = dimensions.height || 1;

                const maxBoxWidth = 80;
                const maxBoxHeight = 45;

                const ratio = Math.min(maxBoxWidth / originalWidth, maxBoxHeight / originalHeight);
                const finalWidth = originalWidth * ratio;
                const finalHeight = originalHeight * ratio;

                const offsetX = (1 - (finalWidth / maxBoxWidth)) / 2;
                const offsetY = (1 - (finalHeight / maxBoxHeight)) / 2;

                const imageId = workbook.addImage({
                    base64: base64Data,
                    extension: 'png',
                });

                // Perbesar tinggi baris karena ada gambar TTD
                row.height = 45;

                // TTD di Kolom I (Indeks 8)
                worksheet.addImage(imageId, {
                    tl: {
                        col: 8 + offsetX, // Gunakan angka pas 8 agar perhitungannya tepat di batas kiri
                        row: currentRow - 1 + offsetY
                    } as any,
                    ext: { width: finalWidth, height: finalHeight },
                    editAs: 'oneCell'
                });

                // TTD di Kolom J (Indeks 9)
                worksheet.addImage(imageId, {
                    tl: {
                        col: 9 + offsetX, // Gunakan angka pas 9
                        row: currentRow - 1 + offsetY
                    } as any,
                    ext: { width: finalWidth, height: finalHeight },
                    editAs: 'oneCell'
                });
            }

            row.commit();
            currentRow++;
        });

        // =========================================================
        // 6. PROSES FOOTER (ANTI-UNDEFINED)
        // =========================================================
        const fPath = path.join(__dirname, '../../src/templates/Footer_Form_Absen.xlsx');
        if (fs.existsSync(fPath)) {
            try {
                const fWb = new ExcelJS.Workbook();
                await fWb.xlsx.readFile(fPath);
                const fWs = fWb.getWorksheet(1) || fWb.worksheets[0];

                if (fWs) {
                    let fStart = currentRow;

                    fWs.eachRow({ includeEmpty: true }, (fRow, rNum) => {
                        const targetRowNumber = fStart + (rNum - 1);
                        const tRow = worksheet.getRow(targetRowNumber);

                        if (fRow.height) tRow.height = fRow.height;

                        fRow.eachCell({ includeEmpty: true }, (c, cNum) => {
                            const tC = tRow.getCell(cNum);
                            tC.value = c.value;

                            if (c.font) tC.font = JSON.parse(JSON.stringify(c.font));
                            if (c.alignment) tC.alignment = JSON.parse(JSON.stringify(c.alignment));
                            if (c.border) tC.border = JSON.parse(JSON.stringify(c.border));
                            if (c.fill) tC.fill = JSON.parse(JSON.stringify(c.fill));
                            tC.numFmt = c.numFmt;
                        });

                        tRow.commit();
                    });

                    // --- PERBAIKAN MERGE CELLS (ANTI-ERROR TYPESCRIPT) ---
                    const fModel = (fWs.model as any);
                    if (fModel?.merges) {
                        fModel.merges.forEach((m: string) => {
                            const r = m.split(':');

                            // Tambahkan fallback string kosong jika r[0] atau r[1] tidak ada
                            const sMatch = (r[0] ?? "").match(/([A-Z]+)(\d+)/);
                            const eMatch = (r[1] ?? "").match(/([A-Z]+)(\d+)/);

                            if (sMatch && eMatch) {
                                // Ambil Kolom (A, B, C...) atau string kosong
                                const startCol = sMatch[1] ?? "";
                                const endCol = eMatch[1] ?? "";

                                // Ambil Angka Baris, fallback ke "0" agar parseInt tidak error
                                const startRowBase = parseInt(sMatch[2] ?? "0");
                                const endRowBase = parseInt(eMatch[2] ?? "0");

                                // Kalkulasi posisi baris baru di sheet utama
                                const finalStartRow = startRowBase + fStart - 1;
                                const finalEndRow = endRowBase + fStart - 1;

                                // Pastikan kolom tidak kosong sebelum melakukan merge
                                if (startCol && endCol) {
                                    worksheet.mergeCells(`${startCol}${finalStartRow}:${endCol}${finalEndRow}`);
                                }
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Gagal memuat footer:", err);
            }
        }

        // =========================================================
        // 7. KIRIM RESPONSE KE BROWSER
        // =========================================================
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Lembur_${tanggalDatabase}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error saat export Excel:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server saat membuat file Excel' });
    }
});

export default router;