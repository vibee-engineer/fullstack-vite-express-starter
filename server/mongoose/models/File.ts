/**
 * Mongoose parallel of the Prisma `File` model — uploaded-file metadata.
 *
 * The bytes live in the storage driver (server/src/services/storage) under
 * `storageKey`; this document only points at them. Imported dynamically by
 * `fileRepository.ts` so Mongo code never loads in a Postgres project.
 */
// Default import + destructure — see ./Task.ts for why a named `import
// { models }` throws at runtime on this ESM package.
import mongoose, { type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface FileDoc {
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}

const FileMongooseSchema = new Schema<FileDoc>(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

FileMongooseSchema.index({ createdAt: -1 });

export const File: Model<FileDoc> =
  (models.File as Model<FileDoc> | undefined) ?? model<FileDoc>('File', FileMongooseSchema);
