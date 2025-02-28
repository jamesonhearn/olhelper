const express = require('express');
const cors = require('cors');
const authRoutes = require('./server/auth');
const processEmailsRoutes = require('./server/processEmails');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/', processEmailsRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));
