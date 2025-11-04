import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, index: true },
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'TRADER'], default: 'ADMIN' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
