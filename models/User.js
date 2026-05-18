import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  category: { type: String },
  description: { type: String },
  imageUrl: { type: String },
  isBestseller: { type: Boolean, default: false },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  size: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, default: 'user' },
  mobno: { type: String, required: true },
  resetOTP: { type: String },
  resetOTPExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  address: { type: String },
  sessionId: { type: String, default: null },
  cartItems: [cartItemSchema],
});

userSchema.index({ email: 1 });
userSchema.index({ mobno: 1 });
userSchema.index({ username: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
