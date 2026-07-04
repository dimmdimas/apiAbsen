import mongoose, { Schema, Document } from 'mongoose';

// Interface untuk TypeScript (opsional tapi sangat disarankan)
export interface IFile extends Document {
    filename: string;
    path: string;
    originalName: string;
    mimetype: string;
    createdAt: Date;
}

// Membuat Schema untuk MongoDB
const FileSchema: Schema = new Schema({
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
export const FileModel = mongoose.model<IFile>('File', FileSchema);