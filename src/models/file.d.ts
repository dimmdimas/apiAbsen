import mongoose, { Document } from 'mongoose';
export interface IFile extends Document {
    filename: string;
    path: string;
    originalName: string;
    mimetype: string;
    createdAt: Date;
}
export declare const FileModel: mongoose.Model<IFile, {}, {}, {}, mongoose.Document<unknown, {}, IFile, {}, mongoose.DefaultSchemaOptions> & IFile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IFile>;
//# sourceMappingURL=file.d.ts.map