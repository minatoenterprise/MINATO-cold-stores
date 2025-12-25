import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('combined'));

const origins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({ origin: function(origin, cb){
  if(origins.includes('*') || !origin || origins.includes(origin)) cb(null, true);
  else cb(new Error('Not allowed by CORS'));
}}));

// Global rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests/min per IP
});
app.use(limiter);

const DATA_FILE = path.join(process.cwd(), 'orders.json');
function loadOrders(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function saveOrders(orders){ fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2)); }

app.get('/', (req,res)=>{ res.json({ ok: true, service: 'minaato-backend' }); });

// Validation helpers
function isNonEmptyString(v){ return typeof v === 'string' && v.trim().length > 0; }
function isPositiveNumber(v){ return typeof v === 'number' && isFinite(v) && v >= 0; }
function isPositiveInt(v){ return Number.isInteger(v) && v >= 1; }

function validateOrderPayload(body){
  const errors = [];
  const name = body?.name;
  const phone = body?.phone;
  const address = body?.address ?? '';
  const deliveryOption = body?.deliveryOption ?? 'pickup';
  const items = Array.isArray(body?.items) ? body.items : [];

  if(!isNonEmptyString(name)) errors.push({ field: 'name', message: 'Name is required' });
  if(!isNonEmptyString(phone)) errors.push({ field: 'phone', message: 'Phone is required' });
  if(items.length === 0) errors.push({ field: 'items', message: 'At least one item is required' });

  items.forEach((it, idx) => {
    if(!isNonEmptyString(it?.id)) errors.push({ field: `items[${idx}].id`, message: 'Item id is required' });
    if(!isNonEmptyString(it?.name)) errors.push({ field: `items[${idx}].name`, message: 'Item name is required' });
    if(!isPositiveNumber(it?.price)) errors.push({ field: `items[${idx}].price`, message: 'Price must be a non-negative number' });
    if(!isPositiveInt(it?.qty)) errors.push({ field: `items[${idx}].qty`, message: 'Quantity must be a positive integer' });
  });

  return { errors, sanitized: { name: String(name || '').trim(), phone: String(phone || '').trim(), address: String(address || '').trim(), deliveryOption: String(deliveryOption || 'pickup').trim(), items } };
}

// Create order
app.post('/api/orders', (req,res)=>{
  const { errors, sanitized } = validateOrderPayload(req.body || {});
  if(errors.length){
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid order payload', details: errors } });
  }
  const orders = loadOrders();
  const id = 'ORD-' + Date.now();
  const computedTotal = sanitized.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const order = { id, ...sanitized, total: computedTotal, status: 'pending', createdAt: new Date().toISOString() };
  orders.push(order); saveOrders(orders);
  res.json({ success: true, order });
});

// Get order by id
app.get('/api/orders/:id', (req,res)=>{
  const orders = loadOrders();
  const order = orders.find(o => o.id === req.params.id);
  if(!order) return res.status(404).json({ error: 'Not found' });
  res.json({ order });
});

// Initialize Paystack transaction
// Stricter limiter for payment initialization
const payLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.post('/api/paystack/initialize', payLimiter, async (req,res)=>{
  const { email, amountGHS, orderId } = req.body || {};
  if(!email || !amountGHS || !orderId) return res.status(400).json({ error: 'Missing email, amountGHS or orderId' });
  const amountPesewas = Math.round(Number(amountGHS) * 100);
  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount: amountPesewas,
      currency: 'GHS',
      metadata: { orderId }
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    res.json({ authorization_url: response.data?.data?.authorization_url, reference: response.data?.data?.reference });
  } catch (err) {
    console.error('Paystack init error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initialize payment', details: err.response?.data || err.message });
  }
});

// Paystack webhook
app.post('/api/paystack/webhook', (req,res)=>{
  const secret = process.env.PAYSTACK_SECRET_KEY || '';
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  const signature = req.headers['x-paystack-signature'];
  if(!signature || hash !== signature){ return res.status(401).send('Invalid signature'); }

  const event = req.body;
  if(event?.event === 'charge.success'){
    const orderId = event?.data?.metadata?.orderId;
    if(orderId){
      const orders = loadOrders();
      const idx = orders.findIndex(o => o.id === orderId);
      if(idx >= 0){ orders[idx].status = 'paid'; orders[idx].paidAt = new Date().toISOString(); saveOrders(orders); }
    }
  }
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`Backend running on port ${PORT}`));
