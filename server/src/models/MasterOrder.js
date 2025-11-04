import mongoose from 'mongoose';

const masterOrderSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    symbol: String,
    exchange: { type: String, default: 'NSE' },
    productType: { type: String, enum: ['MIS', 'NRML', 'CNC'], default: 'MIS' },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    orderType: { type: String, enum: ['MARKET', 'LIMIT', 'SL', 'SL-M'], default: 'MARKET' },
    price: Number,
    triggerPrice: Number,
    validity: { type: String, default: 'DAY' },

    allocationMode: { type: String, enum: ['SAME_QTY','CUSTOM_PER_ACCOUNT','PROPORTIONAL','PCT_OF_MASTER'], required: true },
    allocationConfig: { type: Object, default: {} },

    status: { type: String, enum: ['CREATED','DISPATCHING','PARTIAL','FILLED','CANCELLED','FAILED'], default: 'CREATED' },
    summary: {
      requestedQty: { type: Number, default: 0 },
      dispatchedQty: { type: Number, default: 0 },
      filledQty: { type: Number, default: 0 },
      avgPrice: { type: Number, default: 0 }
    },
    auditTrail: [{ at: Date, by: String, action: String, note: String }]
  },
  { timestamps: true }
);

export default mongoose.model('MasterOrder', masterOrderSchema);
