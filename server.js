const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'tokili_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.warning = req.flash('warning');
  next();
});

const db = require('./database');
app.use((req, res, next) => {
  db.all('SELECT * FROM settings', [], (err, settings) => {
    const s = {};
    (settings || []).forEach(x => s[x.key] = x.value);
    res.locals.settings = s;
    next();
  });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Auto-reminder cron job - every day at 9 AM
cron.schedule('0 9 * * *', () => {
  db.all(`SELECT p.*, u.id as lawyer_id, u.name as lawyer_name, julianday('now')-julianday(t.checkout_at) as days 
          FROM powers p JOIN power_transactions t ON p.id=t.power_id JOIN users u ON t.user_id=u.id 
          WHERE p.status='مع زميل' AND t.return_at IS NULL AND julianday('now')-julianday(t.checkout_at)>=2`, [], (err, rows) => {
    rows.forEach(row => {
      const msg = `تنبيه: التوكيل "${row.client_name}" (رقم: ${row.archive_number}) معك منذ ${Math.round(row.days)} أيام. يرجى الإرجاع.`;
      db.run(`INSERT INTO notifications (user_id, title, message, sound_type) VALUES (?, ?, ?, ?)`,
        [row.lawyer_id, 'تنبيه إرجاع التوكيل', msg, 'alert']);
    });
  });
});

app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/lawyer', require('./routes/lawyer'));
app.use('/powers', require('./routes/powers'));
app.use('/transactions', require('./routes/transactions'));
app.use('/notifications', require('./routes/notifications'));
app.use('/reports', require('./routes/reports'));
app.use('/settings', require('./routes/settings'));
app.use('/search', require('./routes/search'));
app.use('/import-export', require('./routes/import-export'));

app.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
    else return res.redirect('/lawyer/dashboard');
  }
  res.redirect('/login');
});

app.use((req, res) => {
  res.status(404).render('auth/404', { title: 'صفحة غير موجودة', layout: false });
});

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  توكيلي - مركز العدالة');
  console.log('  http://localhost:' + PORT);
  console.log('========================================\n');
});
