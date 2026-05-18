import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  imageUrl: { type: String },
  isBestseller: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  stock: { type: Number, required: true, default: 0, min: 0 },
});

ItemSchema.index({ category: 1 });
ItemSchema.index({ name: 1 });

const Item = mongoose.model('Item', ItemSchema);

export default Item;
