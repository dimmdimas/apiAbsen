import mongoose, { Schema } from 'mongoose';
// Membuat Schema untuk MongoDB
const FileSchema = new Schema({
    filename: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
// Mengekspor Model agar bisa dipanggil di routerData.ts
export const FileModel = mongoose.model('File', FileSchema);
//# sourceMappingURL=file.js.map