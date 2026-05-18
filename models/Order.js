import mongoose from 'mongoose';
import { ORDER_STATUS, DELIVERY_OPTION } from '../constants/orderStatus.js';

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        size: { type: String, required: true },
        subtotal: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    totalAmount: { type: Number, required: true },
    deliveryOption: {
      type: String,
      enum: Object.values(DELIVERY_OPTION),
      required: true,
    },
    address: {
      type: String,
      required: function () {
        return this.deliveryOption === DELIVERY_OPTION.HOME;
      },
    },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });

const Order = mongoose.model('Order', OrderSchema);

export default Order;
