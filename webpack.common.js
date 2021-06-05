const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    app: "./src/index.ts"
  },
  output: {
    filename: "bundle.js"
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: "src/index.html"
    })
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      {test: /\.tsx?$/, use: "ts-loader"},
      {test: /\.css$/, use: ["style-loader", "css-loader"]},
      {test: /\.ttf$/, use: ["file-loader"]},
    ]
  }
};
