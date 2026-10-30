const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, next) => {
  console.error('[API Error]', err.stack || err.message);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'MulterError') {
    statusCode = 400;
    message = `File upload error: ${err.message}`;
  } else if (err.code === 'PROTOCOL_CONNECTION_LOST' || (err.message && err.message.includes('Connection lost'))) {
    statusCode = 503;
    message = 'Database connection lost: The MySQL database server closed the connection or is offline. Please check your database host status.';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Database connection refused: Unable to connect to the MySQL database server. Please verify database host and port.';
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = { notFoundHandler, errorHandler };
