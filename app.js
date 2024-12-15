require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const app = express();
const flash = require('connect-flash');
const indexRouter = require('./routes/index');
const apiRoutes = require('./routes/api');

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(flash());
app.use(express.static('public'));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use('/', indexRouter);
app.use('/api', apiRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});