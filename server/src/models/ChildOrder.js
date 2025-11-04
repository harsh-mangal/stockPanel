import mongoose from 'mongoose';

const childOrderSchema = new mongoose.Schema(
  {
    masterOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterOrder', index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'LinkedAccount', index: true },

    broker: String,
    clientOrderId: { type: String, index: true, unique: true },
    brokerOrderId: String,

    symbol: String,
    side: { type: String, enum: ['BUY','SELL'] },
    qty: Number,
    orderType: { type: String, enum: ['MARKET','LIMIT','SL','SL-M'] },
    price: Number,
    triggerPrice: Number,

    status: { type: String, enum: ['QUEUED','PLACED','PARTIAL','FILLED','CANCELLED','REJECTED'], default: 'QUEUED' },
    filledQty: { type: Number, default: 0 },
    avgPrice: { type: Number, default: 0 },

    error: { code: String, msg: String },
    timestamps: {
      createdAt: Date,
      dispatchedAt: Date,
      updatedAt: Date,
      filledAt: Date
    }
  },
  { timestamps: true }
);

export default mongoose.model('ChildOrder', childOrderSchema);
