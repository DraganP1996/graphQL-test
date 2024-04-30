module.exports = (next, err) => {
    if (!err.statusCode) {
        err.statusCode = 500;
      }
  
      next(err);
}