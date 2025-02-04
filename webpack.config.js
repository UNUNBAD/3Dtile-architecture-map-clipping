module.exports = {
  optimization: {
    usedExports: true,
    sideEffects: true,
    splitChunks: {
      chunks: 'all'
    }
  }
} 