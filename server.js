const express = require('express');
const dotenv = require('dotenv');
const routes = require('./routes/index');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
