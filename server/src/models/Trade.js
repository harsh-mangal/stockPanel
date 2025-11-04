import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema(
  {
    masterOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterOrder', index: true },
    childOrderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ChildOrder', index: true },
    accountId:     { type: mongoose.Schema.Types.ObjectId, ref: 'LinkedAccount', index: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    symbol:  { type: String, index: true },
    side:    { type: String, enum: ['BUY','SELL'] },
    qty:     { type: Number, required: true },
    price:   { type: Number, required: true },

    // execution time of the slice
    filledAt: { type: Date, default: Date.now, index: true },

    // optional broker refs
    broker:        String,
    brokerOrderId: String
  },
  { timestamps: true }
);

tradeSchema.index({ accountId: 1, filledAt: -1 });
tradeSchema.index({ userId: 1, filledAt: -1, symbol: 1 });

export default mongoose.model('Trade', tradeSchema);
