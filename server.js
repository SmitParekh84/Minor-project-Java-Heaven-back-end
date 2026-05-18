import dotenv from 'dotenv';
dotenv.config();

// Fail fast if required secrets are missing
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'SESSION_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import compression from 'compression';

import signupRoute from './route/signup.js';
import itemRoute from './route/item.js';
import orderRoute from './route/order.js';
import authRoute from './route/auth.js';
import forgotPasswordRoute from './route/forgotPassword.js';
import dashboardRoute from './route/dashboard.js';
import userRoute from './route/user.js';
import revenueRoute from './route/revenue.js';
import cartRoute from './route/cart.js';
import stockRoute from './route/stock.js';

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(morgan('combined'));

// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(compression());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60,
    },
  })
);

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

app.use('/api', authRoute);
app.use('/api', signupRoute);
app.use('/api/items', itemRoute);
app.use('/api', orderRoute);
app.use('/api/stock', stockRoute);
app.use('/api', forgotPasswordRoute);
app.use('/api', dashboardRoute);
app.use('/api', userRoute);
app.use('/api/revenue', revenueRoute);
app.use('/api', cartRoute);

app.use((req, res) => {
  res.status(404).json({ success: false, msg: 'Route not found' });
});

// Global error handler — must be last middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ success: false, msg });
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
