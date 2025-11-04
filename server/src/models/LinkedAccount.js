import mongoose from 'mongoose';

const linkedAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    broker: { type: String, enum: ['PAPER', 'ZERODHA', 'FYERS', 'ANGEL'], default: 'PAPER' },
    displayName: String,
    enabled: { type: Boolean, default: true },
    capital: { type: Number, default: 0 },
    tags: [String],
    // credentials would be encrypted in real mode
  },
  { timestamps: true }
);

export default mongoose.model('LinkedAccount', linkedAccountSchema);
